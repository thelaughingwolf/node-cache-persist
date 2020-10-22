const cloneDeep = require('lodash.clonedeep');
const defaultsDeep = require('lodash.defaultsdeep');
const merge = require('lodash.merge');
const log = require('loglevel');
const generateCache = require('./generate-cache');

const baseDefaults = {
	logLevel: 'warn',
	prefix: '',
	engine: 'node-persist',
	engineOpts: {}
};

const NodePersistentCache = (opts) => {
	const defaults = cloneDeep(baseDefaults);
	const npcLog = log.getLogger('npc-main');

	const NPC = {
		log: npcLog,
		engines: require('./engines'),
		config: (configOpts) => {
			if (configOpts !== undefined) {
				if (configOpts.logLevel) {
					NPC.log.setLevel(configOpts.logLevel);
				}
				if (configOpts.testEngines) {
					NPC.engines.toggleTests();
					delete configOpts.testEngines;
				}

				NPC.log.debug(`Merging in new config`, configOpts);
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

	NPC.log.setLevel(defaults.logLevel);

	return NPC;
};

module.exports = NodePersistentCache;