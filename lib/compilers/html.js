var HtmlCompiler;

module.exports = HtmlCompiler = (function() {
  function HtmlCompiler() {}

  HtmlCompiler.prototype.brunchPlugin = true;

  HtmlCompiler.prototype.type = 'template';

  HtmlCompiler.prototype.pattern = /\.(?:html?)$/;

  HtmlCompiler.prototype.compile = function(params, next) {
    var data, map, path;
    data = params.data, path = params.path, map = params.map;
    data = "(function() {\n    /* eslint-disable consistent-return */\n    var __templateData = " + (JSON.stringify(data)) + ";\n    if (typeof define === 'function' && define.amd) {\n        define([], function() {\n            return __templateData;\n        });\n    } else if (typeof module === 'object' && module && module.exports) {\n        module.exports = __templateData;\n    } else {\n        return __templateData;\n    }\n})();";
    next(null, {
      data: data,
      path: path,
      map: map
    });
  };

  return HtmlCompiler;

})();

HtmlCompiler.brunchPluginName = 'html-brunch';
