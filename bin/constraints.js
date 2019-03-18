#!/usr/bin/env node

const {concierge} = require('@manaflair/concierge');
const {join} = require('path');

concierge.directory(join(__dirname, '..', 'dist', 'commands'), true, /\.js$/);

// process.argv0 is 'node', process.argv[0] is the absolute path to the node executable
// process.argv[1] is the actual path to the constraints.js file
const argv0 = process.argv[1];

concierge.runExit(argv0, process.argv.slice(2));
