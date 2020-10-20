// Load the selected backing program here
// Supported options:
//    quick.db
//    node-persist
// Exposes the following methods:
//   ready:		called when the storage is prepared
//					to be written & read
//				must return all values with their TTL, in ms
//   onSet: called when a key is added to the memory cache
//          receives key, val, and ttl in ms
//   onDel: called when a key is removed from the memory cache
//   onTTL: called when a key's TTL is updated in the memory cache
//   onExpired: called when a key expires
//   onFlush: called when the memory cache flushes all keys
//   onFlushStats: called when the memory cache flushes all stats; not required

const defaultsDeep = require('lodash.defaultsdeep');
const log = require('loglevel');

const generateStorage = async function(storageOpts, cache) {
	const Engines = require('./engines');
	const Storage = this;
	const Cache = cache;
	const defaults = {
		engine: 'node-persist',
		prefix: ''
	};

	defaultsDeep(storageOpts, defaults);

	const engineOpts = storageOpts.opts || {};
	delete storageOpts.opts;

	if (storageOpts.prefix) {
		engineOpts.prefix = storageOpts.prefix;
		delete storageOpts.prefix;
	}

	let loaded = false;

	// Returns the difference, in milliseconds, between a timestamp and Date.now
	// Expects millisecond
	// If timestamp is falsy or less than now, returns undefined
	const tsToTtl = (ts, units) => {
		let now = Date.now()
		,	ttl = (ts && ts > now) ? ts - now : undefined;
		if (ttl && units === 's') {
			ttl /= 1000;
		}
		return ttl;
	};

	// These allow Storage to track if it's
	//   prepared for internal use
	// All methods returned will be available for use instantly
	let _ready = {
		resolve: null, // This will be the resolve() from Storage._ready
		reject: null   // This will be the reject()  from Storage._ready
	};
	Storage._ready = new Promise((resolve, reject) => {
		_ready.resolve = resolve;
		_ready.reject = reject;
	});

	log.debug(`Preparing to load engine ${storageOpts.engine}`);

	Storage.engine = await Engines.load(storageOpts.engine, engineOpts, Cache);

	Storage.load = async () => {
		try {
			if (loaded) {
				throw new Error(`Cannot re-initiate storage engine`);
			}

			let persistedRecords = await Storage.engine.load();

			log.debug(persistedRecords);

			loaded = true;
			_ready.resolve(true);

			return persistedRecords;
		} catch (error) {
			_ready.reject(error);
		}
	};
	// Storage API: all onMethod values
	Storage.onSet = async (key, val, ttl) => {
		await Storage._ready;
		if (ttl === undefined) {
			ttl = tsToTtl(Cache.getTtl(key));
		}
		return Storage.engine.set(key, val, ttl);
	};
	Storage.onMSet = async (pairs) => {
		await Storage._ready;
		if (Storage.engine.mset) {
			return Storage.engine.mset(pairs);
		}
		return Promise.all(pairs.map(async pair => {
			return await Storage.engine.set(pair.key, pair.val, pair.ttl);
		}));
	};
	Storage.onDel = async (key) => {
		await Storage._ready;
		return Storage.engine.del(key);
	};
	Storage.onMDel = async (keys) => {
		await Storage._ready;
		if (Storage.engine.mdel) {
			return Storage.engine.mdel(keys);
		}
		return Promise.all(keys.map(async key => {
			return await Storage.engine.del(key);
		}));
	};
	Storage.onExpired = async (key) => {
		await Storage._ready;
		return Storage.engine.del(key);
	};
	Storage.onTtl = async (key, ttl) => {
		await Storage._ready;
		return Storage.engine.ttl(key, ttl);
	}
	Storage.onMTtl = async (pairs) => {
		await Storage._ready;
		if (Storage.engine.mttl) {
			return Storage.engine.mttl(pairs);
		}
		return Promise.all(pairs.map(async pair => {
			return await Storage.engine.ttl(pair.key, pair.ttl);
		}));
	}
	Storage.onFlush = async () => {
		await Storage._ready;
		return Storage.engine.flush();
	};
	Storage.onFlushStats = async () => {
		await Storage._ready;
		if (Storage.engine.flushStats) {
			return Storage.engine.flushStats();
		}
		log.info("Stats flushed ¯\\_(ツ)_/¯");
	};
	Storage.onClose = async () => {
		await Storage._ready;
		return Storage.engine.close();
	};

	return Storage;
};

module.exports = generateStorage;