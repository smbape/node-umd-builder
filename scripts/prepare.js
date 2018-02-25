// jshint node: true
'use strict';

var coffeescript = require('coffee-script'),
    fs = require('fs'),
    sysPath = require('path'),
    mkdirp = require('mkdirp'),
    explore = require('fs-explorer').explore,
    rimraf = require('rimraf'),
    src = sysPath.join(__dirname, '..', 'src'),
    lib = sysPath.join(__dirname, '..', 'lib');

rimraf(lib, function(err) {
    if (err) throw err;
    explore(src, function(path, stats, next) {
        var dst = sysPath.join(lib, sysPath.relative(src, path));
        mkdirp(sysPath.dirname(dst), function(err) {
            var readable, writable;
            if (err) return next(err);
            if (/\.coffee$/.test(path)) {
                fs.readFile(path, function(err, data) {
                    if (err) return next(err);
                    var compiled = coffeescript.compile(data.toString(), {
                        bare: true,
                        header: false
                    });
                    fs.writeFile(dst.replace(/\.coffee$/, '.js'), compiled, next);
                });
            } else {
                readable = fs.createReadStream(path);
                writable = fs.createWriteStream(dst);
                readable.pipe(writable);
                writable.on('finish', next);
            }
        });
    }, function(err) {
        if (err) throw err;
    });
});