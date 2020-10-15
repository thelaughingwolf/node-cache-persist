const Engines = {};
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
		testEngine(name);
	}
};
const load = (name, opts, cache) => {
	if (!Engines[name]) {
		throw new Error(`No persistent storage engine ${name} is registered`);
	}

	return new Engines[name](opts, cache);
};

const testEngine = (name) => {
	return require(`./test`)(name).then(() => {
		console.log(`Passed all tests!`);
	}).catch((failures) => {
		console.error(`Oh dear, there were ${failures} failure${failures===1?'':'s'}`);
	});
};

// Register a storage engine interface with a given name
module.exports.register = register;

module.exports.load = load;

module.exports.toggleTests = () => {
	testEngines = true;

	(async () => {
		console.log(`Testing already-loaded engines`);

		for (let name in Engines) {
			await testEngine(name);
		}
	})().catch(error => {
		console.error(`Output from testing already-loaded engines:`, error);
	});
};

// Register the default engine, node-persist
register('node-persist', require('./node-persist'));