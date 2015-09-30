// jshint node: true
'use strict';

var sysPath = require('path'),
    anyspawn = require('anyspawn'),
    setup = require('../setup');

anyspawn.spawn('npm run prepublish', function() {
    setup(sysPath.join(__dirname, '..'));
});
