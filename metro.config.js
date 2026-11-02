const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Local server secrets are never client modules, including development graphs.
config.resolver.blockList = [/[\\/]\.env(?:\.[^\\/]*)?$/];

module.exports = config;
