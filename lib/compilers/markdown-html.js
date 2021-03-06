var MarkdownCompiler, builder, clone, defaultOptions, each, extend, hljs, languages, marked, minimatch, sysPath, writeData;

extend = require("lodash/extend");

clone = require("lodash/clone");

each = require("lodash/each");

sysPath = require("path");

marked = require("marked");

minimatch = require("minimatch");

hljs = require("highlight.js");

languages = hljs.listLanguages();

builder = require("../builder");

writeData = require("../writeData");

defaultOptions = {
  renderer: new marked.Renderer(),
  langPrefix: "hljs lang-",
  highlight: function(code, lang) {
    if (lang === "auto" || languages.indexOf(lang) === -1) {
      return hljs.highlightAuto(code).value;
    } 
      return hljs.highlight(lang, code).value;
    
  }
};

module.exports = MarkdownCompiler = function() {
  class MarkdownCompiler {
    constructor(config = {}) {
      var options, ref;
      ({paths: this.paths} = builder.generateConfig(config));
      this.sourceMaps = Boolean(config.sourceMaps);
      options = (config != null ? (ref = config.plugins) != null ? ref.markdown : void 0 : void 0) || {};
      this.options = extend({}, options, defaultOptions);
      ({overrides: this.overrides} = this.options);
      delete this.options.overrides;
      this.amdDestination = config.modules.amdDestination;
    }

    compile(params, next) {
      var data, dst, options, path;
      ({data, path} = params);
      options = clone(this.options);
      if (this.overrides) {
        each(this.overrides, function(override, pattern) {
          if (minimatch(sysPath.normalize(path), pattern, {
            nocase: true,
            matchBase: true
          })) {
            extend(options, override);
          }
        });
      }
      dst = sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path) + ".html");
      if (options.angular) {
        // escape every curly braces to avoid interpretation by angular
        data = marked(data, options).replace(/(\{|\}){2}/g, "{{ '\\$1\\$1' }}");
      } else {
        data = marked(data, options);
      }
      writeData(data, dst, function(err) {
        next(err, params);
      });
    }

  }

  MarkdownCompiler.prototype.brunchPlugin = true;

  MarkdownCompiler.prototype.type = "html";

  MarkdownCompiler.prototype.pattern = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/;

  return MarkdownCompiler;

}.call(this);

MarkdownCompiler.brunchPluginName = "markdown-brunch";
