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

const _ = require('lodash');
const Promise = require('bluebird');
const Bottleneck = require('bottleneck');

const generateStorage = function(opts, cache) {
	const Storage = this;
	const Cache = cache;

	let loaded = false;

	const defaults = {
		engine: 'node-persist'
	};

	_.defaults(opts, defaults);

	// Returns the difference, in milliseconds, between a timestamp and Date.now
	// If timestamp is falsy or less than now, returns undefined
	const tsToTtl = (ts, units) => {
		let now = Date.now()
		,	ttl = (ts && ts > now) ? ts - now : undefined;
		if (ttl && units === 's') {
			ttl /= 1000;
		}
		return ttl;
	};

	if (opts.engine === 'node-persist') {
		const Engine = require('node-persist').create({
			dir: opts.dir
		});
		const Limiter = new Bottleneck({
			maxConcurrent: 1
		});

		// These allow Storage to track if it's
		//   prepared for internal use
		// All methods returned will be available for use instantly
		let _ready = {
			promise: null,
			resolve: null, // This will be the resolve() from Storage._ready
			reject: null   // This will be the reject()  from Storage._ready
		};
		_ready.promise = new Promise((resolve, reject) => {
			_ready.resolve = resolve;
			_ready.reject = reject;
		});
		Storage._ready = _ready.promise;
		/* Storage._ready = Promise.try(() => {
			return _ready.promise;
		}); */

		Storage.ready = async () => {
			try {
				await Engine.init();

				let result = [ ];
				await Engine.forEach((datum) => {
					// Engine.forEach returns all data without inspecting ttl
					// That means it may return expired data!
					// So check that TTL
					if (!datum.ttl || Date.now() < datum.ttl) {
						// Although both node-persist and node-cache store ms timestamps,
						//   node-cache *sets* TTLs in seconds
						// node-persist sets TTLs in milliseconds
						result.push({key: datum.key, val: datum.value, ttl: tsToTtl(datum.ttl, 's') });
					}
				});

				_ready.resolve(true);

				return result;
			} catch (error) {
				_ready.reject(error);
			}
		};
		Storage.getItem = async (key, val) => {
			await Storage._ready;
			return Limiter.schedule(Engine.getItem.bind(Engine), key, val);
		};
		Storage.updateItem = async (key, val, ttl) => {
			await Storage._ready;
			return Limiter.schedule(Engine.updateItem.bind(Engine), key, val, { ttl });
		};
		Storage.removeItem = async (key) => {
			await Storage._ready;
			return Limiter.schedule(Engine.removeItem.bind(Engine), key);
		};
		Storage.clear = async () => {
			await Storage._ready;
			return Limiter.schedule(Engine.clear.bind(Engine));
		};
	}

	// Storage API: all onMethod values
	Storage.onSet = async (key, val, ttl) => {
		if (ttl === undefined) {
			ttl = tsToTtl(Cache.getTtl(key));
		}
		return Storage.updateItem(key, val, ttl);
	};
	Storage.onDel = async (key) => {
		return Storage.removeItem(key);
	};
	Storage.onExpired = async (key) => {
		return Storage.removeItem(key);
	};
	Storage.onTtl = async (key, ttl) => {
		let val = await Storage.getItem(key);
		if (val !== undefined) {
			return Storage.updateItem(key, val, tsToTtl(ttl));
		}
	}
	Storage.onFlush = async () => {
		return Storage.clear();
	};
	Storage.onFlushStats = () => {
		console.log("Stats flushed ¯\\_(ツ)_/¯");
	};
	Storage.onReady = async () => {
		if (loaded) {
			throw new Error(`Cannot re-initiate storage engine`);
		}

		let result = await Storage.ready();

		loaded = true;

		return result;
	};

	return Storage;
};

module.exports = generateStorage;