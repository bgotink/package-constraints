#!/usr/bin/env node

const {concierge} = require('@manaflair/concierge');
const {join} = require('path');

concierge.directory(join(__dirname, '..', 'dist', 'commands'), true, /\.js$/);

concierge.runExit(process.argv0, process.argv.slice(2));
