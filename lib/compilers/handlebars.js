/* eslint-disable no-empty-function */
var HandlebarsCompiler, handlebars;

handlebars = require("handlebars");

module.exports = HandlebarsCompiler = (function() {
  function HandlebarsCompiler() {}

  HandlebarsCompiler.prototype.brunchPlugin = true;

  HandlebarsCompiler.prototype.type = "template";

  HandlebarsCompiler.prototype.pattern = /\.(?:hbs|handlebars)$/;

  HandlebarsCompiler.prototype.compile = function(params, next) {
    var data, e, map, path;
    data = params.data, path = params.path, map = params.map;
    try {
      data = "deps = [{node: 'handlebars', common: '!Handlebars', amd: 'handlebars'}];\nfunction factory(require, Handlebars) {\n    return Handlebars.template(" + handlebars.precompile(data) + ");\n}";
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

HandlebarsCompiler.brunchPluginName = "handlebars-brunch";
