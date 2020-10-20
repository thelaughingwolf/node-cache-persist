const NPC = require('../index')();
const test = require('../tests/tape');
const log = require('loglevel');
//const SuiteRunner = require('../tests/suite-runner');

const testEngine = function(name) {
	const testLog = log.getLogger(`test-engine-${name}`);
	testLog.setLevel('error');

	const self = this;
	const opts = {};

	return new Promise((resolve, reject) => {
		let asyncCache;

		test(`Test Engine ${name}`, async (t) => {
			t.pass(`Test engine with asynchronous cache`);

			// Async helper methods
			const testAsyncSetVal = async (cache, type, val) => {
				t.ok(await cache.set(type, val), `Setting cache with a ${type} value: ${JSON.stringify(val)}`);
			};
			const testAsyncGetVal = async (cache, type, val, cmpFn = 'equal') => {
				let cached = await cache.get(type);
				t[cmpFn](cached, val, `Getting a ${type} value from the cache: ${JSON.stringify(cached)}`);
			};
			const testAsyncVal = async (cache, type, val, cmpFn) => {
				await testAsyncSetVal(cache, type, val);
				await testAsyncGetVal(cache, type, val, cmpFn);
			};

			// Create asynchronous cache
			asyncCache = await NPC.cache({
				async: true,
				persist: {
					engine: name,
					prefix: `tests/engines/${name}/async`
				}
			});
			t.notEqual(asyncCache, undefined, `Created asynchronous cache`);

			// Test all datatypes
			await testAsyncVal(asyncCache, 'string', 'foobar');
			await testAsyncVal(asyncCache, 'integer', 42);
			await testAsyncVal(asyncCache, 'float', 6.023);
			await testAsyncVal(asyncCache, 'boolean', false);
			await testAsyncVal(asyncCache, 'array', [ 1, 2, 3 ], 'deepEqual');
			await testAsyncVal(asyncCache, 'object', { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] }, 'deepEqual');

			// Test TTL
			await asyncCache.set('ttl-test', 'hullo', 0.05);
			t.equal('hullo', asyncCache.get('ttl-test'), 'Placed a value in cache with a TTL of 0.05 seconds');
			await new Promise((resolve) => { setTimeout(resolve, 30)});
			t.equal('hullo', asyncCache.get('ttl-test'), 'Cache still has value');
			await new Promise((resolve) => { setTimeout(resolve, 30)});
			t.equal(undefined, asyncCache.get('ttl-test'), 'Cached value has been automatically cleared');

			// Test setting async parallel
			let lastAsyncParallel = { 'hello': 'there', 'very': [ 'long', 'value', 42, 3.14156] };
			let asyncParallelActions = [
				testAsyncSetVal(asyncCache, 'parallel', 1),
				testAsyncSetVal(asyncCache, 'parallel', 'hello'),
				testAsyncSetVal(asyncCache, 'parallel', true),
				testAsyncSetVal(asyncCache, 'parallel', lastAsyncParallel), // <-- This is the value that should be set
			];
			await Promise.all(asyncParallelActions);

			// Test taking a val
			await asyncCache.set('takable', 'temporary val');
			await testAsyncVal(asyncCache, 'takable', 'temporary val');
			val = await asyncCache.take('takable');
			t.equal(val, 'temporary val', 'Taking a val returns the val');
			t.equal(undefined, asyncCache.get('takable'), 'Taking a val removes it from the cache');

			// Test merging values
			await asyncCache.merge('merge-test', {a: 'a', b: 'two', c: 3}, 'Merging a missing value sets it');
			val = asyncCache.get('merge-test');
			t.deepEqual(val, {a: 'a', b: 'two', c: 3}, 'Merged-in value is unchanged');
			await asyncCache.merge('merge-test', {a: 'A', c: [ 1, 2, 3 ]}, 'Merging an object into the val updates the saved val');
			val = asyncCache.get('merge-test');
			t.deepEqual(val, {a: 'A', b: 'two', c: [ 1, 2, 3 ]}, 'Stored value is now merged');

			// Test closing & restoring the cache
			t.doesNotThrow(asyncCache.close, undefined, `Closed cache to test persistence`);
			asyncCache = await NPC.cache({
				async: true,
				persist: {
					engine: name,
					prefix: `tests/engines/${name}/async`
				}
			});
			t.ok(asyncCache, `Re-opened cache`);

			// Test all persisted data, including parallel data
			await testAsyncGetVal(asyncCache, 'string', 'foobar');
			await testAsyncGetVal(asyncCache, 'integer', 42);
			await testAsyncGetVal(asyncCache, 'float', 6.023);
			await testAsyncGetVal(asyncCache, 'boolean', false);
			await testAsyncGetVal(asyncCache, 'array', [ 1, 2, 3 ], 'deepEqual');
			await testAsyncGetVal(asyncCache, 'object', { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] }, 'deepEqual');
			await testAsyncGetVal(asyncCache, 'parallel', lastAsyncParallel, 'deepEqual');

			// Test closing the cache
			t.doesNotThrow(asyncCache.flushAll, undefined, `Flushed all data from cache`);

			t.end();
		});

		test.onFailure(reject);

		test.onFinish(resolve);
	});

	const tests = {
		title: `Test Engine ${name}`,
		suite: [
			{	title: `Test engine with synchronous cache`,
				suite: [
					{	title: `should create a new synchronous cache`,
						test: async () => {
							testLog.info(`Preparing to create a new synchronous cache`);

							syncCache = new ncp({
								persist: {
									engine: engineName,
									prefix: `${engineName}-sync-tests`
								}
							});

							testLog.info(`Created the cache:`, syncCache);

							assert.notStrictEqual(syncCache, undefined, `No synchronous cache was generated`);
							await syncCache.load();

							testLog.info(`syncCache:`, syncCache.dump());
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
							testLog.info(`Preparing to create a new synchronous cache`);

							asyncCache = new ncp({
								async: true,
								persist: {
									engine: engineName,
									prefix: `${engineName}-sync-tests`
								}
							});

							testLog.info(`Created the cache:`, syncCache);

							assert.notStrictEqual(asyncCache, undefined, `No synchronous cache was generated`);
							await asyncCache.load();

							testLog.info(`asyncCache:`, asyncCache.dump());
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