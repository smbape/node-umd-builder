'use strict';

const sysPath = require('path');
const fs = require('fs');
const fcache = require(resolve(sysPath.dirname(require.resolve('brunch/package.json')), 'fcache'));
const cache = new Map();
const toAbsolute = require('path').resolve;

exports = module.exports = fcache;

exports.packageName = 'package.js'

exports.isPackage = function(path) {
    return /(?:^|[\/\\])package\.js$/.test(path);
};

exports.readFile = path => new Promise((resolve, reject) => {
    const absPath = toAbsolute(path);
    if (cache.has(absPath)) {
        resolve(cache.get(absPath));
        return;
    }

    fs.readFile(absPath, (error, data) => {
        if (error) {
            reject(error);
        } else {
            resolve(data);
        }
    });
});

exports.updateCache = path => new Promise((resolve, reject) => {
    const absPath = toAbsolute(path);

    fs.stat(absPath, (error, stats) => {
        if (error) {
            if (cache.has(absPath)) {
                resolve(cache.get(absPath));
            } else {
                reject(error);
            }
            return;
        }

        fs.readFile(absPath, (error, data) => {
            if (error) {
                reject(error);
                return;
            }
            cache.set(absPath, data);
            resolve(data);
        });
    });

});

exports.updateFakeFile = function(path, data) {
    const absPath = toAbsolute(path);
    const status = cache.has(absPath) ? 1 : 0;
    cache.set(absPath, data);
    return status;
};

function resolve(dirname, moduleName) {
    dirname = sysPath.resolve(dirname);
    var parts = dirname.split(/[\\/]/g);
    var index = parts.length;
    var currentFile;

    var err = 1;
    while (err && index !== 0) {
        err = 0;
        currentFile = [parts.slice(0, index--).join(sysPath.sep), 'node_modules', moduleName].join(sysPath.sep);

        try {
            return require.resolve(currentFile);
        } catch ( _err ) {
            err = _err;
        }
    }

    return null;
}