/* eslint-disable no-empty-function */
var HtmlCompiler;

module.exports = HtmlCompiler = function() {
  class HtmlCompiler {
    constructor(cfg = {}) {
      this.rootPath = cfg.paths.root;
      this.options = cfg.plugins && cfg.plugins.html || {};
    }

    compile(params, next) {
      var data, map, moduleName, path, ref;
      ({data, path, map} = params);
      data = `module.exports = ${JSON.stringify(data)};`;
      if ((ref = this.options.type) === "esm" || ref === "common") {

      // data = "#{data}"
      } else if (this.options.type === "amd") {
        data = `define(["module"], function(module) {\n    ${data}\n});`;
      } else {
        moduleName = path.slice(path.replace(/^.+?[\/\/](?:bower_components|node_modules)[\/\/]/, ""));
        data = `(function(global, factory) {\n    if (typeof module === 'object' && module && module.exports) {\n        factory(module);\n    } else if (typeof define === "function" && define.amd) {\n        define(["module", "handlebars"], factory);\n    } else {\n        var mod = {\n            exports: {}\n        };\n        factory(mod);\n        global[${JSON.stringify(moduleName)}] = mod.exports;\n    }\n})((function(_this) {\n    var g;\n\n    if (typeof window !== "undefined") {\n        g = window;\n    } else if (typeof global !== "undefined") {\n        g = global;\n    } else if (typeof self !== "undefined") {\n        g = self;\n    } else {\n        g = _this;\n    }\n\n    return g;\n}(this)), function(module) {\n    ${data}\n});`;
      }
      next(null, {data, path, map});
    }

  }

  HtmlCompiler.prototype.brunchPlugin = true;

  HtmlCompiler.prototype.type = "template";

  HtmlCompiler.prototype.pattern = /\.(?:html?)$/;

  return HtmlCompiler;

}.call(this);

HtmlCompiler.brunchPluginName = "html-brunch";
