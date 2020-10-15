const requireMethodOverride = (methodName) => {
	throw new Error(`The engine must implement its own '${methodName}', which must not call super()`);
};

class Engine {
	constructor(opts = {}, cache) {
		this.cache = cache;

		if (!opts.prefix) {
			opts.prefix = '';
		}
	}

	/**
	 * Convert a timestamp to a TTL
	 * Returns undefined if timestamp is falsy or timestamp is in the past
	 * 
	 * @param {number} [ts] - The timestamp in ms
	 * @return {(number|undefined)} - The time until the timestamp in ms; undefined if no ts or ts in past
	 */
	tsToTtl(ts) {
		let now = Date.now()
		,	ttl = (ts && ts > now) ? (ts - now) : undefined;
		return ttl;
	}

	/**
	 * Use prefix provided, if any; this method is not required to be implemented
	 * 
	 * @param {string} prefix - The prefix provided by the top-level cache
	 */
	processPrefix(prefix) {

	}

	/**
	 * Get a value - note that this is unlikely to be used
	 * 
	 * @async
	 * @virtual
	 * @param {string} key - The key to get
	 * @return {*} - The value stored in persistent data, or undefined
	 */
	async get() { requireMethodOverride('get') }

	/**
	 * Set a value
	 * 
	 * @async
	 * @virtual
	 * @param {string} key - The key to set
	 * @param {*} val - The value to store
	 * @param {number} [ttl] - The TTL, in milliseconds
	 * @return {*} - The value stored
	 */
	async set() { requireMethodOverride('set') }

	/**
	 * Delete a value
	 * 
	 * @async
	 * @virtual
	 * @param {string} key - The key to delete
	 * @return {undefined}
	 */
	async del() { requireMethodOverride('del') }

	/**
	 * Update a value's TTL
	 * 
	 * @async
	 * @virtual
	 * @param {string} key - The key to update
	 * @param {number} ttl - The TTL, in milliseconds
	 * @return {(number|undefined)}
	 */
	async ttl() { requireMethodOverride('ttl') }

	/**
	 * Load all previously-persisted records
	 * Should also initialize the engine and will only be called once
	 * 
	 * @typedef {Object} datum
	 * @property {string} key - The key of the entry
	 * @property {*} val - The stored value of the entry
	 * @property {(number|undefined)} ttl - The TTL of the entry, in milliseconds
	 * 
	 * @async
	 * @virtual
	 * @return {datum[]}
	 */
	async load() { requireMethodOverride('load') }

	/**
	 * Clear all records
	 * 
	 * @async
	 * @virtual
	 * @return {boolean} - Always returns true
	 */
	async flush() { requireMethodOverride('flush') }
};

module.exports = Engine;