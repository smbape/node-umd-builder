// jshint node: true
'use strict';

var sysPath = require('path'),
    anyspawn = require('anyspawn'),
    setup = require('../setup');

require('fs').readdir('lib', function(err) {
    if (err) {
        anyspawn.spawn('npm run prepublish', function(err) {
            if (err) throw err;
            setup(sysPath.join(__dirname, '..'));
        });
    }
});