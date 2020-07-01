var JstCompiler, each, extend, minimatch, sysPath, template;

extend = require("lodash/extend");

each = require("lodash/each");

extend = require("lodash/extend");

template = require("./template");

sysPath = require("path");

minimatch = require("minimatch");

module.exports = JstCompiler = function() {
  class JstCompiler {
    constructor(config = {}) {
      var ref;
      this.nameCleaner = config.modules.nameCleaner || function(path) {
        return path;
      };
      this.options = ((ref = config.plugins) != null ? ref.jst : void 0) || {};
      this.overrides = this.options.overrides;
      delete this.options.overrides;
    }

    getOptions(path) {
      var options;
      options = extend({}, this.options, {
        sourceURL: this.nameCleaner(path)
      });
      if (this.overrides) {
        each(this.overrides, function(override, pattern) {
          if (minimatch(sysPath.normalize(path), pattern, {
            nocase: true,
            matchBase: true
          })) {
            extend(options, override);
          }
        });
      }
      return options;
    }

    compile(params, next) {
      var data, e, map, moduleName, options, path, ref;
      ({data, path, map} = params);
      options = this.getOptions(path);
      try {
        data = `module.exports = ${template(data, options).source};`;
      } catch (error) {
        e = error;
        next(e, {data, path, map});
        return;
      }
      if ((ref = this.options.type) === "esm" || ref === "common") {

      // data = "#{data}"
      } else if (this.options.type === "amd") {
        data = `define(["module"], function(module) {
    ${data}
});`;
      } else {
        moduleName = path.slice(path.replace(/^.+?[\/\/](?:bower_components|node_modules)[\/\/]/, ""));
        data = `(function(global, factory) {
    if (typeof module === 'object' && module && module.exports) {
        factory(module);
    } else if (typeof define === "function" && define.amd) {
        define(["module", "handlebars"], factory);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod);
        global[${JSON.stringify(moduleName)}] = mod.exports;
    }
})((function(_this) {
    var g;

    if (typeof window !== "undefined") {
        g = window;
    } else if (typeof global !== "undefined") {
        g = global;
    } else if (typeof self !== "undefined") {
        g = self;
    } else {
        g = _this;
    }

    return g;
}(this)), function(module) {
    ${data}
});`;
      }
      next(null, {data, path, map});
    }

  }

  JstCompiler.prototype.brunchPlugin = true;

  JstCompiler.prototype.type = "template";

  JstCompiler.prototype.extension = "jst";

  return JstCompiler;

}.call(this);

JstCompiler.brunchPluginName = "jst-brunch";
