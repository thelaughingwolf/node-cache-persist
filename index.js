const _ = require('lodash');
const Path = require('path');
const NodeCache = require('node-cache');
const StorageEngine = require('./storage');
const Promise = require('bluebird');

const defaults = {
	prefix: '',
	async: false,
	persist: {
		dir: `.node-cache-persist/storage`
	}
};

const storageLocations = {};

const Cache = function (opts = {}) {
	const Cache = this;

	const storageOpts = opts.persist === true ? {} : (opts.persist ? opts.persist : null);
	_.defaultsDeep(opts, defaults);
	delete opts.persist;

	if (storageOpts) {
		_.defaultsDeep(storageOpts, defaults.persist);
	}

	// This setting determines whether the cache is synchronous
	//   and eventually persistent, or asynchronous and reliably persistent
	// In default, sync mode, functions as a dropin replacement for node-cache
	//   with the caveat that data is not persisted the moment a call completes
	// In async mode, all methods are asynchronous and all data is guaranteed
	//   to be persisted once the call completes
	const mode = (opts.async === true) ? 'async' : 'sync';

	// This setting namespaces persisted data
	// It has no effect for a non-persisted cache
	// But if you are using a module with -persist in the name,
	//   you probably want some persistence
	const prefix = opts.prefix;

	delete opts.async;
	delete opts.prefix;

	const MemCache = new NodeCache(opts);

	let exposedMethods = [ 'get', 'mget', 'set', 'mset', 'del', 'take', 'ttl', 'getTtl', 'keys', 'has', 'getStats', 'flushAll', 'flushStats' ];
	let asyncMethods =   [ 'set', 'mset', 'merge', 'ttl', 'take' ];

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
		if (prefix) {
			storageOpts.dir = Path.join(storageOpts.dir, prefix);
		}
		if (storageLocations[storageOpts.dir]) {
			throw new Error(`Cannot re-use directory ${storageOpts.dir}`);
		}

		const Storage = new StorageEngine(storageOpts, Cache);
		storageLocations[storageOpts.dir] = Storage;

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

		if (mode === 'async') { // In async mode, .set and .mset return once data is persisted
			// Overwrite Cache.set with async version
			Cache.set = async (key, val, ttl) => {
				await Storage.onSet(key, val, ttl);
				return MemCache.set(key, val, ttl);
			}

			// Overwrite Cache.mset with async version
			Cache.mset = async (data = [ ]) => {
				data.forEach(async (datum) => {
					await Cache.set(datum.key, datum.val, datum.ttl);
				});
				return true;
			}
		}

		MemCache.on("del", Storage.onDel);
		MemCache.on("expired", Storage.onExpired);
		MemCache.on("flush", Storage.onFlush);
		if (Storage.onFlushStats) {
			MemCache.on("flush_stats", Storage.onFlushStats);
		}

		Cache.load = Promise.try(() => {
			return Storage.ready();
		}).then((persistedData) => {
			console.log(`Loading persisted data:`, persistedData);
			return MemCache.mset(persistedData);
		}).then(() => {
			// Now that persisted data has been placed in the cache,
			//   start persisting new data back to the backup
			if (mode === 'sync') {
				MemCache.on("set", Storage.onSet);
			}

			return true;
		});
	}

	let verifyMerge = (val1, val2) => {
		if (!_.isObject(val2)) {
			throw new Error(`Cannot merge into a non-object`);
		} else if (!_.isObject(val1)) {
			throw new Error(`Cannot merge a non-object into an object`);
		} else if (_.isArray(val1) && !_.isArray(val2)) {
			throw new Error(`Cannot merge an array into a non-array`);
		} else if (!_.isArray(val1) && _.isArray(val2)) {
			throw new Error(`Cannot merge a non-array into an array`);
		}
		_.merge(val2, val1);
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

	Cache.dump = modeWrapper('dump', () => {
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
	});

	return Cache;
};

module.exports = Cache;

module.exports.configure = (opts) => {
	_.merge(defaults, opts);
};



/*
// Use node-persist - sometimes corrupts data! DX
const storage = require('node-persist');

// node-localstorage has no TTL mechanism
//const Storage = require('node-localstorage').LocalStorage;
//const storage = new Storage('./.db/.scratch');

// ttl-localstorage does not store data to filesystem
//const storage = require('ttl-localstorage').LocalStorage;

const NodeCache = require('node-cache');

const cwd = process.cwd();

const memCache = new NodeCache({ deleteOnExpire: true });

const runSubcacheTests = async () => {

};

const Cache = {
	get: async (key) => {
		let cached = memCache.get(key);

		if (cached !== undefined) {
			return cached;
		}

		// Using getItem allows node-persist to do its own expiration cleanup
		// If we just use getDatum directly, node-persist returns whatever is there,
		//   even if the TTL has expired
		let value = await storage.getItem(key);

		if (value === undefined) {
			return undefined;
		}

		let datum = await storage.getDatum(key)
		,	ttl = undefined
		,	now = Date.now();
		if (datum.ttl && datum.ttl > now) {
			ttl = (datum.ttl - now) / 1000;
		}
		memCache.set(key, datum.value, ttl);

		return datum ? datum.value : undefined;
	},
	set: (key, value, ttl) => {
		memCache.set(key, value, (ttl ? (ttl / 1000) : undefined));
		return storage.setItem(key, value, {
			ttl
		});
	},
	del: (key) => {
		memCache.del(key);
		return storage.removeItem(key);
	},
	use: async (key) => {
		let val = Service.get(key);
		await Cache.del(key);
		return val;
	},
	clear: () => {
		memCache.flushAll();
		return storage.clear();
	},
	merge: async (key, value, ttl) => {
		let curValue = await Cache.get(key);
		if (curValue !== undefined) {
			try {
				if (!_.isObject(curValue)) {
					throw new Error(`curValue is not an object`);
				}
				if (!_.isObject(value)) {
					throw new Error(`value is not an object`);
				}
				if (_.isArray(curValue) && !_.isArray(value)) {
					throw new Error(`cannot cast object to array`);
				}
				_.merge(curValue, value);
			} catch (error) {
				app.context.services.debug.error(`Value could not be merged; overwriting`);
				curValue = value;
			}
		}
		return Cache.set(key, curValue, ttl);
	}
};

const subCaches = {};

const Service = (prefix) => {
	for (let key in subCaches) {
		let subCache = subCaches[key];
		if (key === prefix) {
			return subCache;
		} else if (key.indexOf(prefix) === 0) {
			throw new Error(`Cannot create cache '${prefix}' inside of existing cache '${key}'`);
		} else if (prefix.indexOf(key) === 0) {
			throw new Error(`Cannot create cache '${prefix}' that contains existing cache '${key}'`);
		}
	}
	if (subCaches[prefix]) {
		return subCaches[prefix];
	}

	const cache = {};
}; */

/* const Service = {
	getItem: async (key) => {
		let cached = memCache.get(key);

		if (cached !== undefined) {
			return cached;
		}

		// Using getItem allows node-persist to do its own expiration cleanup
		// If we just use getDatum directly, node-persist returns whatever is there
		let value = await storage.getItem(key);

		if (value === undefined) {
			return undefined;
		}

		let datum = await storage.getDatum(key)
		,	ttl = undefined
		,	now = Date.now();
		if (datum.ttl && datum.ttl > now) {
			ttl = (datum.ttl - now) / 1000;
		}
		memCache.set(key, datum.value, ttl);

		return datum ? datum.value : undefined;
	},
	setItem: (key, value, opts = {}) => {
		memCache.set(key, value, (opts.ttl ? opts.ttl / 1000 : undefined));
		return storage.setItem(key, value, opts);
	},
	removeItem: (key) => {
		memCache.del(key);
		return storage.removeItem(key);
	},
	takeItem: async (key) => {
		let val = Service.getItem(key);
		await Service.removeItem(key);
		return val;
	},
	clear: () => {
		memCache.flushAll();
		return storage.clear();
	}
};

// Add aliases
Service.get = Service.getItem;
Service.set = Service.setItem;
Service.del = Service.removeItem;
Service.rm  = Service.removeItem;
Service.take  = Service.takeItem;

const subCaches = {};

Service.generateSubcache = (prefix) => {
	if (subCaches[prefix]) {
		return subCaches[prefix];
	}

	const cache = {
		prefix,
		prefixRegex: new RegExp(`^${prefix}`),
		getItem: (key) => {
			return Service.getItem(`${prefix}${key}`);
		},
		setItem: (key, value, opts) => {
			return Service.setItem(`${prefix}${key}`, value, opts);
		},
		updateItem: (key, value, opts) => {
			return Service.updateItem(`${prefix}${key}`, value, opts);
		},
		merge: async (key, value, opts) => {
			let curValue = await cache.getItem(key);
			if (curValue !== undefined) {
				try {
					if (!_.isObject(curValue)) {
						throw new Error(`curValue is not an object`);
					}
					if (!_.isObject(value)) {
						throw new Error(`value is not an object`);
					}
					if (_.isArray(curValue) && !_.isArray(value)) {
						throw new Error(`cannot cast object to array`);
					}
					_.merge(curValue, value);
				} catch (error) {
					app.context.services.debug.error(`Value could not be merged; overwriting`);
					curValue = value;
				}
			}
			return cache.setItem(key, curValue, opts);
		},
		removeItem: (key) => {
			return Service.removeItem(`${prefix}${key}`);
		},
		forEach: async (fn) => {
			await Service.forEach(async (entry) => {
				if (entry.key.match(cache.prefixRegex)) {
					await fn(entry);
				}
			});
		},
		clear: async () => {
			// cache.forEach will only match the same prefix
			await cache.forEach(async (entry) => {
				await (Service.removeItem(entry.key));
			});

			delete subCaches[prefix];
		},
		values: () => {
			return Service.valuesWithKeyMatch(cache.prefixRegex);
		},
		keys: async () => {
			let result = [ ];
			await cache.forEach((entry) => {
				result.push(entry.key.replace(cache.prefixRegex, ''));
			});
			return result;
		}
	};

	cache.get = cache.getItem;
	cache.set = cache.setItem;
	cache.del = cache.removeItem;
	cache.rm = cache.removeItem;

	subCaches[prefix] = cache;

	return cache;
};

storage.init({
	dir: `${cwd}/.db/.node-persist/storage`,
	//logging: app.context.services.debug
}).then(response => {
	for (let key in storage) {
		((methodName) => {
			if (!Service[methodName] && typeof(storage[methodName]) === 'function') {
				Service[methodName] = function() {
					let args = [ ];
					for (let i = 0; i < arguments.length; ++i) {
						args.push(arguments[i]);
					}
					return storage[methodName].apply(null, args);
				};
			}
		})(key);
	}

	app.context.services.debug(`Initialized node-persist with options:`, response);

	app.context.services.debug(`Testing all subCache functionality`);
	runSubcacheTests().catch(error => {
		app.context.services.debug.error(`Error testing subCache:`, error);
	});
}); */