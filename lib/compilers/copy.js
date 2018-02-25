var CopyCompiler, _copyFile, builder, copyFile, copySem, fns, fs, hasProp, log4js, logger, mkdirp, semLib, sysPath, throttle, wait;

log4js = global.log4js || (global.log4js = require("log4js"));

logger = log4js.getLogger("copy");

fs = require("fs");

mkdirp = require("mkdirp");

sysPath = require("path");

semLib = require("sem-lib");

throttle = require("lodash/throttle");

builder = require("../builder");

// 4 parallel copies at most
// a way to control writting bottle neck on a usb key
// which causes editor/explorer to freeze
copySem = semLib.semCreate(Math.pow(2, 2), true);

// change event is triggered event if the file is not completely written
// add a custom timeout to leave time to initial writting to finish
// usefull for images changes
wait = Math.pow(2, 8);

fns = {};

hasProp = Object.prototype.hasOwnProperty;

_copyFile = function(dst, src, plugin, next) {
  copySem.semTake(function() {
    var done;
    done = function(err) {
      next(err);
      copySem.semGive();
    };
    mkdirp(sysPath.dirname(dst), function(err) {
      var _dst, _src, readable, writable;
      if (err) {
        done(err);
        return;
      }
      if (logger.isDebugEnabled()) {
        _src = sysPath.relative(plugin.paths.APPLICATION_PATH, src);
        _dst = sysPath.relative(plugin.paths.APPLICATION_PATH, dst);
        logger.trace(`\n    ${_src}\n    ${_dst}`);
      }
      readable = fs.createReadStream(src);
      writable = fs.createWriteStream(dst);
      readable.pipe(writable);
      writable.on("error", done);
      writable.on("finish", done);
    });
  });
};

copyFile = function(dst, src, plugin, done) {
  var fn;
  if (hasProp.call(fns, dst)) {
    fn = fns[dst];
  } else {
    fn = fns[dst] = throttle(_copyFile.bind(null, dst), wait, {
      leading: false,
      trailling: false
    });
  }
  fn.cancel();
  fn(src, plugin, done);
};

module.exports = CopyCompiler = function() {
  class CopyCompiler {
    constructor(config = {}) {
      this.amdDestination = config.modules.amdDestination;
      ({paths: this.paths} = builder.generateConfig(config));
    }

    compile(params, done) {
      var dst, path, self, src;
      ({path} = params);
      self = this;
      src = sysPath.join(self.paths.APPLICATION_PATH, path);
      dst = sysPath.join(self.paths.PUBLIC_PATH, self.amdDestination(path, true));
      copyFile(dst, src, this, function(err) {
        done(err, params);
      });
    }

  }

  CopyCompiler.prototype.brunchPlugin = true;

  CopyCompiler.prototype.type = "copy";

  CopyCompiler.prototype.typePattern = /^(?!(?:javascript|stylesheet|html)$)/;

  CopyCompiler.prototype.typeUndefined = true;

  CopyCompiler.prototype.completer = true;

  return CopyCompiler;

}.call(this);

CopyCompiler.brunchPluginName = "copy-brunch";
