# node-persistent-cache

This package seeks to provide a drop-in enhancement of [`node-cache`](https://npmjs.com/package/node-cache) to persist data across app restarts. It exposes all of `node-cache`'s methods directly, and can actually be used *exactly* like `node-cache` as a pure in-memory cache (but if you're installing a module with `-persist` in the title, you probably are interested in persistence). It is backed by [`node-persist`](https://www.npmjs.com/package/node-persist) as the default persistence engine, but is easily extensible with any persistent storage engine you might prefer.

## Configuration

The configuration is the same as [node-cache](https://npmjs.com/package/node-cache#options), with a couple of extras:
* `async`: *(default: `false`)* Control whether the cache is synchronous, exactly like `node-cache`, or asynchronous.
	**Note:**
	* `false`: Cache is synchronous; the persistence engine attaches listeners to `node-cache` and updates data whenever `set`, `del`, `expired`, or `flush` fire.
		* **PRO** Works just like `node-cache`; data is restored when the app restarts.
		* **CON** Data is not persisted asynchronously, so persisted data may not match cached data.
	* `true`: Cache is asynchronous; methods that update cached data do not return until the persistence engine has stored them.
		* **PRO** Persisted data guaranteed to be in sync with cached data.
		* **CON** Behavior does not match `node-cache`, may require refactoring.
* `persist`: *(default: `null`)* Options passed to persistence engine; if falsy, cache does not persist.
	* `persist.engine`: *(default: `"node-persist"`)* The name of the engine to use to persist data. Engine must have been registered first; see below.
	* `persist.prefix`: *(default: `""`)* Prefix to apply to every key. For example, `node-persist` prepends `prefix` to the directory so multiple caches may be used without danger of collision. Not all persistence engines use this feature.
	* `persist.opts`: *(default: `{}`)* Options to pass to the selected persistence engine.

Note that using both `persist` and `useClones: false` will cause a warning, as data loaded from a backup cache into `node-cache` will, by definition, be cloned data.

## Storage Engines

By default, `node-persistent-cache` uses `node-persist` as the backing persistence engine, but any engine can be registered with the `engines` object. See [`engines/base-class`](https://github.com/thelaughingwolf/node-persistent-cache/blob/master/engines/base-class.js) for the base class, and see [`engines/node-persist`](https://github.com/thelaughingwolf/node-persistent-cache/blob/master/engines/node-persist.js) for the `node-persist` implementation. Anything that implements the methods in `base-class` and is `new`able will work with the storage layer.

### Example

~~~
const npc = require('node-persistent-cache');
const engine = function(engineOpts) {
	const self = this;
	.
	.
	.
	return self;
};
npc.engines.register('my-custom-engine', engine);
~~~