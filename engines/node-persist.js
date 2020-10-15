const nodePersist = require('node-persist');
const Bottleneck = require('bottleneck');
const Engine = require('./base-class');
const { defaultsDeep } = require('lodash');
const { join: joinPath } = require('path');

// Prevent more than one node-persist from using the same dir
const dirs = {};

class NodePersist extends Engine {
	#engine;
	#limiter;
	#defaultOpts = {
		dir: `.node-cache-persist/storage`
	};

	constructor(opts, cache) {
		super(opts, cache);

		defaultsDeep(opts, this.#defaultOpts);

		// This will allow node-persist to provide multiple distinct caches
		//   without collisions
		if (opts.prefix) {
			opts.dir = joinPath(opts.dir, opts.prefix);
		}

		if (dirs[opts.dir]) {
			throw new Error(`Cannot re-use directory ${opts.dir}; use prefix to allow multiple node-persist instances`);
		}

		this.#engine = nodePersist.create({
			dir: opts.dir
		});
		this.#limiter = new Bottleneck({
			maxConcurrent: 1
		});

		dirs[opts.dir] = this;
	}

	/**
	 * Define how a single stored datum should be returned when loaded
	 * 
	 * @typedef {Object} datum
	 * @property {string} key - The key of the entry
	 * @property {*} val - The stored value of the entry
	 * @property {(string|undefined)} ttl - The TTL of the entry, in milliseconds
	 */

	/**
	 * Get a value - note that this is unlikely to be used
	 * 
	 * @async
	 * @param {string} key - The key to get
	 * @return {*} - The value stored in persistent data, or undefined
	 */
	async get(key) {
		return this.#limiter.schedule(this.#engine.getItem.bind(this.#engine), key);
	}

	/**
	 * Set a value
	 * 
	 * @async
	 * @param {string} key - The key to set
	 * @param {*} val - The value to store
	 * @param {number} [ttl] - The TTL, in milliseconds
	 * @return {*} - The value stored
	 */
	async set(key, val, ttl) {
		await this.#limiter.schedule(this.#engine.updateItem.bind(this.#engine), key, val, { ttl });

		return val;
	}

	/**
	 * Delete a value
	 * 
	 * @async
	 * @param {string} key - The key to delete
	 * @return {undefined}
	 */
	async del(key) {
		return this.#limiter.schedule(this.#engine.removeItem.bind(this.#engine), key);
	}

	/**
	 * Update a value's TTL
	 * 
	 * @async
	 * @param {string} key - The key to update
	 * @param {number} ttl - The TTL, in milliseconds
	 * @return {(number|undefined)}
	 */
	async ttl(key, ttl) {
		// node-persist does not expose a way to set a ttl,
		//   so we have to re-retrieve the value and re-set the datum
		let val = await this.cache.get(key);
		let result = undefined;
		if (val !== undefined) {
			await this.set(key, val, ttl);
		}

	}

	/**
	 * Load all previously-persisted records
	 * 
	 * @typedef {Object} datum
	 * @property {string} key - The key of the entry
	 * @property {*} val - The stored value of the entry
	 * @property {(number|undefined)} ttl - The TTL of the entry, in milliseconds
	 * 
	 * @async
	 * @return {datum[]}
	 */
	async load() {
		await this.#engine.init();

		let result = [ ];

		await this.#engine.forEach((datum) => {
			// Engine.forEach returns all data without inspecting ttl
			// That means it may return expired data!
			// So check that TTL
			if (!datum.ttl || Date.now() < datum.ttl) {
				// Although both node-persist and node-cache store ms timestamps,
				//   node-cache *sets* TTLs in seconds
				// node-persist sets TTLs in milliseconds
				let ttl = this.tsToTtl(datum.ttl);
				if (ttl) {
					ttl /= 1000;
				}
				result.push({key: datum.key, val: datum.value, ttl });
			}
		});

		return result;
	}

	/**
	 * Clear all records
	 * 
	 * @async
	 * @return {boolean} - Always returns true
	 */
	async flush() {
		await this.#limiter.schedule(this.#engine.clear.bind(this.#engine));
		return true;
	}
};

module.exports = NodePersist;