var EjsCompiler, ejs, replace, search, sysPath;

sysPath = require('path');

ejs = require('ejs');

search = (function() {
  var anonymousFnMath, escapeFnMatch, rethrowFnMatch, specialRegChar;
  specialRegChar = /([\\\/^$.|?*+()\[\]{}])/g;
  anonymousFnMath = "function anonymous(locals, escape, include, rethrow) {".replace(specialRegChar, '\\$1');
  rethrowFnMatch = "rethrow = rethrow || ".replace(specialRegChar, '\\$1');
  escapeFnMatch = "escape = escape || function (markup)".replace(specialRegChar, '\\$1');
  return new RegExp([anonymousFnMath, '\\n', rethrowFnMatch, "([\\s\\S]+?\\n)", escapeFnMatch].join(''));
})();

replace = 'return function template(root){\n$1function escape(markup)';

module.exports = EjsCompiler = (function() {
  EjsCompiler.prototype.brunchPlugin = true;

  EjsCompiler.prototype.type = 'template';

  EjsCompiler.prototype.extension = 'ejs';

  function EjsCompiler(config) {
    if (config == null) {
      config = {};
    }
    this.nameCleaner = config.modules.nameCleaner || function(path) {
      return path;
    };
  }

  EjsCompiler.prototype.compile = function(params, next) {
    var data, e, map, options, path, template;
    data = params.data, path = params.path, map = params.map;
    try {
      options = {
        client: true,
        _with: false,
        filename: this.nameCleaner(path)
      };
      template = ejs.compile(data, options);
      template = template.toString().replace(search, replace);
      data = "function factory(require) {\n    'use strict';\n    function include(path, context) {\n        var template = require(path);\n        return template(context);\n    }\n    " + template + "\n}";
      next(null, {
        data: data,
        path: path,
        map: map
      });
    } catch (error) {
      e = error;
      next(e, {
        data: data,
        path: path,
        map: map
      });
    }
  };

  return EjsCompiler;

})();

EjsCompiler.brunchPluginName = 'ejs-brunch';
