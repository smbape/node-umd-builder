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

  HtmlCompiler.prototype.brunchPlugin = true;

  HtmlCompiler.prototype.type = "template";

  HtmlCompiler.prototype.pattern = /\.(?:html?)$/;

  return HtmlCompiler;

}.call(this);

HtmlCompiler.brunchPluginName = "html-brunch";
