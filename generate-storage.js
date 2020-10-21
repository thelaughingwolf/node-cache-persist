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

const shortid = require('shortid');

const generateStorage = async function(storageOpts, cache) {
	const Engines = require('./engines');
	const Storage = {};
	const Cache = cache;

	Storage.id = shortid.generate();

	Cache.log.debug(`storage.${Storage.id}|generated`);

	const engineOpts = storageOpts.engineOpts || {};
	delete storageOpts.engineOpts;

	if (storageOpts.prefix) {
		engineOpts.prefix = storageOpts.prefix;
		delete storageOpts.prefix;
	}

	let loaded = false;

	// Returns the difference, in milliseconds, between a timestamp and Date.now
	// Returns undefined if ts is 0 or undefined
	// Returns a negative number if ts is in the past
	const tsToTtl = (ts) => {
		return (ts ? (ts - Date.now()) : undefined);
	};

	// These allow Storage to track if it's prepared for internal use
	// All methods returned will be available for use instantly
	let _ready = {
		resolve: null, // This will be the resolve() from Storage._ready
		reject: null   // This will be the reject()  from Storage._ready
	};
	Storage._ready = new Promise((resolve, reject) => {
		_ready.resolve = resolve;
		_ready.reject = reject;
	});

	Cache.log.debug(`storage.${Storage.id}|initiating engine ${storageOpts.engine}`);

	Storage.engine = await Engines.load(storageOpts.engine, engineOpts, Cache);

	Cache.log.debug(`storage.${Storage.id}|initiated engine`);

	Storage.load = async () => {
		try {
			Cache.log.debug(`storage.${Storage.id}|loading persisted records`);

			if (loaded) {
				throw new Error(`Cannot re-initiate storage engine`);
			}

			let persistedRecords = await Storage.engine.load();

			persistedRecords = persistedRecords.map(record => {
				// NodeCache uses TTLs in seconds
				// Storage and all engines use TTLs in milliseconds
				if (record.ttl) {
					record.ttl /= 1000;
				}
				return record;
			});

			Cache.log.debug(`storage.${Storage.id}|loaded persisted records`);

			loaded = true;

			_ready.resolve(true);

			Cache.log.debug(`storage.${Storage.id}|ready`);

			return persistedRecords;
		} catch (error) {
			_ready.reject(error);
		}
	};
	// Storage API: all onMethod values
	Storage.onSet = async (key, val, ttl) => {
		Cache.log.debug(`storage.${Storage.id}|onSet - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onSet ${key} (ttl: ${ttl}):`, val);

		if (ttl === undefined) {
			Cache.log.debug(`storage.${Storage.id}|onSet provided no TTL for ${key}; cache TTL is`, Cache.getTtl(key));
			ttl = tsToTtl(Cache.getTtl(key));
			if (ttl < 0) {
				return Storage.engine.del(key);
			}
		}

		Cache.log.debug(`storage.${Storage.id}|onSet ${key} ttl:`, ttl);

		return Storage.engine.set(key, val, ttl);
	};
	Storage.onMSet = async (pairs) => {
		Cache.log.debug(`storage.${Storage.id}|onMSet - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onMSet:`, pairs);

		if (Storage.engine.mset) {
			Cache.log.debug(`storage.${Storage.id}|onMSet using engine.mset`);
			return Storage.engine.mset(pairs);
		}

		Cache.log.debug(`storage.${Storage.id}|onMSet mapping to engine.set`);
		return Promise.all(pairs.map(async pair => {
			return await Storage.engine.set(pair.key, pair.val, pair.ttl);
		}));
	};
	Storage.onDel = async (key) => {
		Cache.log.debug(`storage.${Storage.id}|onDel - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onDel ${key}`);

		return Storage.engine.del(key);
	};
	Storage.onMDel = async (keys) => {
		Cache.log.debug(`storage.${Storage.id}|onMDel - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onMDel ${keys}`);

		if (Storage.engine.mdel) {
			Cache.log.debug(`storage.${Storage.id}|onMDel using engine.mdel`);
			return Storage.engine.mdel(keys);
		}

		Cache.log.debug(`storage.${Storage.id}|onMDel mapping to engine.del`);
		return Promise.all(keys.map(async key => {
			return await Storage.engine.del(key);
		}));
	};
	Storage.onExpired = async (key) => {
		Cache.log.debug(`storage.${Storage.id}|onExpired - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onExpired ${key}`);

		return Storage.engine.del(key);
	};
	Storage.onTtl = async (key, ttl) => {
		Cache.log.debug(`storage.${Storage.id}|onTtl - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onTtl ${key} (TTL: ${ttl})`);

		return Storage.engine.ttl(key, ttl);
	}
	Storage.onMTtl = async (pairs) => {
		Cache.log.debug(`storage.${Storage.id}|onMTtl - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onMTtl:`, pairs);

		if (Storage.engine.mttl) {
			Cache.log.debug(`storage.${Storage.id}|onMTtl using engine.mttl`);
			return Storage.engine.mttl(pairs);
		}

		Cache.log.debug(`storage.${Storage.id}|onMTtl mapping to engine.ttl`);
		return Promise.all(pairs.map(async pair => {
			return await Storage.engine.ttl(pair.key, pair.ttl);
		}));
	}
	Storage.onFlush = async () => {
		Cache.log.debug(`storage.${Storage.id}|onFlush - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onFlush`);

		return Storage.engine.flush();
	};
	Storage.onFlushStats = async () => {
		Cache.log.debug(`storage.${Storage.id}|onFlushStats - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onFlushStats`);

		if (Storage.engine.flushStats) {
			Cache.log.debug(`storage.${Storage.id}|onFlushStats calling engine.flushStats`);
			return Storage.engine.flushStats();
		}
		
		Cache.log.debug(`storage.${Storage.id}|onFlushStats has no engine.flushStats`);
		Cache.log.info("Stats flushed ¯\\_(ツ)_/¯");
	};
	Storage.onClose = async () => {
		Cache.log.debug(`storage.${Storage.id}|onClose - awaiting Storage._ready`);

		await Storage._ready;

		Cache.log.debug(`storage.${Storage.id}|onClose`);

		return Storage.engine.close();
	};

	return Storage;
};

module.exports = generateStorage;