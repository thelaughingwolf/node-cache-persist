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

const { defaultsDeep } = require('lodash');
const Engines = require('./engines');

const generateStorage = function(storageOpts, cache) {
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

	Storage.engine = Engines.load(storageOpts.engine, engineOpts, Cache);

	Storage.load = async () => {
		try {
			if (loaded) {
				throw new Error(`Cannot re-initiate storage engine`);
			}

			let persistedRecords = await Storage.engine.load();

			console.log(persistedRecords);

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
	Storage.onDel = async (key) => {
		await Storage._ready;
		return Storage.engine.del(key);
	};
	Storage.onExpired = async (key) => {
		await Storage._ready;
		return Storage.engine.del(key);
	};
	Storage.onTtl = async (key, ttl) => {
		await Storage._ready;
		return Storage.engine.ttl(key, ttl);
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
		console.log("Stats flushed ¯\\_(ツ)_/¯");
	};

	return Storage;
};

module.exports = generateStorage;