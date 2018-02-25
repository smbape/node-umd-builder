var JstCompiler, MarkdownCompiler, SPECIAL_CHAR_REG, clone, defaultOptions, defaults, each, extend, hljs, languages, marked, minimatch, sysPath;

clone = require("lodash/clone");

defaults = require("lodash/defaults");

each = require("lodash/each");

extend = require("lodash/extend");

JstCompiler = require("./jst/jst");

sysPath = require("path");

minimatch = require("minimatch");

marked = require("marked");

hljs = require("highlight.js");

languages = hljs.listLanguages();

SPECIAL_CHAR_REG = new RegExp("([" + "\\/^$.|?*+()[]{}".split("").join("\\") + "])", "g");

defaultOptions = {
  // renderer: new marked.Renderer()
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
      this.sourceMaps = Boolean(config.sourceMaps);
      options = (config != null ? (ref = config.plugins) != null ? ref.markdown : void 0 : void 0) || {};
      this.options = defaults({}, options, defaultOptions);
      ({overrides: this.overrides} = this.options);
      delete this.options.overrides;
      this.jstCompiler = new JstCompiler(config);
    }

    compile(params, next) {
      var data, escape, evaluate, holder, holderStr, holders, ignore, interpolate, jstOptions, map, options, path, placeholderFinder, ref;
      ({data, path, map} = params);
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
      if ("boolean" === typeof options.jst) {
        options.jst = {
          on: options.jst
        };
      }
      if ((ref = options.jst) != null ? ref.on : void 0) {
        if (options.jst.holder) {
          holderStr = options.jst.holder;
          holder = new RegExp("(?:<p>)?" + holderStr.replace(SPECIAL_CHAR_REG, "\\$1") + "_(\\d+)(?:</p>)?", "g");
        } else {
          holder = /(?:<p>)?@@@_(\d+)(?:<\/p>)?/g;
          holderStr = holder.source;
        }
        delete options.jst;
        jstOptions = this.jstCompiler.getOptions(path);
        holders = [];
        ({ignore, escape, interpolate, evaluate} = jstOptions);
        placeholderFinder = new RegExp("(?:" + ignore.source + "|" + escape.source + "|" + interpolate.source + "|" + evaluate.source + ")", "g");
        data = data.replace(placeholderFinder, function(match) {
          var replace;
          replace = holderStr + "_" + holders.length;
          holders.push(match);
          return replace;
        });
        data = marked(data, options).replace(holder, function(match, index) {
          return holders[parseInt(index, 10)];
        });
        if (options.decorate) {
          data = options.decorate(data);
        }
        this.jstCompiler.compile({data, path, map}, next);
      } else {
        data = JSON.stringify(marked(data, options));
        if (options.decorate) {
          data = options.decorate(data);
        }
        data = `(function() {\n    var __templateData = ${data};\n    if (typeof define === 'function' && define.amd) {\n        define([], function() {\n            return __templateData;\n        });\n    } else if (typeof module === 'object' && module && module.exports) {\n        module.exports = __templateData;\n    } else {\n        return __templateData;\n    }\n})();`;
        next(null, {data, params, map});
      }
    }

  }

  MarkdownCompiler.prototype.brunchPlugin = true;

  MarkdownCompiler.prototype.type = "template";

  MarkdownCompiler.prototype.pattern = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/;

  return MarkdownCompiler;

}.call(this);

MarkdownCompiler.brunchPluginName = "markdown-brunch";
