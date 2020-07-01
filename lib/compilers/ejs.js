var EjsCompiler, ejs, replace, search;

ejs = require("ejs");

search = (function() {
  var anonymousFnMath, escapeFnMatch, rethrowFnMatch, specialRegChar;
  specialRegChar = /([\\\/^$.|?*+()\[\]{}])/g;
  anonymousFnMath = "function anonymous(locals, escape, include, rethrow) {".replace(specialRegChar, "\\$1");
  rethrowFnMatch = "rethrow = rethrow || ".replace(specialRegChar, "\\$1");
  escapeFnMatch = "escape = escape || function (markup)".replace(specialRegChar, "\\$1");
  return new RegExp([anonymousFnMath, "\\n", rethrowFnMatch, "([\\s\\S]+?\\n)", escapeFnMatch].join(""));
})();

replace = "return function template(root){\n$1function escape(markup)";

module.exports = EjsCompiler = function() {
  class EjsCompiler {
    constructor(config = {}) {
      this.nameCleaner = config.modules.nameCleaner || function(path) {
        return path;
      };
    }

    compile(params, next) {
      var data, e, map, options, path, template;
      ({data, path, map} = params);
      try {
        options = {
          client: true,
          _with: false,
          filename: this.nameCleaner(path)
        };
        template = ejs.compile(data, options);
        template = template.toString().replace(search, replace);
        data = `function factory(require) {
    'use strict';
    function include(path, context) {
        var template = require(path);
        return template(context);
    }
    ${template}
}`;
        next(null, {data, path, map});
      } catch (error) {
        e = error;
        next(e, {data, path, map});
      }
    }

  }

  EjsCompiler.prototype.brunchPlugin = true;

  EjsCompiler.prototype.type = "template";

  EjsCompiler.prototype.extension = "ejs";

  return EjsCompiler;

}.call(this);

EjsCompiler.brunchPluginName = "ejs-brunch";
