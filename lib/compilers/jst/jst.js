var JstCompiler, _, minimatch, sysPath;

_ = require('lodash');

_.template = require('./template');

sysPath = require('path');

minimatch = require('minimatch');

module.exports = JstCompiler = (function() {
  JstCompiler.prototype.brunchPlugin = true;

  JstCompiler.prototype.type = 'template';

  JstCompiler.prototype.extension = 'jst';

  function JstCompiler(config) {
    var ref;
    if (config == null) {
      config = {};
    }
    this.nameCleaner = config.modules.nameCleaner || function(path) {
      return path;
    };
    this.options = ((ref = config.plugins) != null ? ref.jst : void 0) || {};
    this.overrides = this.options.overrides;
    delete this.options.overrides;
  }

  JstCompiler.prototype.getOptions = function(path) {
    var options;
    options = _.extend({}, this.options, {
      sourceURL: this.nameCleaner(path)
    });
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
    return options;
  };

  JstCompiler.prototype.compile = function(params, next) {
    var data, e, map, options, path, strict, template;
    data = params.data, path = params.path, map = params.map;
    options = this.getOptions(path);
    try {
      template = _.template(data, options).source;
      strict = options.strict ? "'use strict';" : '';
      data = "function factory(require) {\n    " + strict + "\n    return " + template + ";\n}";
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

  return JstCompiler;

})();

JstCompiler.brunchPluginName = 'jst-brunch';
