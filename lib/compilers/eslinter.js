// log4js = global.log4js || (global.log4js = require('log4js'))
// logger = log4js.getLogger 'EsLinter'
var EsLinter, Module, anymatch, clone, each, merge, minimatch, resolve, sysPath;

sysPath = require("path");

anymatch = require("anymatch");

minimatch = require("minimatch");

clone = require("lodash/clone");

each = require("lodash/each");

merge = require("lodash/merge");

Module = require("module");

resolve = function(name, directory) {
  var filename, relativeMod;
  relativeMod = new Module();
  filename = sysPath.join(directory, ".eslintrc");
  relativeMod.id = filename;
  relativeMod.filename = filename;
  relativeMod.paths = Module._nodeModulePaths(directory).concat(Module._nodeModulePaths(__dirname));
  try {
    return Module._resolveFilename(name, relativeMod);
  } catch (error) {
    return null;
  }
};

module.exports = EsLinter = function() {
  class EsLinter {
    constructor(config) {
      var cfg, ignore, options, pattern, ref, ref1, ref2;
      cfg = (ref = (ref1 = config != null ? (ref2 = config.plugins) != null ? ref2.eslint : void 0 : void 0) != null ? ref1 : config != null ? config.eslint : void 0) != null ? ref : {};
      ({warnOnly: this.warnOnly, overrides: this.overrides, ignore, config, pattern} = cfg);
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
      this.CLIEngine = require(resolve("eslint", process.cwd())).CLIEngine;
    }

    lint(params, done) {
      var CLIEngine, config, data, formatter, linter, msg, path, ref, ref1, report;
      ({data, path} = params);
      // check if it is a file to lint
      if (this.isIgnored(path)) {
        done();
        return;
      }
      if (this.pattern && !this.pattern(path)) {
        done();
        return;
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
        done(null, (ref = report.results[0]) != null ? ref.output : void 0);
        return;
      }
      formatter = CLIEngine.getFormatter();
      msg = "ESLint reported:\n" + formatter(report.results);
      if (this.warnOnly) {
        msg = `warn: ${msg}`;
      }
      done(msg, (ref1 = report.results[0]) != null ? ref1.output : void 0);
    }

  }

  EsLinter.prototype.brunchPlugin = false;

  EsLinter.prototype.type = "javascript";

  EsLinter.prototype.extension = "js";

  return EsLinter;

}.call(this);

EsLinter.brunchPluginName = "eslinter-brunch";
