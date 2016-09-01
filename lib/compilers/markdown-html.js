var MarkdownCompiler, builder, defaultOptions, hljs, languages, marked, sysPath, writeData;

sysPath = require('path');

marked = require('marked');

hljs = require('highlight.js');

languages = hljs.listLanguages();

builder = require('../builder');

writeData = require('../writeData');

defaultOptions = {
  renderer: new marked.Renderer(),
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

  MarkdownCompiler.prototype.type = 'html';

  MarkdownCompiler.prototype.pattern = /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/;

  function MarkdownCompiler(config) {
    var options, ref;
    if (config == null) {
      config = {};
    }
    this.paths = builder.generateConfig(config).paths;
    this.sourceMaps = !!config.sourceMaps;
    options = (config != null ? (ref = config.plugins) != null ? ref.markdown : void 0 : void 0) || {};
    this.options = _.extend({}, options, defaultOptions);
    this.overrides = this.options.overrides;
    delete this.options.overrides;
    this.amdDestination = config.modules.amdDestination;
  }

  MarkdownCompiler.prototype.compile = function(params, next) {
    var data, dst, map, options, path;
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
    dst = sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path) + '.html');
    if (options.angular) {
      data = marked(data, options).replace(/(\{|\}){2}/g, "{{ '\\$1\\$1' }}");
    } else {
      data = marked(data, options);
    }
    writeData(data, dst, function(err) {
      if (err) {
        return next(err);
      }
      next(err, params);
    });
  };

  return MarkdownCompiler;

})();

MarkdownCompiler.brunchPluginName = 'markdown-brunch';
