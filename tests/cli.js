#!/usr/bin/env node
const log = require('loglevel');
const { Command } = require('commander');
const program = new Command();
const npcLog = log.getLogger('npc-main');

const parseEngines = (engineInput) => {
	const engines = {
		"npc-node-persist": null
	};

	let engineList = [ ];
	if (engineInput === 'all') {
		engineList = Object.keys(engines);
	} else {
		engineList = engineInput.split(/\s,\s|\s;\s/);
	}

	npcLog.info(`Will attempt to test ${engineInput === 'all' ? 'all known' : 'these specified'} engines: ${engineList.join(' ')}`);

	if (!engineList.length) {
		throw new Error(`No engines specified to test`);
	}

	for (let i = 0; i < engineList.length; ++i) {
		let engineName = engineList[i];
		try {
			engines[engineName] = require(engineName);
		} catch (err) {
			npcLog.error(`No '${engineName}' engine installed`);
		}
	}

	return engines;
};

program
	.storeOptionsAsProperties(false)
	.version('1.0.0')
	.option("-e, --engines <list>", "Comma-delimited list of engines to test, or 'all' to test all installed", parseEngines, 'all')
	.parse(process.argv);

(async () => {
	const NPC = require('../index')({
		testEngines: true
	});

	const programOpts = program.opts();

	for (let key in programOpts.engines) {
		const engine = programOpts.engines[key];
		if (engine !== null) {
			NPC.engines.register(key, programOpts.engines[key]);
		}
	}
})().catch((error) => {
	npcLog.error(error);
});