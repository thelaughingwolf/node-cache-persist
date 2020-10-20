# node-persistent-cache

This package backs [`node-cache`](https://npmjs.com/package/node-cache) with a storage engine to persist data across app restarts. It exposes all of `node-cache`'s methods directly. It is backed by [`node-persist`](https://www.npmjs.com/package/node-persist) as the default persistence engine, but is easily extensible with any persistent storage engine you might prefer.

## Basic Usage

Call `node-persistent-cache`, setting default options. `await new NPC.cache(opts)`. Enjoy!

~~~
const NPC = require('node-persistent-cache');

const cache = await NPC.cache({
	persist: true
});

cache.set('key', 'original value');
cache.get('key'); // 'original value'

// Later . . .
cache.set('key', 'new value');

/* - - - app crashes or is restarted - - - */

const NPC = require('node-persistent-cache');
.
.
.
cache.get('key'); // 'new value'
~~~

## Configuration

### Configuring a New Cache

The configuration is the same as [node-cache](https://npmjs.com/package/node-cache#options), with a couple of extras:
* `async`: *(default: `false`)* Control whether the cache is synchronous, exactly like `node-cache`, or asynchronous.
	**Note:**
	* `false`: Cache is synchronous; the persistence engine attaches listeners to `node-cache` and updates data whenever `set`, `del`, `expired`, or `flush` fire.
		* **PRO** Works just like `node-cache`; data is restored when the app restarts.
		* **CON** Data is not persisted asynchronously, so persisted data may not match cached data.
	* `true`: Cache is asynchronous; methods that update cached data do not return until the persistence engine has stored them.
		* **PRO** Persisted data guaranteed to be in sync with cached data.
		* **CON** Behavior does not match `node-cache`, may require refactoring.
* `persist`: *(default: `true`)* Options passed to persistence engine. If falsy, cache does not persist. If `true`, use the defaults below.
	* `persist.engine`: *(default: `"node-persist"`)* The name of the engine to use to persist data. Engine must have been registered first; see below.
	* `persist.prefix`: *(default: `""`)* Prefix to apply to every key. For example, `node-persist` prepends `prefix` to the directory so multiple caches may be used without danger of collision. Not all persistence engines use this feature.
	* `persist.opts`: *(default: `{}`)* Options to pass to the selected persistence engine.

Note that using both `persist` and `useClones: false` will cause a warning, as data loaded from a backup cache into `node-cache` will, by definition, be cloned data.

### Configuring Cache Defaults

Just call `NPC()` to set defaults. The options are exactly like those passed to a new cache.

## Storage Engines

By default, `node-persistent-cache` uses `node-persist` as the backing persistence engine, but any engine can be registered with the `engines` object. See [`engines/base-class`](https://github.com/thelaughingwolf/node-persistent-cache/blob/master/engines/base-class.js) for the base class, and see [`engines/node-persist`](https://github.com/thelaughingwolf/node-persistent-cache/blob/master/engines/node-persist.js) for the `node-persist` implementation. Anything that implements the methods in `base-class` and is `new`able will work with the storage layer.

### Example

~~~
const NPC = require('node-persistent-cache');
const engine = function(engineOpts) {
	const self = this;
	.
	.
	.
	return self;
};
NPC.engines.register('my-custom-engine', engine);
const cache = new NPC.cache({
	persist: {
		engine: 'my-custom-engine'
	}
});
~~~