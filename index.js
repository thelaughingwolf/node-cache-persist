const defaultsDeep = require('lodash.defaultsdeep');
const isObject = require('lodash.isobject');
const merge = require('lodash.merge');
const cloneDeep = require('lodash.clonedeep');
const NodeCache = require('node-cache');
const log = require('loglevel');

log.setDefaultLevel('warn');

log.info(`Running from CWD ${process.cwd()}`);

const baseDefaults = {
	logLevel: 'warn',
	persist: {
		engine: 'node-persist',
		prefix: ''
	}
};

const NodePersistentCache = (opts) => {
	const NPC = {};

	const defaults = cloneDeep(baseDefaults);

	NPC.engines = require('./engines');
	NPC.config = (opts) => {
		if (opts.testEngines) {
			NPC.engines.toggleTests();
			delete opts.testEngines;
		}

		if (opts !== undefined) {
			log.debug(`Merging in new opts`, opts);
			merge(defaults, opts);
		}
		return cloneDeep(defaults);
	};
	NPC.cache = async (opts) => {
		const newCache = await new generateCache(opts);
		return newCache;
	};

	const StorageEngine = require('./storage');

	if (opts !== undefined) {
		NPC.config(opts);
	}

	const generateCache = function (opts = {}) {
		const Cache = this;

		defaultsDeep(opts, defaults);

		const storageOpts = (opts.persist === false || opts.persist === null) ? null : (opts.persist === true ? {} : opts.persist);

		delete opts.persist;

		log.debug(`Creating a new node-persistent-cache!`, { opts, storageOpts });

		if (storageOpts) {
			defaultsDeep(storageOpts, defaults.persist);
		}

		const MemCache = new NodeCache(opts);

		let exposedMethods = [ 'get', 'mget', 'set', 'mset', 'del', 'take', 'ttl', 'getTtl', 'keys', 'has', 'getStats', 'flushAll', 'flushStats' ];
		let asyncMethods =   [ 'set', 'mset', 'del', 'ttl', 'take', 'merge' ];

		for (let i = 0; i < exposedMethods.length; ++i) {
			((k) => {
				const MemCacheMethod = MemCache[k];
				if (typeof MemCacheMethod === 'function') {
					if (asyncMethods.indexOf(k) === -1) {
						Cache[k] = (...args) => {
							return MemCacheMethod.apply(null, args);
						}
					} else {
						Cache[k] = async (...args) => {
							return MemCacheMethod.apply(null, args);
						}
					}
				}
			})(exposedMethods[i]);
		}

		let verifyMerge = (dest, source) => {
			if (!isObject(dest)) {
				throw new Error(`Cannot merge into a non-object`);
			} else if (!isObject(source)) {
				throw new Error(`Cannot merge a non-object into an object`);
			} else if (Array.isArray(source) && !Array.isArray(dest)) {
				throw new Error(`Cannot merge an array into a non-array`);
			} else if (!Array.isArray(source) && Array.isArray(dest)) {
				throw new Error(`Cannot merge a non-array into an array`);
			}
			merge(dest, source);
		};

		Cache.merge = async (key, val) => {
			let curVal = MemCache.get(key)
			,	curTtl = MemCache.getTtl(key)
			,	newTtl;
			if (curTtl) {
				newTtl = (Date.now() - curTtl) / 1000;
			}
			if (curVal) {
				verifyMerge(curVal, val);
				val = curVal;
			}
			return Cache.set(key, val, curTtl);
		};

		Cache.dump = () => {
			let result = {}
			,	keys = Cache.keys();

			keys.forEach((key) => {
				let now = Date.now();
				result[key] = {
					val: Cache.get(key),
					ts: Cache.getTtl(key)
				};
				if (result[key].ts) {
					result[key].date = new Date(result[key].ts);
					result[key].ttl = `${result[key].ts - now}ms`;
				}
			});

			return result;
		};

		if (storageOpts) {
			if (opts.useClones === false) {
				log.warn(`By definition, data retrieved from persistent backup will be clones of the original!`);
			}

			log.info(`Generating persistent storage:`, storageOpts);

			return StorageEngine(storageOpts, Cache).then(storageEngine => {
				const Storage = storageEngine;

				// Overwrite .ttl so it calls Storage.onTtl
				Cache.ttl = async (key, ttl = opts.stdTTL) => {
					await Storage.onTtl(key, ttl);
					return MemCache.ttl(key, ttl);
				};

				Cache.close = async () => {
					MemCache.emit('close');
					await Storage.close();
					return MemCache.close();
				};

				// This captures any data that got entered into
				//   the cache between creating the cache
				//   and loading it
				let curKeys = MemCache.keys()
				,	curCachePairs = [ ];
				for (let i = 0; i < curKeys.length; ++i) {
					let curKey = curKeys[i];
					curCachePairs.push({
						key: curKey,
						val: MemCache.get(curKey),
						ttl: MemCache.getTtl(curKey)
					});
				}

				Storage.onMSet(curCachePairs);

				Cache.set = async (key, val, ttl) => {
					await Storage.onSet(key, val, ttl);
					return MemCache.set(key, val, ttl);
				};
				Cache.mset = async (data = [ ]) => {
					await Storage.onMSet(data);
					return true;
				};
				Cache.del = async (key) => {
					await Storage.onDel(key);
					return MemCache.del(key);
				};
				Cache.take = async (key) => {
					await Storage.onDel(key);
					return MemCache.take(key);
				};
				Cache.ttl = async (key, ttl) => {
					// node-cache uses TTLs in seconds
					// Storage uses TTLs in milliseconds
					await Storage.onTtl(key, ttl * 1000);
					return MemCache.ttl(key, ttl);
				};
				Cache.flushAll = async (key, ttl) => {
					await Storage.onFlush();
					return MemCache.flushAll();
				};
				Cache.close = async () => {
					await Storage.onClose();
					return MemCache.close();
				};
				Cache.load = async () => {
					const persistedData = await Storage.load();
					log.debug("persistedData:", persistedData);

					await MemCache.mset(persistedData);

					return true;
				};

				return Cache.load();
			}).then(() => {
				return Cache;
			});
		}

		return Cache;
	};

	return NPC;
};

module.exports = NodePersistentCache;