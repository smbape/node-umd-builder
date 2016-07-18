var CopyCompiler, _, builder, copyFile, copySem, debounce, fns, fs, hasOwnProperty, log4js, logger, mkdirp, semLib, sysPath, wait;

log4js = global.log4js || (global.log4js = require('log4js'));

logger = log4js.getLogger('copy');

fs = require('fs');

mkdirp = require('mkdirp');

sysPath = require('path');

semLib = require('sem-lib');

_ = require('lodash');

builder = require('../builder');

copySem = semLib.semCreate(Math.pow(2, 2), true);

wait = Math.pow(2, 8);

fns = {};

hasOwnProperty = Object.prototype.hasOwnProperty;

debounce = function(plugin, src, dst, next) {
  fns[src] || (fns[src] = {});
  if (hasOwnProperty.call(fns[src], dst)) {
    return fns[src][dst];
  }
  return fns[src][dst] = _.debounce(function() {
    copySem.semTake(function() {
      var done;
      done = function(err) {
        next(err);
        copySem.semGive();
      };
      mkdirp(sysPath.dirname(dst), function(err) {
        var _dst, _src, readable, writable;
        if (err) {
          return done(err);
        }
        if (logger.isDebugEnabled()) {
          _src = sysPath.relative(plugin.paths.APPLICATION_PATH, src);
          _dst = sysPath.relative(plugin.paths.APPLICATION_PATH, dst);
          logger.debug("\n    " + _src + "\n    " + _dst);
        }
        readable = fs.createReadStream(src);
        writable = fs.createWriteStream(dst);
        readable.pipe(writable);
        writable.on('error', done);
        writable.on('finish', done);
      });
    });
  }, wait);
};

copyFile = function(plugin, src, dst, next) {
  debounce(plugin, src, dst, next)();
};

module.exports = CopyCompiler = (function() {
  CopyCompiler.prototype.brunchPlugin = true;

  CopyCompiler.prototype.type = 'copy';

  CopyCompiler.prototype.typePattern = /^(?!(?:javascript|stylesheet|html)$)/;

  CopyCompiler.prototype.typeUndefined = true;

  CopyCompiler.prototype.completer = true;

  function CopyCompiler(config) {
    if (config == null) {
      config = {};
    }
    this.amdDestination = config.modules.amdDestination;
  }

  CopyCompiler.prototype.compile = function(params, next) {
    var data, dst, map, path, self, src;
    data = params.data, path = params.path, map = params.map;
    self = this;
    self.paths = self.paths || builder.getConfig().paths;
    src = sysPath.join(self.paths.APPLICATION_PATH, path);
    dst = sysPath.join(self.paths.PUBLIC_PATH, self.amdDestination(path, true));
    copyFile(this, src, dst, function(err) {
      next(err, params);
    });
  };

  return CopyCompiler;

})();

CopyCompiler.brunchPluginName = 'copy-brunch';
