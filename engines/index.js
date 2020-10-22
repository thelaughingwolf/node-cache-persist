const Engines = {};
const log = require('loglevel');
const npcLog = log.getLogger('npc-main');

let testEngines = false;

// This will register a class, which should have
//   extended the engines/base-class definition
const register = (name, engine) => {
	if (Engines[name]) {
		throw new Error(`Persistent storage engine ${name} is already registered`);
	}

	if (!engine) {
		throw new Error(`No engine supplied`);
	}
	if (!engine instanceof Function) {
		throw new Error(`Engine must be a function that can be called with 'new', like a class`);
	}

	Engines[name] = engine;

	if (testEngines) {
		npcLog.debug(`testEngines is on, so test engine ${name}`);
		testEngine(name);
	}
};

const load = (name, opts, cache) => {
	npcLog.debug(`Loading new ${name} engine:`, opts);
	if (!Engines[name]) {
		throw new Error(`No persistent storage engine ${name} is registered`);
	}

	return new Engines[name](opts, cache);
};

const testEngine = (name) => {
	return require(`./test`)(name).then(() => {
		npcLog.info(`Engine ${name} passed all tests!`);
	}).catch((error) => {
		npcLog.error(`Oh dear, there were failures:`, error);
	});
};

// Register a storage engine interface with a given name
module.exports.register = register;

module.exports.load = load;

module.exports.toggleTests = () => {
	testEngines = true;

	(async () => {
		npcLog.debug(`Testing already-loaded engines`);

		for (let name in Engines) {
			npcLog.debug(`Testing already-loaded engine ${name}`);
			await testEngine(name);
		}

		npcLog.debug(`Done testing already-loaded engines`);
	})().catch(error => {
		npcLog.error(`Output from testing already-loaded engines:`, error);
	});
};
