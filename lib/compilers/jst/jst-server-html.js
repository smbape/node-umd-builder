var JstCompiler, _template, builder, extend, modules, sysPath, writeData;

sysPath = require('path');

builder = require('../../../').builder;

writeData = require('../../writeData');

extend = require("lodash/extend");

_template = require('./template');

modules = require("../../../utils/modules");

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
    var data, dst, e, map, options, path, src;
    data = params.data, path = params.path, map = params.map;
    try {
      options = extend({
        variable: "root"
      }, this.options, {
        sourceURL: this.nameCleaner(path)
      });
      options.imports = extend(modules.makeModule(filename, module), options.imports);
      src = sysPath.join(self.paths.APPLICATION_PATH, path);
      dst = sysPath.join(self.paths.PUBLIC_PATH, self.amdDestination(path, true));
      data = _template(data, options)();
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
