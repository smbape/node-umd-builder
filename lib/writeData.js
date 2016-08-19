var fs, mkdirp, semLib, sysPath, writeData, writeSem;

fs = require('fs');

mkdirp = require('mkdirp');

sysPath = require('path');

semLib = require('sem-lib');

writeSem = semLib.semCreate(Math.pow(2, 3), true);

writeData = function(data, dst, done) {
  writeSem.semTake(function() {
    var next;
    next = function(err) {
      writeSem.semGive();
      done(err);
    };
    mkdirp(sysPath.dirname(dst), function(err) {
      var writeStream;
      if (err) {
        return next(err);
      }
      writeStream = fs.createWriteStream(dst);
      writeStream.write(data, 'utf8', next);
      writeStream.end();
    });
  });
};

module.exports = writeData;