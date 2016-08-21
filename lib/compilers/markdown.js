var JstCompiler, MarkdownCompiler, SPECIAL_CHAR_REG, _, defaultOptions, hljs, languages, marked, minimatch, sysPath;

_ = require('lodash');

JstCompiler = require('./jst/jst');

sysPath = require('path');

minimatch = require('minimatch');

marked = require('marked');

hljs = require('highlight.js');

languages = hljs.listLanguages();

SPECIAL_CHAR_REG = new RegExp('([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g');

defaultOptions = {
  langPrefix: 'hljs lang-',
  highlight: function(code, lang) {
    if (lang === 'auto' || languages.indexOf(lang) === -1) {
      return hljs.highlightAuto(code).value;
    } else {
      return hljs.highlight(lang, code).value;
    }
  }
};

module.exports = MarkdownCompiler = (function() {
  MarkdownCompiler.prototype.brunchPlugin = true;

  MarkdownCompiler.prototype.type = 'template';

  MarkdownCompiler.prototype.pattern = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/;

  function MarkdownCompiler(config) {
    var options, ref;
    if (config == null) {
      config = {};
    }
    this.sourceMaps = !!config.sourceMaps;
    options = (config != null ? (ref = config.plugins) != null ? ref.markdown : void 0 : void 0) || {};
    this.options = _.defaults({}, options, defaultOptions);
    this.overrides = this.options.overrides;
    delete this.options.overrides;
    this.jstCompiler = new JstCompiler(config);
  }

  MarkdownCompiler.prototype.compile = function(params, next) {
    var data, escape, evaluate, holder, holderStr, holders, ignore, index, interpolate, jstOptions, map, options, path, placeholderFinder, ref;
    data = params.data, path = params.path, map = params.map;
    options = _.clone(this.options);
    if (this.overrides) {
      _.each(this.overrides, function(override, pattern) {
        if (minimatch(sysPath.normalize(path), pattern, {
          nocase: true,
          matchBase: true
        })) {
          _.extend(options, override);
        }
      });
    }
    if ('boolean' === typeof options.jst) {
      options.jst = {
        on: options.jst
      };
    }
    if ((ref = options.jst) != null ? ref.on : void 0) {
      if (options.jst.holder) {
        holderStr = options.jst.holder;
        holder = new RegExp(holderStr.replace(SPECIAL_CHAR_REG, '\\$1'), 'g');
      } else {
        holder = /@@@/g;
        holderStr = holder.source;
      }
      delete options.jst;
      jstOptions = this.jstCompiler.getOptions(path);
      holders = [];
      ignore = jstOptions.ignore, escape = jstOptions.escape, interpolate = jstOptions.interpolate, evaluate = jstOptions.evaluate;
      placeholderFinder = new RegExp('(?:' + ignore.source + '|' + escape.source + '|' + interpolate.source + '|' + evaluate.source + ')', 'g');
      data = data.replace(placeholderFinder, function(match) {
        holders.push(match);
        return holderStr;
      });
      index = 0;
      data = marked(data, options).replace(holder, function() {
        return holders[index++];
      });
      this.jstCompiler.compile({
        data: data,
        path: path,
        map: map
      }, next);
    } else {
      data = JSON.stringify(marked(data, options));
      data = "(function() {\n    var __templateData = " + data + ";\n    if (typeof define === 'function' && define.amd) {\n        define([], function() {\n            return __templateData;\n        });\n    } else if (typeof module === 'object' && module && module.exports) {\n        module.exports = __templateData;\n    } else {\n        return __templateData;\n    }\n})();";
      next(null, {
        data: data,
        params: params,
        map: map
      });
    }
  };

  return MarkdownCompiler;

})();

MarkdownCompiler.brunchPluginName = 'markdown-brunch';
