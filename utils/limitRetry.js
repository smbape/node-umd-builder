"use strict";

const eachOfLimit = require("async/eachOfLimit");

const limitRetry = (fn, options, ...args) => {
    if (typeof options === "number") {
        options = {
            limit: options
        };
    }

    const {delay} = options;

    let {limit} = options;
    if (limit == null) {
        limit = 1;
    }

    const last = args.length - 1;
    const cb = args[last];

    let lastError = true;
    let lastResult = [];

    const iterable = {};
    iterable[Symbol.iterator] = () => {
        return {
            next: () => {
                return {
                    value: null,
                    done: !lastError || limit-- === 0
                };
            }
        };
    };

    eachOfLimit(iterable, 1, (value, key, next) => {
        args[last] = (err, ...res) => {
            lastError = err;
            lastResult = res;

            if (err) {
                if (delay > 0) {
                    setTimeout(next, delay);
                } else {
                    setImmediate(next);
                }
            } else {
                next();
            }
        };

        fn(...args);
    }, err => {
        cb(lastError, ...lastResult);
    });
};

module.exports = limitRetry;
