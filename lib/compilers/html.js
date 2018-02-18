/* eslint-disable no-empty-function */
var HtmlCompiler;

module.exports = HtmlCompiler = (function() {
  HtmlCompiler.prototype.brunchPlugin = true;

  HtmlCompiler.prototype.type = "template";

  HtmlCompiler.prototype.pattern = /\.(?:html?)$/;

  function HtmlCompiler(cfg) {
    if (cfg == null) {
      cfg = {};
    }
    this.rootPath = cfg.paths.root;
    this.options = cfg.plugins && cfg.plugins.html || {};
  }

  HtmlCompiler.prototype.compile = function(params, next) {
    var data, map, path;
    data = params.data, path = params.path, map = params.map;
    data = JSON.stringify(data);
    if (this.options.type === "common") {
      data = "module.exports = " + data + ";";
    } else if (this.options.type === "amd") {
      data = "define([], function() {\n    return " + data + ";\n});";
    } else {
      data = "/* eslint-disable consistent-return */\n(function() {\n    var __templateData = " + data + ";\n    if (typeof define === 'function' && define.amd) {\n        define([], function() {\n            return __templateData;\n        });\n    } else if (typeof module === 'object' && module && module.exports) {\n        module.exports = __templateData;\n    } else {\n        return __templateData;\n    }\n})();";
    }
    next(null, {
      data: data,
      path: path,
      map: map
    });
  };

  return HtmlCompiler;

})();

HtmlCompiler.brunchPluginName = "html-brunch";
