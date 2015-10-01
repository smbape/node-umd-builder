// Generated by CoffeeScript 1.10.0
var HandlebarsCompiler, handlebars, sysPath;

sysPath = require('path');

handlebars = require('handlebars');

module.exports = HandlebarsCompiler = (function() {
  function HandlebarsCompiler() {}

  HandlebarsCompiler.prototype.brunchPlugin = true;

  HandlebarsCompiler.prototype.type = 'template';

  HandlebarsCompiler.prototype.pattern = /\.(?:hbs|handlebars)$/;

  HandlebarsCompiler.prototype.compile = function(params, next) {
    var data, e, error, map, path;
    data = params.data, path = params.path, map = params.map;
    try {
      data = "deps = [{node: 'handlebars', common: '!Handlebars', amd: 'handlebars'}];\nfunction factory(require, Handlebars) {\n    return Handlebars.template(" + (handlebars.precompile(data)) + ");\n}";
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

  return HandlebarsCompiler;

})();