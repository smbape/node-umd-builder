/* eslint-disable no-empty-function */
var HandlebarsCompiler, handlebars;

handlebars = require("handlebars");

module.exports = HandlebarsCompiler = function() {
  class HandlebarsCompiler {
    constructor(cfg = {}) {
      this.rootPath = cfg.paths.root;
      this.options = cfg.plugins && cfg.plugins.handlebars || {};
    }

    compile(params, next) {
      var data, err, map, moduleName, path;
      ({data, path, map} = params);
      try {
        data = `module.exports = Handlebars.template(${handlebars.precompile(data)});`;
        data = `deps = [{node: 'handlebars', common: '!Handlebars', amd: 'handlebars'}];
function factory(require, Handlebars) {
    return ${data};
}`;
      } catch (error) {
        err = error;
        next(err, params);
        return;
      }
      if (this.options.type === "esm") {
        data = `import * as Handlebars from 'handlebars';\n${data}`;
      } else if (this.options.type === "common") {
        data = `var Handlebars = require('handlebars');\n${data}`;
      } else if (this.options.type === "amd") {
        data = `define(["module", "handlebars"], function(module, Handlebars) {
    ${data}
});`;
      } else {
        moduleName = path.slice(path.replace(/^.+?[\/\/](?:bower_components|node_modules)[\/\/]/, ""));
        data = `(function(global, factory) {
    if (typeof module === 'object' && module && module.exports) {
        if (typeof process === "object" && typeof process.platform !== "undefined") {
            factory(module, require("handlebars"));
        } else if (global.require && global.require.brunch) {
            factory(module, global.Handlebars);
        } else {
            factory(module, require("handlebars"));
        }
    } else if (typeof define === "function" && define.amd) {
        define(["module", "handlebars"], factory);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.Handlebars);
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
}(this)), function(module, Handlebars) {
    ${data}
});`;
      }
      next(null, {data, path, map});
    }

  }

  HandlebarsCompiler.prototype.brunchPlugin = true;

  HandlebarsCompiler.prototype.type = "template";

  HandlebarsCompiler.prototype.pattern = /\.(?:hbs|handlebars)$/;

  return HandlebarsCompiler;

}.call(this);

HandlebarsCompiler.brunchPluginName = "handlebars-brunch";
