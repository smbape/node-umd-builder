"use strict";

const fs = require("fs");
const limitRetry = require("./limitRetry");
const resolveFrom = require("./resolveFrom");
const fcache = require(resolveFrom("brunch", "fcache"));
const cache = new Map();
const {resolve: toAbsolute, sep} = require("path");

const readFile = (...args) => {
    const last = args.length - 1;
    const cb = args[last];

    args[last] = (error, data) => {
        // consider an empty file as a reading error
        if (!error && data.length === 0) {
            error = new Error("No data");
            error.code = "NO_DATA";
        }

        cb(error, data);
    };

    fs.readFile(...args);
};

const retryOptions = {
    delay: 15,
    limit: 3,
};

exports = module.exports = fcache;

exports.packageName = "package.js";
exports.deepackName = "deepack.js";

exports.isFakeFile = path => {
    const {packageName, deepackName} = exports;
    return path === packageName || path === deepackName || path.endsWith(sep + packageName) || path.endsWith(sep + deepackName);
}

exports.readFile = path => new Promise((resolve, reject) => {
    const absPath = toAbsolute(path);
    if (cache.has(absPath)) {
        resolve(cache.get(absPath));
        return;
    }

    limitRetry(readFile, retryOptions, absPath, (error, data) => {
        if (error && error.code !== "NO_DATA") {
            reject(error);
        } else {
            resolve(data);
        }
    });
});

exports.updateCache = path => new Promise((resolve, reject) => {
    const absPath = toAbsolute(path);

    if (exports.isFakeFile(absPath) && cache.has(absPath)) {
        resolve(cache.get(absPath));
        return;
    }

    limitRetry(readFile, retryOptions, absPath, (error, data) => {
        if (error && error.code !== "NO_DATA") {
            reject(error);
            return;
        }
        cache.set(absPath, data);
        resolve(data);
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