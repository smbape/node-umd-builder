var AmdCompiler, JsHinter, NG_PREFIX, UglifyJSOptimizer, _, anymatch, builder, comWrapper, log4js, logger, methodParser, ngFactoryProxy, ngModuleFactoryProxy, parse, reactFactoryProxy, removeStrictOptions, sysPath, umdWrapper, writeData,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

log4js = global.log4js || (global.log4js = require('log4js'));

logger = log4js.getLogger('AmdCompiler');

sysPath = require('path');

_ = require('lodash');

UglifyJSOptimizer = require('uglify-js-brunch');

anymatch = require('anymatch');

JsHinter = require('./jshinter');

builder = require('../builder');

writeData = require('../writeData');

methodParser = require('../../utils/method-parser');

parse = methodParser.parse;

NG_PREFIX = methodParser.NG_PREFIX;

removeStrictOptions = function(str) {
  return str.replace(/^\s*(['"])use strict\1;?[^\n]*$/m, '');
};

umdWrapper = function(data, options, modulePath) {
  var strict;
  strict = '';
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return "(function(require, global) {\n    " + strict + "\n    var deps = [];\n\n    " + data + "\n\n    if (typeof process === 'object' && typeof process.platform !== 'undefined') {\n        // NodeJs\n        module.exports = depsLoader.common(require, 'node', deps, factory, global);\n    } else if (typeof exports !== 'undefined') {\n        // CommonJS\n        module.exports = depsLoader.common(require, 'common', deps, factory, global);\n    } else if (typeof define === 'function' && define.amd) {\n        // AMD\n        depsLoader.amd(deps, factory, global);\n    }\n}(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));";
};

comWrapper = function(data, options) {
  var strict;
  strict = '';
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return strict + "\nvar deps = [];\n\n" + data + "\n\nmodule.exports = depsLoader.common(require, 'common', deps, factory, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null);";
};

ngFactoryProxy = function(plugin, modulePath, ctor, locals, head, body) {
  var $dirname, $name, $shortName, ngmethod, realPath;
  ngmethod = ctor.substring(NG_PREFIX.length);
  realPath = plugin.config.paths.modules + '/' + modulePath;
  $name = modulePath.replace(/\//g, '.');
  $dirname = sysPath.dirname(realPath);
  $shortName = modulePath.replace(/.*\/([^\/]+)$/, '$1');
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.substring(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular" + (locals ? ', ' + locals : '') + ") {\n    var resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    " + body + "\n    \n    return depsLoader.createNgUsable(" + ctor + ", '" + ngmethod + "', '" + $name + "', '" + realPath + "', '" + $dirname + "', '" + $shortName + "', ngdeps, resolvedDeps, ngmap);\n}";
};

ngModuleFactoryProxy = function(modulePath, head, body) {
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.substring(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular) {\n    /*jshint validthis: true */\n    var name = '" + (modulePath.replace(/\//g, '.')) + "',\n        resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);\n\n    " + body + "\n\n    ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));\n    return exports;\n}";
};

reactFactoryProxy = function(modulePath, head, declaration, args, body) {
  return head + "\ndeps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});\n\nfunction factory(require, React, ReactDOM) {\n    /*jshint validthis: true */\n\n    " + declaration + (args.join(', ')) + body + "\n\n    return freact.apply(this, Array.prototype.slice.call(arguments, 3));\n}";
};

module.exports = AmdCompiler = (function() {
  AmdCompiler.prototype.brunchPlugin = true;

  AmdCompiler.prototype.type = 'javascript';

  AmdCompiler.prototype.completer = true;

  function AmdCompiler(config) {
    var ref;
    if (config == null) {
      config = {};
    }
    if (config.optimize) {
      this.optimizer = new UglifyJSOptimizer(config);
    }
    this.config = _.clone(config);
    this.sourceMaps = !!config.sourceMaps;
    this.amdDestination = config.modules.amdDestination;
    this.nameCleaner = config.modules.nameCleaner;
    this.options = _.extend({}, (ref = config.plugins) != null ? ref.amd : void 0);
    if (this.options.jshint) {
      this.jshinter = new JsHinter(config);
    }
    this.isIgnored = this.options.ignore ? anymatch(this.options.ignore) : config.conventions && config.conventions.vendor ? config.conventions.vendor : anymatch(/^(bower_components|vendor)/);
  }

  AmdCompiler.prototype.compile = function(params, next) {
    var args, body, comData, data, declaration, done, dst, err, error, finishCompilation, head, index, locals, map, modulePath, name, path, ref, res, self, umdData;
    self = this;
    data = params.data, path = params.path, map = params.map;
    self.paths = self.paths || builder.getConfig().paths;
    umdData = comData = data;
    if (!this.isIgnored(params.path)) {
      try {
        ref = res = parse(data), locals = ref[0], name = ref[1], args = ref[2], head = ref[3], declaration = ref[4], body = ref[5];
      } catch (error) {
        err = error;
        logger.error(err);
      }
      if (name) {
        modulePath = self.nameCleaner(path);
        switch (name) {
          case 'factory':
            if ('require' !== args[0]) {
              while ((index = args.indexOf('require')) !== -1) {
                args[index] = 'undefined';
              }
              args.unshift('require');
              data = "" + head + declaration + (args.join(', ')) + body;
            }
            break;
          case 'freact':
            data = reactFactoryProxy(modulePath, head, declaration, args, body);
            break;
          case 'ngmodule':
            data = ngModuleFactoryProxy(modulePath, head, "" + declaration + (args.join(', ')) + body);
            break;
          default:
            if (indexOf.call(methodParser.NG_FNS, name) >= 0) {
              data = ngFactoryProxy(self, modulePath, name, locals, head, "" + declaration + (args.join(', ')) + body);
            }
        }
        umdData = umdWrapper(data, self.options, modulePath);
        comData = comWrapper(data, self.options);
      }
    }
    done = function(err) {
      next(err, {
        data: comData,
        path: path
      });
    };
    dst = sysPath.join(self.paths.PUBLIC_PATH, self.amdDestination(path) + '.js');
    finishCompilation = function() {
      if (self.optimizer) {
        self.optimizer.optimize({
          data: umdData,
          path: path
        }, function(err, res) {
          var optimized;
          if (err) {
            return done(err);
          }
          optimized = res.data, path = res.path, map = res.map;
          writeData(optimized || umdData, dst, done);
        });
        return;
      }
      writeData(umdData, dst, done);
    };
    if (self.jshinter) {
      self.jshinter.lint({
        data: umdData,
        path: path,
        map: map
      }, function(msg) {
        if (msg) {
          logger.warn(path, msg);
        }
        finishCompilation();
      });
      return;
    }
    finishCompilation();
  };

  return AmdCompiler;

})();

AmdCompiler.brunchPluginName = 'amd-brunch';
