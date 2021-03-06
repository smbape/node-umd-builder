var JstCompiler, _template, builder, extend, modules, sysPath, writeData;

sysPath = require("path");

builder = require("../../../").builder;

writeData = require("../../writeData");

extend = require("lodash/extend");

_template = require("./template");

modules = require("../../../utils/modules");

module.exports = JstCompiler = function() {
  class JstCompiler {
    constructor(config = {}) {
      this.nameCleaner = config.modules.nameCleaner || function(path) {
        return path;
      };
      this.options = config.plugins && config.plugins.jst;
      ({paths: this.paths} = builder.generateConfig(config));
    }

    compile(params, next) {
      var data, dst, e, filename, options, path;
      ({data, path} = params);
      try {
        options = extend({
          variable: "root"
        }, this.options, {
          sourceURL: this.nameCleaner(path)
        });
        filename = sysPath.join(this.paths.APPLICATION_PATH, path);
        options.imports = extend(modules.makeModule(filename, module), options.imports);
        dst = sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path, true));
        data = _template(data, options)(options.imports);
        writeData(data, dst, function(err) {
          next(err, params);
        });
      } catch (error) {
        e = error;
        next(e, params);
      }
    }

  }

  JstCompiler.prototype.brunchPlugin = true;

  JstCompiler.prototype.type = "html";

  JstCompiler.prototype.extension = "jst";

  return JstCompiler;

}.call(this);

JstCompiler.brunchPluginName = "jst-server-html-brunch";
