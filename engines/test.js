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
			const testAsyncGetVal = (cache, type, val, cmpFn = 'equal') => {
				let cached = cache.get(type);
				t[cmpFn](cached, val, `Getting a ${type} value from the cache: ${JSON.stringify(cached)}`);
			};
			const testAsyncVal = async (cache, type, val, cmpFn) => {
				await testAsyncSetVal(cache, type, val);
				testAsyncGetVal(cache, type, val, cmpFn);
			};

			// Create asynchronous cache
			asyncCache = await NPC.cache({
				engine: name,
				prefix: `tests/engines/${name}/async`
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
				engine: name,
				prefix: `tests/engines/${name}/async`
			});
			t.ok(asyncCache, `Re-opened cache`);

			// Test all persisted data, including parallel data
			testAsyncGetVal(asyncCache, 'string', 'foobar');
			testAsyncGetVal(asyncCache, 'integer', 42);
			testAsyncGetVal(asyncCache, 'float', 6.023);
			testAsyncGetVal(asyncCache, 'boolean', false);
			testAsyncGetVal(asyncCache, 'array', [ 1, 2, 3 ], 'deepEqual');
			testAsyncGetVal(asyncCache, 'object', { foo: 'bar', uhoh: 'attention !', num: [ 1, 2, 3 ] }, 'deepEqual');
			testAsyncGetVal(asyncCache, 'parallel', lastAsyncParallel, 'deepEqual');

			// Test closing the cache
			t.doesNotThrow(asyncCache.flushAll, undefined, `Flushed all data from cache`);

			// Test multiple simultaneous caches
			let multicache = [
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi1`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi2`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi3`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi4`
				}),
			];

			let multival = [ 'one', 2, 'THREE', 4.0 ];

			await testAsyncVal(multicache[0], 'multi-val0', multival[0]);
			await testAsyncVal(multicache[1], 'multi-val1', multival[1]);
			await testAsyncVal(multicache[2], 'multi-val2', multival[2]);
			await testAsyncVal(multicache[3], 'multi-val3', multival[3]);

			await multicache[0].close();
			t.pass(`Closed multicache[0]`);
			await multicache[1].close();
			t.pass(`Closed multicache[1]`);
			await multicache[2].close();
			t.pass(`Closed multicache[2]`);
			await multicache[3].close();
			t.pass(`Closed multicache[3]`);

			// Restore the multicaches
			multicache = [
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi1`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi2`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi3`
				}),
				await NPC.cache({
					engine: name,
					prefix: `tests/engines/${name}/multi4`
				}),
			];

			testAsyncGetVal(multicache[0], 'multi-val0', multival[0]);
			testAsyncGetVal(multicache[1], 'multi-val1', multival[1]);
			testAsyncGetVal(multicache[2], 'multi-val2', multival[2]);
			testAsyncGetVal(multicache[3], 'multi-val3', multival[3]);

			t.end();
		});

		test.onFailure(reject);

		test.onFinish(resolve);
	});
};

module.exports = testEngine;