const Cache = require('./index');
const assert = require('assert');

const runCacheTest = async (opts) => {
	const cache = new Cache(opts);

	if (cache.load && cache.load.then) {
		await cache.load;
	}

	let contents = cache.dump();
	console.log(`Cached data at test start:`, contents);

	await cache.set('test', 'value');

	let val = cache.get('test');
	assert.strictEqual(val, 'value', `Incorrect value stored in synchronous cache`);

	val = cache.get('missing');
	assert.strictEqual(val, undefined, `Value for 'missing' was never set, yet returned non-undefined`);

	await cache.set('ttlVal', 'yes', 0.05);
	val = cache.get('ttlVal');
	assert.strictEqual(val, 'yes', `Incorrect value stored for ttlVal`);

	await new Promise((resolve, reject) => { setTimeout(resolve, 60); });

	val = cache.get('ttlVal');
	assert.strictEqual(val, undefined, `ttlVal retained after 50ms`);

	let obj = {hello: 'my', darling: {my: {ragtime: 'gal'}}};
	await cache.set('object', obj);

	val = cache.get('object');
	assert.strictEqual(JSON.stringify(val), JSON.stringify(obj), `Stored object does not match original object`);

	await cache.merge('object', {hello: 'your', darling: {my: {stinky: 'friend'}}});
	val = cache.get('object');
	assert.strictEqual(JSON.stringify(val), '{"hello":"your","darling":{"my":{"ragtime":"gal","stinky":"friend"}}}', `Merged object does not contain expected keys`);

	await cache.set('long-ttl', 'value', 10);

	contents = cache.dump();
	console.log(`Cached data at test end:`, contents);

	return contents;
};

(async () => {
	// Test the defaults
	await runCacheTest({});

	// Test an asynchronous, in-memory cache (wat?)
	await runCacheTest({
		async: true
	});

	// Test an asynchronous, in-memory cache with persistence!
	await runCacheTest({
		async: true,
		prefix: 'persistent-cache',
		persist: true
	});

	// The same directory may not be re-used
	let persistenceError = null;
	try {
		await runCacheTest({
			async: true,
			prefix: 'persistent-cache',
			persist: true
		});
	} catch (error) {
		persistenceError = error;
	}
	assert.notStrictEqual(persistenceError, null, `Duplicate directory was permitted`);

	await runCacheTest({
		prefix: 'sync-persistence',
		persist: true
	});

	console.log(`All tests passed`);
})().catch(error => {
	console.error(`Error running tests:`, error);
});

/* const testCache1 = Service.generateSubcache('test1.');
const testCache2 = Service.generateSubcache('test2.');

// Ensure testing with nothing present
await testCache1.clear();
await testCache2.clear();

await testCache1.set('val1', 'test1val', { ttl: 1500 });

let val = await testCache1.get('val1');
assert.strictEqual(val, 'test1val', `testCache1.val1 was undefined`);

val = await testCache2.get('val1');
assert.strictEqual(val, undefined, `testCache2.val1 was defined`);

await testCache2.set('val1', 'test2val', { ttl: 1500 });

val = await testCache1.get('val1');
assert.strictEqual(val, 'test1val', `testCache1.val1 was updated`);

await testCache2.set('val2', 'test2val2', { ttl: 1500 });

let cacheKeys = await testCache1.keys();
assert.strictEqual(JSON.stringify(cacheKeys), JSON.stringify(['val1']), `testCache1 returned invalid set of keys`);

let cacheValues = await (testCache1.values());
assert.strictEqual(JSON.stringify(cacheValues), JSON.stringify(['test1val']), `testCache1 returned invalid set of keys`);

await Promise.all([
	testCache1.set('concurrent-1', 'short-data'),
	testCache1.set('concurrent-1', 'longer-data'),
	testCache1.set('concurrent-1', {data: 'very long, much longer than you would have expected, but not actually that long in the end I suppose'}),
	testCache1.set('concurrent-1', 1105),
]);

val = await testCache1.get('concurrent-1');
// There isn't even a value this *should* have, since we're doing concurrent operations

await testCache1.clear();
cacheKeys = await testCache1.keys();
assert.strictEqual(JSON.stringify(cacheKeys), JSON.stringify([]), `testCache1 returned non-empty set of keys`);

await new Promise((resolve, reject) => {
	setTimeout(resolve, 2000);
});

val = await testCache2.get('val1');
assert.strictEqual(val, undefined, `testCache2.val1 was still defined after ttl expired`);

app.context.services.debug(`Passed all subCache tests`); */