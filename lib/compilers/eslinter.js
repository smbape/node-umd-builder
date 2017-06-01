var EsLinter, Module, anymatch, clone, each, fs, log4js, logger, merge, minimatch, mkdirp, pad, resolve, sysPath;

log4js = global.log4js || (global.log4js = require('log4js'));

logger = log4js.getLogger('EsLinter');

fs = require('fs');

sysPath = require('path');

anymatch = require('anymatch');

minimatch = require('minimatch');

clone = require("lodash/clone");

each = require("lodash/each");

merge = require("lodash/merge");

mkdirp = require('mkdirp');

pad = function(str, length) {
  while (str.length < length) {
    str = ' ' + str;
  }
  return str;
};

Module = require("module");

resolve = function(name, directory) {
  var err, filename, relativeMod;
  relativeMod = new Module();
  filename = sysPath.join(directory, ".eslintrc");
  relativeMod.id = filename;
  relativeMod.filename = filename;
  relativeMod.paths = Module._nodeModulePaths(directory).concat(Module._nodeModulePaths(__dirname));
  try {
    return Module._resolveFilename(name, relativeMod);
  } catch (error) {
    err = error;
    return null;
  }
};

module.exports = EsLinter = (function() {
  EsLinter.prototype.brunchPlugin = false;

  EsLinter.prototype.type = 'javascript';

  EsLinter.prototype.extension = 'js';

  function EsLinter(config) {
    var cfg, ignore, options, pattern, ref, ref1, ref2;
    cfg = (ref = (ref1 = config != null ? (ref2 = config.plugins) != null ? ref2.eslint : void 0 : void 0) != null ? ref1 : config != null ? config.eslint : void 0) != null ? ref : {};
    this.warnOnly = cfg.warnOnly, this.overrides = cfg.overrides, ignore = cfg.ignore, config = cfg.config, pattern = cfg.pattern;
    options = clone(config);
    if (ignore) {
      this.isIgnored = anymatch(ignore);
    } else if (config.conventions && config.conventions.vendor) {
      this.isIgnored = config.conventions.vendor;
    } else {
      this.isIgnored = anymatch(/^(?:bower_components|vendor)[\/\\]/);
    }
    if (pattern) {
      this.pattern = anymatch(pattern);
    }
    this.options = options;
    this.CLIEngine = require(resolve('eslint', process.cwd())).CLIEngine;
  }

  EsLinter.prototype.lint = function(params, done) {
    var CLIEngine, config, data, formatter, linter, map, msg, path, report;
    data = params.data, path = params.path, map = params.map;
    if (this.isIgnored(path)) {
      return done();
    }
    if (this.pattern && !this.pattern(path)) {
      return done();
    }
    config = this.options;
    if ("function" === typeof config) {
      config = config(params);
    }
    if (this.overrides) {
      config = clone(this.options);
      each(this.overrides, function(options, pattern) {
        if (minimatch(sysPath.normalize(path), pattern, {
          nocase: true,
          matchBase: true
        })) {
          if ("function" === typeof options) {
            options = options(params);
          }
          merge(config, options);
        }
      });
    }
    CLIEngine = this.CLIEngine;
    linter = new CLIEngine(config);
    report = linter.executeOnText(data, path);
    if (report.errorCount === 0 && report.warningCount === 0) {
      return done();
    }
    formatter = CLIEngine.getFormatter();
    msg = 'ESLint reported:\n' + formatter(report.results);
    if (this.warnOnly) {
      msg = "warn: " + msg;
    }
    done(msg);
  };

  return EsLinter;

})();

EsLinter.brunchPluginName = 'eslinter-brunch';
