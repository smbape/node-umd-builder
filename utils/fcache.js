'use strict';

var fs = require('fs');
var fcache = require('brunch/node_modules/fcache');
var ver = require('brunch/node_modules/fcache/package.json').version.split('.').slice(0, 2).join('.');
var key = '_fcache_' + ver;
var cache = global[key] || (global[key] = Object.create(null));
var toAbsolute = require('path').resolve;
var hasProp = Object.prototype.hasOwnProperty;

// updateCache = fcache.updateCache;

exports = module.exports = fcache;

exports.packageName = 'package.js'

exports.isPackage = function(path) {
    return /(?:^|[\/\\])package\.js$/.test(path);
};

exports.readFile = function(path, callback) {
    var absPath = toAbsolute(path);
    if (hasProp.call(cache, absPath)) {
        callback(undefined, cache[absPath]);
    } else {
        fs.readFile(absPath, 'utf-8', callback);
    }
};


exports.updateCache = function(path, callback) {
    var absPath = toAbsolute(path);

    if (!callback) {
        callback = Function.prototype;
    }

    if (exports.isPackage(absPath) && !existsSync(absPath) && hasProp.call(cache, absPath)) {
        callback(void 0, cache[absPath]);
        return;
    }

    fs.readFile(absPath, 'utf-8', function(error, source) {
        if (error) {
            return callback(error);
        }
        cache[absPath] = source;
        callback(void 0, source);
    });
};

exports.updateFakeFile = function(path, content) {
    var absPath = toAbsolute(path);
    var status = hasProp.call(cache, absPath) ? 1 : 0;
    cache[absPath] = content;
    return status;
};

function existsSync(path) {
    try {
        fs.statSync(path);
        return true;
    } catch (err) {
        return false;
    }
}