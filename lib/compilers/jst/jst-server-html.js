var JstCompiler, _, builder, sysPath, writeData;

sysPath = require('path');

_ = require('lodash');

builder = require('../../../').builder;

writeData = require('../../writeData');

_.template = require('./template');

_.templateSettings.variable = 'root';

_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g;

module.exports = JstCompiler = (function() {
  JstCompiler.prototype.brunchPlugin = true;

  JstCompiler.prototype.type = 'html';

  JstCompiler.prototype.extension = 'jst';

  function JstCompiler(config) {
    if (config == null) {
      config = {};
    }
    this.nameCleaner = config.modules.nameCleaner || function(path) {
      return path;
    };
    this.options = config.plugins && config.plugins.jst;
    this.paths = builder.generateConfig(config).paths;
  }

  JstCompiler.prototype.compile = function(params, next) {
    var data, dst, e, map, options, path, src, template;
    data = params.data, path = params.path, map = params.map;
    try {
      options = _.extend({}, this.options, {
        sourceURL: this.nameCleaner(path)
      });
      template = _.template(data, options);
      src = sysPath.join(self.paths.APPLICATION_PATH, path);
      dst = sysPath.join(self.paths.PUBLIC_PATH, self.amdDestination(path, true));
      data = template({
        require: require,
        __filename: src,
        __dirname: sysPath.dirname(src)
      });
      writeData(data, dst, function(err) {
        next(err, params);
      });
    } catch (error) {
      e = error;
      next(e, params);
    }
  };

  return JstCompiler;

})();

JstCompiler.brunchPluginName = 'jst-server-html-brunch';
