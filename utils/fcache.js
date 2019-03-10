"use strict";

const fs = require("fs");
const limitRetry = require("./limitRetry");
const resolveFrom = require("./resolveFrom");
const fcache = require(resolveFrom("brunch", "fcache"));
const {resolve: toAbsolute, sep} = require("path");

exports = module.exports = fcache;

const cache = new Map();

const retryOptions = {
    delay: 300, // handle windows buffer.length === 0
    limit: 3,
};

const readFile = (...args) => {
    const path = args[0];
    exports.lock(path, release => {
        const last = args.length - 1;
        const cb = args[last];

        args[last] = (error, data) => {
            release();

            // consider an empty file as a reading error
            if (!error && data.length === 0) {
                error = new Error("No data");
                error.code = "NO_DATA";
            }

            cb(error, data);
        };

        fs.readFile(...args);
    });
};

exports.packageName = "package.js";
exports.deepackName = "deepack.js";

exports.isFakeFile = path => {
    const {packageName, deepackName} = exports;
    return path === packageName || path === deepackName || path.endsWith(sep + packageName) || path.endsWith(sep + deepackName);
};

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

const hasProp = Object.prototype.hasOwnProperty;

class ResourceManager {
    constructor(onfinish) {
        this.next = this.next.bind(this);
        this.callbacks = [];
        this.looping = false;
        this.running = false;
        this.onfinish = onfinish;
    }

    replenish() {
        if (this.looping || this.running) {
            return;
        }

        this.looping = true;

        let cb;

        while (!this.running && this.callbacks.length !== 0) {
            cb = this.callbacks.shift();
            this.running = true;
            cb(this.next);
        }

        this.looping = false;

        if (!this.running && this.callbacks.length === 0) {
            this.onfinish();
        }
    }

    next() {
        this.running = false;
        this.replenish();
    }

    lock(cb) {
        this.callbacks.push(cb);
        this.replenish();
    }
}

const resources = {};

exports.lock = (path, cb) => {
    if (!hasProp.call(resources, path)) {
        resources[path] = new ResourceManager(() => {
            delete resources[path];
        });
    }

    resources[path].lock(cb);
};
