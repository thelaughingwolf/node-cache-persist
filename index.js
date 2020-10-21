const cloneDeep = require('lodash.clonedeep');
const defaultsDeep = require('lodash.defaultsdeep');
const merge = require('lodash.merge');
const log = require('loglevel');
const generateCache = require('./generate-cache');

log.setDefaultLevel('warn');

const baseDefaults = {
	logLevel: 'warn',
	prefix: '',
	engine: 'node-persist',
	engineOpts: {}
};

const NodePersistentCache = (opts) => {
	const defaults = cloneDeep(baseDefaults);

	const NPC = {
		engines: require('./engines'),
		config: (configOpts) => {
			if (configOpts !== undefined) {
				if (configOpts.testEngines) {
					NPC.engines.toggleTests();
					delete configOpts.testEngines;
				}

				log.debug(`Merging in new config`, configOpts);
				merge(defaults, configOpts);
			}

			return cloneDeep(defaults);
		},
		cache: async (cacheOpts) => {
			if (typeof cacheOpts === 'string') {
				cacheOpts = {
					prefix: cacheOpts
				};
			}

			defaultsDeep(cacheOpts, defaults);

			const newCache = await generateCache(cacheOpts);

			return newCache;
		}
	};

	if (opts !== undefined) {
		NPC.config(opts);
	}

	return NPC;
};

module.exports = NodePersistentCache;