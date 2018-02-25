// jshint node: true
"use strict";

const coffeescript = require("coffeescript");
const fs = require("fs");
const sysPath = require("path");
const mkdirp = require("mkdirp");
const explore = require("fs-explorer").explore;
const rimraf = require("rimraf");
const src = sysPath.join(__dirname, "..", "src");
const lib = sysPath.join(__dirname, "..", "lib");

rimraf(lib, function(err) {
    if (err) {
        throw err;
    }

    explore(src, function(path, stats, next) {
        const dst = sysPath.join(lib, sysPath.relative(src, path));

        mkdirp(sysPath.dirname(dst), function(err) {
            if (err) {
                next(err);
                return;
            }

            if (/\.coffee$/.test(path)) {
                fs.readFile(path, function(err, data) {
                    if (err) {
                        next(err);
                        return;
                    }

                    const compiled = coffeescript.compile(data.toString(), {
                        bare: true,
                        header: false
                    });

                    fs.writeFile(dst.replace(/\.coffee$/, ".js"), compiled, next);
                });
                return;
            }

            const readable = fs.createReadStream(path);
            const writable = fs.createWriteStream(dst);

            readable.pipe(writable);
            writable.on("finish", next);
        });
    }, function(err) {
        if (err) {
            throw err;
        }
    });
});