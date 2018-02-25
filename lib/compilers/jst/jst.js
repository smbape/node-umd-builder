var JstCompiler, _template, each, extend, minimatch, sysPath;

extend = require("lodash/extend");

each = require("lodash/each");

extend = require("lodash/extend");

_template = require("./template");

sysPath = require("path");

minimatch = require("minimatch");

module.exports = JstCompiler = function() {
  class JstCompiler {
    constructor(config = {}) {
      var ref;
      this.nameCleaner = config.modules.nameCleaner || function(path) {
        return path;
      };
      this.options = ((ref = config.plugins) != null ? ref.jst : void 0) || {};
      this.overrides = this.options.overrides;
      delete this.options.overrides;
    }

    getOptions(path) {
      var options;
      options = extend({}, this.options, {
        sourceURL: this.nameCleaner(path)
      });
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
      return options;
    }

    compile(params, next) {
      var data, e, map, options, path, strict, template;
      ({data, path, map} = params);
      options = this.getOptions(path);
      try {
        template = _template(data, options).source;
        strict = options.strict ? "'use strict';" : "";
        data = `function factory(require) {\n    ${strict}\n    return ${template};\n}`;
        next(null, {data, path, map});
      } catch (error) {
        e = error;
        next(e, {data, path, map});
      }
    }

  }

  JstCompiler.prototype.brunchPlugin = true;

  JstCompiler.prototype.type = "template";

  JstCompiler.prototype.extension = "jst";

  return JstCompiler;

}.call(this);

JstCompiler.brunchPluginName = "jst-brunch";
