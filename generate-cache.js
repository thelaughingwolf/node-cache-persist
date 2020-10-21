const isObject = require('lodash.isobject');
const merge = require('lodash.merge');
const NodeCache = require('node-cache');
const log = require('loglevel');
const shortid = require('shortid');

const generateStorage = require('./generate-storage');

const generateCache = async function (opts = {}) {
	const Cache = {};

	Cache.id = shortid.generate();

	Cache.log = log.getLogger(opts.prefix || 'default');

	Cache.log.setLevel(opts.logLevel);

	Cache.log.debug(`npcache.${Cache.id}|generated`);

	if (opts.useClones === false) {
		Cache.log.warn(`By definition, data retrieved from persistent backup will be clones of the original!`);
	}

	// Extract storage opts
	const storageOpts = {
		engine: opts.engine,
		prefix: opts.prefix,
		engineOpts: opts.engineOpts
	};
	delete opts.engine;
	delete opts.prefix;
	delete opts.engineOpts;

	Cache.log.debug(`Creating a new node-persistent-cache!`, { opts, storageOpts });

	const MemCache = new NodeCache(opts);

	const Storage = await generateStorage(storageOpts, Cache);

	Cache.log.debug(`npcache.${Cache.id} loaded storage.${Storage.id}`);

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

	Cache.log.debug(`npcache.${Cache.id} replicated node-cache methods`);

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

	Cache.merge = async (key, val, ttl) => {
		Cache.log.debug(`npcache.${Cache.id}|merge ${key} (TTL: ${ttl}):`, val);
		let curVal = MemCache.get(key)
		,	curTtl = MemCache.getTtl(key)
		,	newTtl;
		if (ttl) {
			newTtl = ttl;
		} else if (curTtl) {
			newTtl = (Date.now() - curTtl) / 1000;
		}
		if (curVal) {
			verifyMerge(curVal, val);
			val = curVal;
		}
		return Cache.set(key, val, newTtl);
	};

	Cache.dump = () => {
		Cache.log.debug(`npcache.${Cache.id}|dump`);
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

	// This captures any data that got entered into
	//   the cache between creating the cache
	//   and loading it
	/* let curKeys = MemCache.keys()
	,	curCachePairs = [ ];
	for (let i = 0; i < curKeys.length; ++i) {
		let curKey = curKeys[i];
		curCachePairs.push({
			key: curKey,
			val: MemCache.get(curKey),
			ttl: MemCache.getTtl(curKey)
		});
	}

	Cache.log.debug(`npcache.${Cache.id}|preparing to set pre-existing values`, curCachePairs);
	
	await Storage.onMSet(curCachePairs);

	Cache.log.debug(`npcache.${Cache.id}|set pre-existing values`); */

	Cache.set = async (key, val, ttl = opts.stdTTL) => {
		Cache.log.debug(`npcache.${Cache.id}|set ${key} (TTL: ${ttl}):`, val);

		// node-cache expects TTLs in seconds
		// Storage uses TTLs in milliseconds
		await Storage.onSet(key, val, (ttl ? ttl * 1000 : undefined));
		return MemCache.set(key, val, ttl);
	};
	Cache.mset = async (data = [ ]) => {
		Cache.log.debug(`npcache.${Cache.id}|mset:`, data);

		await Storage.onMSet(data);
		return MemCache.mset(data);
	};
	Cache.del = async (key) => {
		Cache.log.debug(`npcache.${Cache.id}|del ${key}`);

		await Storage.onDel(key);
		return MemCache.del(key);
	};
	Cache.take = async (key) => {
		Cache.log.debug(`npcache.${Cache.id}|take ${key}`);

		await Storage.onDel(key);
		return MemCache.take(key);
	};
	Cache.ttl = async (key, ttl) => {
		Cache.log.debug(`npcache.${Cache.id}|ttl ${key} (TTL: ${ttl})`);

		// node-cache expects TTLs in seconds
		// Storage uses TTLs in milliseconds
		await Storage.onTtl(key, ttl * 1000);
		return MemCache.ttl(key, ttl);
	};
	Cache.flushAll = async () => {
		Cache.log.debug(`npcache.${Cache.id}|flushAll`);

		await Storage.onFlush();
		return MemCache.flushAll();
	};
	Cache.close = async () => {
		Cache.log.debug(`npcache.${Cache.id}|close`);

		MemCache.emit('close');
		await Storage.onClose();
		return MemCache.close();
	};
	Cache.load = async () => {
		Cache.log.debug(`npcache.${Cache.id}|load`);

		const persistedData = await Storage.load();

		Cache.log.debug("persistedData:", persistedData);

		await MemCache.mset(persistedData);

		return true;
	};

	Cache.log.debug(`npcache.${Cache.id}|about to load`);

	await Cache.load();

	return Cache;
};

module.exports = generateCache;