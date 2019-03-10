var fcache, fs, mkdirp, sysPath, writeData;

fs = require("fs");

mkdirp = require("mkdirp");

sysPath = require("path");

fcache = require("../utils/fcache");

writeData = function(data, dst, cb) {
  fcache.lock(dst, function(release) {
    var next;
    next = function(err) {
      release();
      cb(err);
    };
    mkdirp(sysPath.dirname(dst), function(err) {
      var writable;
      if (err) {
        next(err);
        return;
      }
      writable = fs.createWriteStream(dst);
      writable.write(data, "utf8", next);
      writable.end();
    });
  });
};

module.exports = writeData;
