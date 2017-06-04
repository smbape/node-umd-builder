var JSHINT, JsHinter, anymatch, chalk, clone, each, extend, fs, minimatch, pad, removeComments, sysPath;

JSHINT = require("jshint").JSHINT;

fs = require("fs");

sysPath = require("path");

chalk = require("chalk");

anymatch = require("anymatch");

minimatch = require("minimatch");

clone = require("lodash/clone");

each = require("lodash/each");

extend = require("lodash/extend");

pad = function(str, length) {
  while (str.length < length) {
    str = " " + str;
  }
  return str;
};

removeComments = function(str) {
  return str.replace(/\/\/[^\n\r]*|\/\*(?:(?!\*\/)[\s\S])*\*\//g, "");
};

module.exports = JsHinter = (function() {
  JsHinter.prototype.brunchPlugin = false;

  JsHinter.prototype.type = "javascript";

  JsHinter.prototype.extension = "js";

  function JsHinter(config) {
    var buff, cfg, e, filename, options, ref, ref1, ref2, stats;
    if ("jshint" in config) {
      console.warn("Warning: config.jshint is deprecated, please move it to config.plugins.jshint");
    }
    cfg = (ref = (ref1 = config != null ? (ref2 = config.plugins) != null ? ref2.jshint : void 0 : void 0) != null ? ref1 : config != null ? config.jshint : void 0) != null ? ref : {};
    options = cfg.options, this.globals = cfg.globals, this.warnOnly = cfg.warnOnly, this.reporterOptions = cfg.reporterOptions, this.overrides = cfg.overrides;
    if (cfg.ignore) {
      this.isIgnored = anymatch(cfg.ignore);
    } else if (config.conventions && config.conventions.vendor) {
      this.isIgnored = config.conventions.vendor;
    } else {
      this.isIgnored = anymatch(/^(?:bower_components|vendor)[\/\\]/);
    }
    this.reporter = cfg.reporter != null ? require(require(cfg.reporter)) : void 0;
    if (!options) {
      filename = sysPath.join(process.cwd(), ".jshintrc");
      try {
        stats = fs.statSync(filename);
        if (stats.isFile()) {
          buff = fs.readFileSync(filename);
          options = JSON.parse(removeComments(buff.toString()));
          this.globals = options.globals, this.overrides = options.overrides;
          delete options.globals;
          delete options.overrides;
        }
      } catch (error1) {
        e = error1;
        e = e.toString().replace("Error: ENOENT, ", "");
        console.warn(".jshintrc parsing error: " + e + ". jshint will run with default options.");
      }
    }
    this.options = options;
  }

  JsHinter.prototype.lint = function(params, done) {
    var config, data, error, errorMsg, errors, globals, msg, path, results;
    data = params.data, path = params.path;
    if (this.isIgnored(path)) {
      done(null);
      return;
    }
    config = this.options;
    globals = clone(this.globals);
    if (this.overrides) {
      config = clone(this.options);
      each(this.overrides, function(options, pattern) {
        if (minimatch(sysPath.normalize(path), pattern, {
          nocase: true,
          matchBase: true
        })) {
          if (options.globals) {
            globals = extend(globals || {}, options.globals);
            delete options.globals;
          }
          extend(config, options);
        }
      });
    }
    JSHINT(data, config, globals);
    errors = JSHINT.errors.filter(function(error) {
      return error != null;
    });
    JSHINT.errors.splice(0, JSHINT.errors.length);
    if (this.reporter) {
      results = errors.map(function(error) {
        return {
          error: error,
          file: path
        };
      });
      this.reporter.reporter(results, void 0, this.reporterOptions);
      msg = String(chalk.gray("via JSHint"));
    } else {
      errorMsg = (function() {
        var i, len, results1;
        results1 = [];
        for (i = 0, len = errors.length; i < len; i++) {
          error = errors[i];
          results1.push((function(error) {
            var ref;
            if (Math.max((ref = error.evidence) != null ? ref.length : void 0, error.character + error.reason.length) <= 120) {
              return pad(error.line.toString(), 7) + " | " + chalk.gray(error.evidence) + "\n" + pad("^", 10 + error.character) + " " + chalk.bold(error.reason);
            } 
              return pad(error.line.toString(), 7) + " | col: " + error.character + " | " + chalk.bold(error.reason);
            
          })(error));
        }
        return results1;
      })();
      errorMsg.unshift("JSHint detected " + errors.length + " problem" + (errors.length > 1 ? "s" : "") + ":");
      errorMsg.push("\n");
      msg = errorMsg.join("\n");
    }
    if (errors.length === 0) {
      msg = null;
    } else {
      if (this.warnOnly) {
        msg = "warn: " + msg;
      }
    }
    done(msg);
  };

  return JsHinter;

})();

JsHinter.brunchPluginName = "jshinter-brunch";
