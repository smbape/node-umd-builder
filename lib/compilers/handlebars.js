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
        data = `deps = [{node: 'handlebars', common: '!Handlebars', amd: 'handlebars'}];\nfunction factory(require, Handlebars) {\n    return ${data};\n}`;
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
        data = `define(["module", "handlebars"], function(module, Handlebars) {\n    ${data}\n});`;
      } else {
        moduleName = path.slice(path.replace(/^.+?[\/\/](?:bower_components|node_modules)[\/\/]/, ""));
        data = `(function(global, factory) {\n    if (typeof define === "function" && define.amd) {\n        define(["module", "handlebars"], factory);\n    } else if (typeof exports === "object" && typeof module !== "undefined") {\n        if (typeof process === "object" && typeof process.platform !== "undefined") {\n            factory(module, require("handlebars"));\n        } else if (global.require && global.require.brunch) {\n            factory(module, global.Handlebars);\n        } else {\n            factory(module, require("handlebars"));\n        }\n    } else {\n        var mod = {\n            exports: {}\n        };\n        factory(mod, global.Handlebars);\n        global[${JSON.stringify(moduleName)}] = mod.exports;\n    }\n})((function(_this) {\n    var g;\n\n    if (typeof window !== "undefined") {\n        g = window;\n    } else if (typeof global !== "undefined") {\n        g = global;\n    } else if (typeof self !== "undefined") {\n        g = self;\n    } else {\n        g = _this;\n    }\n\n    return g;\n}(this)), function(module, Handlebars) {\n    ${data}\n});`;
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
