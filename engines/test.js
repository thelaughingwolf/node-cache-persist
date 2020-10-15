const NPC = require('../index');
const test = require('../tests/tape');
//const SuiteRunner = require('../tests/suite-runner');

const testEngine = function(name) {
	const self = this;
	const opts = {};

	let syncCache
	,	asyncCache;

	test(`Test Engine ${name}`, async (t) => {
		console.log(`Test engine with synchronous cache`);

		syncCache = new NPC({
			persist: {
				engine: engineName,
				prefix: `${engineName}-sync-tests`
			}
		});

		t.notEqual(syncCache, undefined, `Failed to create synchronous cache`);

		await syncCache.load();
	});

	const tests = {
		title: `Test Engine ${name}`,
		suite: [
			{	title: `Test engine with synchronous cache`,
				suite: [
					{	title: `should create a new synchronous cache`,
						test: async () => {
							console.log(`Preparing to create a new synchronous cache`);
					
							syncCache = new ncp({
								persist: {
									engine: engineName,
									prefix: `${engineName}-sync-tests`
								}
							});
					
							console.log(`Created the cache:`, syncCache);
					
							assert.notStrictEqual(syncCache, undefined, `No synchronous cache was generated`);
							await syncCache.load();
					
							console.log(`syncCache:`, syncCache.dump());
						}
					},
					{	title: `should set a string value`,
						test: async () => {
							let val = 'foobar';
							syncCache.set('string', val);
							let cached = syncCache.get('string');
							assert.strictEqual(cached, val, `String value was not returned`);
						}
					},
					{	title: `should set an integer value`,
						test: async () => {
							let val = 1;
							syncCache.set('integer', val);
							let cached = syncCache.get('integer');
							assert.strictEqual(cached, val, `Integer value was not returned`);
						}
					},
					{	title: `should set a float value`,
						test: async () => {
							let val = 3.14156;
							syncCache.set('float', val);
							let cached = syncCache.get('float');
							assert.strictEqual(cached, val, `Float value was not returned`);
						}
					},
					{	title: `should set a boolean value`,
						test: async () => {
							let val = true;
							syncCache.set('boolean', val);
							let cached = syncCache.get('boolean')
							assert.strictEqual(cached, val, `Boolean value was not returned`);
						}
					},
					{	title: `should set an array value`,
						test: async () => {
							let val = [ 1, 2, 3 ];
							syncCache.set('array', val);
							let cached = syncCache.get('array');
							assert.strictEqual(JSON.stringify(cached), JSON.stringify(val), `Array value was not returned`);
						}
					},
					{	title: `should set an object value`,
						test: async () => {
							let val = { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] };
							syncCache.set('object', val);
							let cached = syncCache.get('object');
							assert.strictEqual(JSON.stringify(cached), JSON.stringify(val), `Object value was not returned`);
						}
					}
				]
			},
			{	title: `Test engine with asynchronous cache`,
				suite: [
					{	title: `should create a new asynchronous cache`,
						test: async () => {
							console.log(`Preparing to create a new synchronous cache`);
					
							asyncCache = new ncp({
								async: true,
								persist: {
									engine: engineName,
									prefix: `${engineName}-sync-tests`
								}
							});
					
							console.log(`Created the cache:`, syncCache);
					
							assert.notStrictEqual(asyncCache, undefined, `No synchronous cache was generated`);
							await asyncCache.load();
					
							console.log(`asyncCache:`, asyncCache.dump());
						}
					},
					{	title: `should set a string value`,
						test: async () => {
							let val = 'foobar';
							await asyncCache.set('string', val);
							let cached = await asyncCache.get('string');
							assert.strictEqual(cached, val, `String value was not returned`);
						}
					},
					{	title: `should set an integer value`,
						test: async () => {
							let val = 1;
							await asyncCache.set('integer', val);
							let cached = await asyncCache.get('integer');
							assert.strictEqual(cached, val, `Integer value was not returned`);
						}
					},
					{	title: `should set a float value`,
						test: async () => {
							let val = 3.14156;
							await asyncCache.set('float', val);
							let cached = await asyncCache.get('float');
							assert.strictEqual(cached, val, `Float value was not returned`);
						}
					},
					{	title: `should set a boolean value`,
						test: async () => {
							let val = true;
							await asyncCache.set('boolean', val);
							let cached = await asyncCache.get('boolean')
							assert.strictEqual(cached, val, `Boolean value was not returned`);
						}
					},
					{	title: `should set an array value`,
						test: async () => {
							let val = [ 1, 2, 3 ];
							await asyncCache.set('array', val);
							let cached = await asyncCache.get('array');
							assert.strictEqual(JSON.stringify(cached), JSON.stringify(val), `Array value was not returned`);
						}
					},
					{	title: `should set an object value`,
						test: async () => {
							let val = { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] };
							await asyncCache.set('object', val);
							let cached = await asyncCache.get('object');
							assert.strictEqual(JSON.stringify(cached), JSON.stringify(val), `Object value was not returned`);
						}
					}
				]
			}
		]
	};

	/* const suiteRunner = new SuiteRunner(tests);

	runner.suite(``, () => {
		describe(`Testing synchronous version of cache`, () => {
			let syncCache;
			it(``, );

			it(`should set an string value`, () => {
				syncCache.set('string', 'foobar');
				assert.strictEqual(syncCache.get('string'), 'foobar', `String value was not returned`);
			});

			it(`should set an integer value`, () => {
				syncCache.set('integer', 1);
				assert.strictEqual(syncCache.get('integer'), 1, `Integer value was not returned`);
			});

			it(`should set a float value`, () => {
				syncCache.set('float', 3.14156);
				assert.strictEqual(syncCache.get('float'), 3.14156, `Float value was not returned`);
			});

			it(`should set a boolean value`, () => {
				syncCache.set('boolean', true);
				assert.strictEqual(syncCache.get('boolean'), true, `Boolean value was not returned`);
			});

			it(`should set an array value`, () => {
				let val = [ 1, 2, 3 ];
				syncCache.set('array', val);
				assert.strictEqual(JSON.stringify(syncCache.get('array')), JSON.stringify(val), `Array value was not returned`);
			});

			it(`should set an object value`, () => {
				let val = { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] };
				syncCache.set('object', val);
				assert.strictEqual(JSON.stringify(syncCache.get('object')), JSON.stringify(val), `Object value was not returned`);
			});
		});
	});

	return suiteRunner.run(); */
};

module.exports = testEngine;