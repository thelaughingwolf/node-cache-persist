// Creates a Mocha test framework based on config
// Expects 
const { Suite, Test, Runner, reporters } = require('mocha');

const processEntries = (parentSuite, entries) => {
	entries.forEach((entry) => {
		processEntry(parentSuite, entry);
	});
};
const processEntry = (parentSuite, entry) => {
	if (entry.suite) {
		let newSuite = Suite.create(parentSuite, entry.title);
		processEntries(newSuite, entry.suite);
	} else if (entry.test) {
		parentSuite.addTest(new Test(entry.title, entry.test));
	}
};

const generateSuiteRunner = function(config) {
	const self = this;

	const TestSuite = new Suite(config.title);

	processEntries(TestSuite, config.suite);

	const runner = new Runner(TestSuite);
	const reporter = new reporters.Spec(runner);

	self.run = () => {
		return new Promise((resolve, reject) => {
			runner.run((failures) => {
				if (failures) {
					reject(failures);
				}
				resolve(0);
			})
		});
	};

	return self;
};

module.exports = generateSuiteRunner;