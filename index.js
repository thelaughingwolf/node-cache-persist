const { defaultsDeep, isObject, isArray, merge, cloneDeep } = require('lodash');
const NodeCache = require('node-cache');
const StorageEngine = require('./storage');

const defaults = {
	async: false,
	persist: {
		prefix: ''
	}
};

const generateCache = function (opts = {}) {
	console.log(`Creating a new node-cache-persist!`, opts);

	const Cache = this;

	const storageOpts = opts.persist === true ? {} : (opts.persist ? opts.persist : null);
	defaultsDeep(opts, defaults);
	delete opts.persist;

	if (storageOpts) {
		defaultsDeep(storageOpts, defaults.persist);
	}

	// This setting determines whether the cache is synchronous
	//   and eventually persistent, or asynchronous and reliably persistent
	// In default, sync mode, functions as a dropin replacement for node-cache
	//   with the caveat that data is not persisted the moment a call completes
	// In async mode, all methods are asynchronous and all data is guaranteed
	//   to be persisted once the call completes
	const mode = (opts.async === true) ? 'async' : 'sync';

	delete opts.async;

	const MemCache = new NodeCache(opts);

	let exposedMethods = [ 'get', 'mget', 'set', 'mset', 'del', 'take', 'ttl', 'getTtl', 'keys', 'has', 'getStats', 'flushAll', 'flushStats' ];
	let asyncMethods =   [ 'set', 'mset', 'del', 'ttl', 'take', 'merge' ];

	let modeWrapper = (name, method) => {
		let methodMode;
		if (asyncMethods.indexOf(name) === -1) {
			methodMode = 'sync';
		} else {
			methodMode = mode;
		}
		if (methodMode === 'async') {
			return async (...args) => {
				return method.apply(null, args);
			};
		} else {
			return (...args) => {
				return method.apply(null, args);
			};
		};
	};

	for (let i = 0; i < exposedMethods.length; ++i) {
		((k) => {
			if (typeof(MemCache[k]) === 'function') {
				Cache[k] = modeWrapper(k, MemCache[k]);

				/* (...args) => {
					return modeWrapper(MemCache[k])(args);
				}; */
			}
		})(exposedMethods[i]);
	}

	if (storageOpts) {
		if (opts.useClones === false) {
			console.warn(`By definition, data retrieved from persistent backup will be clones of the original!`);
		}

		const Storage = new StorageEngine(storageOpts, Cache);

		// Overwrite .ttl so it calls Storage.onTtl
		Cache.ttl = modeWrapper('ttl', (key, ttl = opts.stdTTL) => {
			let storage = Storage.onTtl(key, ttl)
			,	memCache = () => { MemCache.ttl(key, ttl); };

			if (mode === 'async') {
				return storage.then(memCache);
			} else {
				return memCache();
			}
		});

		if (mode === 'async') { // In async mode, all the updating methods return once data is persisted
			Cache.set = async (key, val, ttl) => {
				await Storage.onSet(key, val, ttl);
				return MemCache.set(key, val, ttl);
			};
			Cache.mset = async (data = [ ]) => {
				data.forEach(async (datum) => {
					await Cache.set(datum.key, datum.val, datum.ttl);
				});
				return true;
			};
			Cache.del = async (key) => {
				await Storage.onDel(key);
				return MemCache.del(key);
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
		}

		Cache.load = async () => {
			const persistedData = await Storage.load();
			await MemCache.mset(persistedData);

			if (mode === 'sync') {
				// Now that persisted data has been placed in the cache,
				//   start persisting new data back to the backup
				MemCache.on("set", Storage.onSet);
				MemCache.on("del", Storage.onDel);
				MemCache.on("expired", Storage.onExpired);
				MemCache.on("flush", Storage.onFlush);
				MemCache.on("flush_stats", Storage.onFlushStats);
			}

			return true;
		};
	}

	let verifyMerge = (val1, val2) => {
		if (!isObject(val2)) {
			throw new Error(`Cannot merge into a non-object`);
		} else if (!isObject(val1)) {
			throw new Error(`Cannot merge a non-object into an object`);
		} else if (isArray(val1) && !isArray(val2)) {
			throw new Error(`Cannot merge an array into a non-array`);
		} else if (!isArray(val1) && isArray(val2)) {
			throw new Error(`Cannot merge a non-array into an array`);
		}
		merge(val2, val1);
	};

	Cache.merge = modeWrapper('merge', (key, val) => {
		let curVal = MemCache.get(key)
		,	curTtl = MemCache.getTtl(key)
		,	newTtl;
		if (curTtl) {
			newTtl = Date.now() - curTtl;
		}
		verifyMerge(val, curVal);
		return Cache.set(key, curVal, curTtl);
	});

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

	return Cache;
};

module.exports = generateCache;

module.exports.configure = (opts) => {
	merge(defaults, opts);
};
module.exports.getConfig = () => {
	return cloneDeep(defaults);
};

module.exports.engines = require('./engines');