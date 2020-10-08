const np = require('node-persist');
const nc = require('node-cache');
const NodeCache = require('node-cache');
const StorageEngine = require('./storage');

const createCache = async (opts = {}) => {
	let storageOpts = opts.persist;
	delete opts.persist;

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

	const caches = {};

	const MemCache = new NodeCache(opts);
	const Cache = {
		set: MemCache.set,
		mset: MemCache.mset,
		take: MemCache.take
	};

	for (let key in MemCache) {
		((k) => {
			if (typeof(MemCache[k]) === 'function') {
				Cache[k] = (...args) => {
					return MemCache[k].apply(null, args);
				}
			}
		})(key);
	}

	let convertTTL = (ttl, target) => {
		if (!target) { throw new Error(`Must provide TTL mode to convert to`); }
		return ttl ? (target === 'persist' ? (ttl / 1000) : (ttl * 1000)) : undefined;
	};

	if (storageOpts) {
		if (!npOpts.dir) {
			throw new Error(`You must specify a location for node-persist to store the data (node-persist default: .node-persist/storage)`);
		}

		const Storage = new StorageEngine()
		await Storage.init();

		// Load all data in Storage into the Cache when initialized
		Storage.forEach((datum) => {
			// node-persist stores TTLs as seconds since Unix epoch
			// node-cache stores TTLs as milliseconds since Unix epoch
			MemCache.set(datum.key, datum.value, convertTTL(datum.ttl, 'cache'));
		});

		// Overwrite Cache.set with custom version
		// We have to do this because node-cache
		//   doesn't include the TTL in its on("set") event
		Cache.set = async (key, value, ttl) => {
			// Get the node-cache standard TTL so we can
			//   pass it along to node-persist too
			if (ttl === undefined && ncOpts.stdTTL) {
				ttl = ncOpts.stdTTL;
			}
			MemCache.set(key, value, ttl);
			Storage.set(key, value, {
				ttl: convertTTL(ttl, 'persist')
			});
		}

		Cache.mset = async (input = [ ]) => {
			for (let i = 0; i < input.length; ++i) {
				await Cache.set(input[i].key, input[i].val, input[i].ttl);
			}
			return true;
		}

		Cache.ttl = async (key, ttl) => {

		};

		MemCache.on("set", )
	}

	return Cache;
};

module.exports = Cache;




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
	const assert = require('assert');
	const testCache1 = Service.generateSubcache('test1.');
	const testCache2 = Service.generateSubcache('test2.');

	// Ensure testing with nothing present
	await testCache1.clear();
	await testCache2.clear();

	await testCache1.set('val1', 'test1val', { ttl: 1500 });

	let val = await testCache1.get('val1');
	assert.strictEqual(val, 'test1val', `testCache1.val1 was undefined`);

	val = await testCache2.get('val1');
	assert.strictEqual(val, undefined, `testCache2.val1 was defined`);

	await testCache2.set('val1', 'test2val', { ttl: 1500 });

	val = await testCache1.get('val1');
	assert.strictEqual(val, 'test1val', `testCache1.val1 was updated`);

	await testCache2.set('val2', 'test2val2', { ttl: 1500 });

	let cacheKeys = await testCache1.keys();
	assert.strictEqual(JSON.stringify(cacheKeys), JSON.stringify(['val1']), `testCache1 returned invalid set of keys`);

	let cacheValues = await (testCache1.values());
	assert.strictEqual(JSON.stringify(cacheValues), JSON.stringify(['test1val']), `testCache1 returned invalid set of keys`);

	await Promise.all([
		testCache1.set('concurrent-1', 'short-data'),
		testCache1.set('concurrent-1', 'longer-data'),
		testCache1.set('concurrent-1', {data: 'very long, much longer than you would have expected, but not actually that long in the end I suppose'}),
		testCache1.set('concurrent-1', 1105),
	]);

	val = await testCache1.get('concurrent-1');
	// There isn't even a value this *should* have, since we're doing concurrent operations

	await testCache1.clear();
	cacheKeys = await testCache1.keys();
	assert.strictEqual(JSON.stringify(cacheKeys), JSON.stringify([]), `testCache1 returned non-empty set of keys`);

	await new Promise((resolve, reject) => {
		setTimeout(resolve, 2000);
	});

	val = await testCache2.get('val1');
	assert.strictEqual(val, undefined, `testCache2.val1 was still defined after ttl expired`);

	app.context.services.debug(`Passed all subCache tests`);
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
};

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

module.exports = Service;