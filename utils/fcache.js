'use strict';

const sysPath = require('path');
const fs = require('fs');
const resolveFrom = require('./resolveFrom');
const fcache = require(resolveFrom('brunch', 'fcache'));
const cache = new Map();
const toAbsolute = require('path').resolve;

exports = module.exports = fcache;

exports.packageName = 'package.js'
exports.deepackName = 'deepack.js'

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

exports.removeFakeFile = function(path) {
    const absPath = toAbsolute(path);
    if (cache.has(absPath)) {
        cache.delete(absPath);
        return 1;
    }

    return 0;
};