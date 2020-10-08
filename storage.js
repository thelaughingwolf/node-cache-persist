// Load the selected backing program here
// Supported options:
//    quick.db
//    node-persist
const generateStorage = async (engine, opts) => {
	const Storage = {};

	if (engine === 'node-persist') {
		const Engine = require('node-persist');

		Storage.onSet = async (key, val) => {
			let ttl = 0;
			return Engine.setItem(key, val)
		};
	}

	return Storage;
};

module.exports = generateStorage;