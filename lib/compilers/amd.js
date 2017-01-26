'use strict';
var AmdCompiler, JsHinter, NG_FACTORIES, UglifyJSOptimizer, _, _compileComponentFile, _compileIndex, _processComponent, _writeHTML, _writeMainData, _writeMainFile, anymatch, beautify, builder, defaultFactories, defaultOptions, factoryParse, fcache, fs, hasProp, log4js, logger, mkdirp, ngFactory, readComponents, ref, removeStrictOptions, sysPath, writeData;

log4js = global.log4js || (global.log4js = require('log4js'));

logger = log4js.getLogger('AmdCompiler');

fs = require('fs');

mkdirp = require('mkdirp');

beautify = require('js-beautify').js_beautify;

hasProp = Object.prototype.hasOwnProperty;

fcache = require('../../utils/fcache');

_processComponent = function(component, config, options, done) {
  var componentDir, count, give, isScript, j, k, len, len1, map, matcher, memo, name, opts, path, prop, ref, ref1, ref2, take, task, toCompile;
  if (component.umd) {
    done();
    return;
  }
  if (!(component.files instanceof Array)) {
    return done();
  }
  name = component.name;
  if (component.lazy) {
    logger.debug('lazy', name);
  } else {
    config.deps.push(name);
  }
  count = 0;
  take = function() {
    return ++count;
  };
  give = function(err) {
    var idx;
    if (--count === 0 || err) {
      if (!memo.hasJs) {
        delete config.paths[name];
        if (~(idx = config.deps.indexOf(name))) {
          config.deps.splice(idx, 1);
        }
      }
      done(err);
      give = function() {};
    }
  };
  take();
  memo = {
    processed: {},
    groupIndex: 0
  };
  componentDir = sysPath.join(options.paths.BOWER_COMPONENTS_ABSOLUTE_PATH, name);
  task = function(path, opts) {
    take();
    _compileComponentFile(path, component, config, memo, false, options, opts, give);
  };
  toCompile = {};
  ref = ['main', 'scripts'];
  for (j = 0, len = ref.length; j < len; j++) {
    prop = ref[j];
    isScript = prop === 'scripts';
    ref1 = component["package"][prop];
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      path = ref1[k];
      path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, '/');
      if (/[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(path)) {
        matcher = anymatch([path]);
        for (path in component.jsfiles) {
          if (!hasProp.call(toCompile, path) && matcher(path.replace(/[\\]/g, '/'))) {
            toCompile[path] = {
              isScript: isScript
            };
          }
        }
      } else if (!hasProp.call(toCompile, path) && component.jsfiles && hasProp.call(component.jsfiles, path)) {
        toCompile[path] = {
          isScript: isScript
        };
      }
    }
  }
  for (path in toCompile) {
    opts = toCompile[path];
    task(path, opts);
  }
  if (component.map) {
    ref2 = component.map;
    for (path in ref2) {
      map = ref2[path];
      path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, '/');
      if (component.jsfiles && hasProp.call(component.jsfiles, path)) {
        task(path, {
          map: map
        });
      }
    }
  }
  give();
};

_compileComponentFile = function(path, component, config, memo, isAbsolutePath, options, opts, done) {
  var absolutePath, configPaths, destFile, extname, groupIndex, name, pathext, paths, plugin, processed, shim;
  name = component.name;
  configPaths = options.paths;
  processed = memo.processed, groupIndex = memo.groupIndex;
  if (isAbsolutePath) {
    absolutePath = path;
    path = sysPath.relative(sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name), path);
  } else {
    absolutePath = sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name, path);
  }
  if (hasProp.call(processed, absolutePath)) {
    return done();
  }
  logger.trace("compiling bower file " + component.name + ": " + path);
  processed[absolutePath] = true;
  extname = sysPath.extname(path);
  destFile = sysPath.resolve(configPaths.BOWER_PUBLIC_PATH, name, path);
  memo.hasJs = true;
  pathext = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/');
  path = pathext.replace(/\.js$/, '');
  if (typeof config.paths[name] === 'undefined' && !opts.isScript && !opts.map) {
    if (component.exports) {
      shim = {
        exports: component.exports
      };
      if (typeof component.dependencies === 'object' && component.dependencies !== null) {
        shim.deps = Object.keys(component.dependencies);
      }
      config.shim[name] = shim;
    }
    if (typeof component.paths === 'string') {
      paths = [component.paths, path];
    } else if (Array.isArray(component.paths)) {
      paths = component.paths.slice(0);
      paths.push(path);
    } else {
      paths = path;
    }
    config.paths[name] = paths;
    config.map['*'][path] = name;
  } else {
    logger.debug("[" + name + "] add [" + path + "] as group");
    if (opts.map) {
      plugin = opts.map;
      if (hasProp.call(config.paths, plugin)) {
        done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path name"));
        return;
      }
      config.paths[plugin] = path;
      config.map['*'][path] = plugin;
    } else {
      if (component.exports) {
        plugin = name + ('-' + Math.random()).replace(/\D/g, '');
      } else {
        plugin = path;
      }
      if (hasProp.call(config.paths, plugin)) {
        done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path name"));
        return;
      }
      config.paths[plugin] = path;
    }
    if (component.exports) {
      config.shim[plugin] = {
        exports: component.exports,
        deps: [name]
      };
    }
    if (!hasProp.call(config.groups, name)) {
      config.groups[name] = [name];
    }
    config.groups[name].push(plugin);
  }
  done();
};

_writeMainFile = function(config, options, done) {
  var index, iterate, keys, length, pathBrowserify, paths, ref, source, srcPath, template, tplOpts, types;
  paths = options.paths;
  config = _.clone(config);
  pathBrowserify = config['path-browserify'] || 'umd-core/path-browserify';
  delete config['path-browserify'];
  srcPath = ((ref = options.options) != null ? ref.mainTemplate : void 0) || sysPath.resolve(__dirname, '../../templates/main.js');
  source = fs.readFileSync(srcPath, 'utf8');
  template = _.template(source);
  tplOpts = _.extend({
    require: require,
    __filename: srcPath,
    __dirname: sysPath.dirname(srcPath),
    config: config,
    pathBrowserify: pathBrowserify,
    paths: paths,
    optimize: !!options.optimizer,
    root: paths.APPLICATION_PATH,
    "public": paths.PUBLIC_PATH
  }, options.options.tplOpts);
  types = {
    build: [sysPath.resolve(paths.APPLICATION_PATH, 'work/rbuild.js'), 'work/rbuild.js'],
    unit: [sysPath.resolve(paths.APPLICATION_PATH, 'test/unit/test-main.js'), 'test/unit/test-main.js'],
    main: [sysPath.resolve(paths.PUBLIC_PATH, 'javascripts/main.js'), 'javascripts/main.js'],
    'main-dev': [sysPath.resolve(paths.PUBLIC_PATH, 'javascripts/main-dev.js'), 'javascripts/main-dev.js']
  };
  keys = Object.keys(types);
  index = 0;
  length = keys.length;
  iterate = function(err) {
    var data, opts;
    if (err || index === length) {
      done(err);
      return;
    }
    tplOpts.type = keys[index++];
    data = template(tplOpts);
    opts = tplOpts.type === 'main-dev' ? {
      optimizer: options.optimizer
    } : {};
    _writeMainData(data, types[tplOpts.type][0], types[tplOpts.type][1], opts, iterate);
  };
  iterate();
};

_writeMainData = function(data, dst, path, options, done) {
  mkdirp(sysPath.dirname(dst), function(err) {
    var writer;
    if (err) {
      return done(err);
    }
    writer = fs.createWriteStream(dst, {
      flags: 'w'
    });
    if (options.optimizer) {
      options.optimizer.optimize({
        data: data,
        path: path
      }, function(err, arg1) {
        var map, optimized, path;
        optimized = arg1.data, path = arg1.path, map = arg1.map;
        if (err) {
          return done(err);
        }
        writer.write(optimized || data, 'utf8', done);
        writer.end();
        return writer = null;
      });
    } else {
      writer.write(beautify(data, {
        indent_with_tabs: false,
        preserve_newlines: true,
        max_preserve_newlines: 4,
        space_in_paren: false,
        jslint_happy: false,
        brace_style: 'collapse',
        keep_array_indentation: false,
        keep_function_indentation: false,
        eval_code: false,
        unescape_strings: false,
        break_chained_methods: false,
        e4x: false,
        wrap_line_length: 0
      }), 'utf8', done);
      writer.end();
      writer = null;
    }
  });
};

_compileIndex = function(config, options, done) {
  var destFileSingle, e, err, error, error1, paths, source, srcpath, stats, template, tplOpts;
  paths = options.paths;
  srcpath = sysPath.join(paths.CLIENT_ASSETS_PATH, 'index.jst');
  try {
    stats = fs.lstatSync(srcpath);
    if (!stats.isFile()) {
      return done();
    }
  } catch (error) {
    e = error;
    return done();
  }
  source = fs.readFileSync(srcpath, 'utf8');
  tplOpts = {
    require: require,
    __filename: srcpath,
    __dirname: sysPath.dirname(srcpath),
    optimize: !!options.optimizer
  };
  try {
    template = _.template(source);
    destFileSingle = sysPath.resolve(paths.PUBLIC_PATH, 'index.single.html');
    _writeHTML(template(_.defaults({
      build: 'app'
    }, tplOpts)), destFileSingle, options.options, function(err) {
      var destFileClassic;
      if (err) {
        return done(err);
      }
      destFileClassic = sysPath.resolve(paths.PUBLIC_PATH, 'index.classic.html');
      return _writeHTML(template(_.defaults({
        build: 'web'
      }, tplOpts)), destFileClassic, options.options, function(err) {
        if (err) {
          return done(err);
        }
        logger.info('compiled index file');
        done();
      });
    });
  } catch (error1) {
    err = error1;
    done(err);
  }
};

_writeHTML = function(html, dst, options, done) {
  var beforeWrite;
  beforeWrite = options.beforeWrite;
  if (_.isFunction(beforeWrite)) {
    html = beforeWrite(html, dst, options);
    if (html instanceof Promise) {
      html.then(function(html) {
        fs.writeFile(dst, html, done);
      });
    } else {
      fs.writeFile(dst, html, done);
    }
  } else {
    fs.writeFile(dst, html, done);
  }
};

anymatch = require('anymatch');

sysPath = require('path');

_ = require('lodash');

UglifyJSOptimizer = require('uglify-js-brunch');

builder = require('../builder');

writeData = require('../writeData');

readComponents = require('../../utils/read-components');

ref = require('../../utils/method-parser'), factoryParse = ref.parse, NG_FACTORIES = ref.NG_FACTORIES;

JsHinter = require('./jshinter');

removeStrictOptions = function(str) {
  return str.replace(/^\s*(['"])use strict\1;?[^\n]*$/m, '');
};

defaultOptions = {};

defaultOptions.umdWrapper = function(data, options, modulePath) {
  var strict;
  strict = '';
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return "(function(require, global) {\n    " + strict + "\n    var deps = [];\n\n    " + data + "\n\n    if (typeof process === 'object' && typeof process.platform !== 'undefined') {\n        // NodeJs\n        module.exports = depsLoader.common(require, 'node', deps, factory, global);\n    } else if (typeof exports !== 'undefined') {\n        // CommonJS\n        module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);\n    } else if (typeof define === 'function' && define.amd) {\n        // AMD\n        depsLoader.amd(deps, factory, global);\n    }\n}(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));";
};

defaultOptions.comWrapper = function(data, options) {
  var strict;
  strict = '';
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return strict + "\nvar deps = [];\n\n" + data + "\n\n(function(require, global) {\n    // CommonJS\n    module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);\n}(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));";
};

defaultFactories = defaultOptions.factories = {};

ngFactory = function(plugin, modulePath, data, parsed) {
  var $dirname, $name, $shortName, args, body, declaration, head, locals, name, ngmethod, realPath;
  locals = parsed[0], name = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  body = "" + declaration + (args.join(', ')) + body;
  ngmethod = ctor.substring('ng'.length);
  realPath = plugin.config.paths.modules + '/' + modulePath;
  $name = modulePath.replace(/\//g, '.');
  $dirname = sysPath.dirname(realPath);
  $shortName = modulePath.replace(/.*\/([^\/]+)$/, '$1');
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.substring(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular" + (locals ? ', ' + locals : '') + ") {\n    var resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    " + body + "\n    \n    return depsLoader.createNgUsable(" + ctor + ", '" + ngmethod + "', '" + $name + "', '" + realPath + "', '" + $dirname + "', '" + $shortName + "', ngdeps, resolvedDeps, ngmap);\n}";
};

(function() {
  var j, len, name;
  for (j = 0, len = NG_FACTORIES.length; j < len; j++) {
    name = NG_FACTORIES[j];
    defaultFactories[name] = ngFactory;
  }
})();

defaultFactories.ngmodule = function(plugin, modulePath, data, parsed) {
  var args, body, declaration, head, locals, name;
  locals = parsed[0], name = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  body = "" + declaration + (args.join(', ')) + body;
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.substring(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular) {\n    /*jshint validthis: true */\n    var name = '" + (modulePath.replace(/\//g, '.')) + "',\n        resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);\n\n    " + body + "\n\n    ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));\n    return exports;\n}";
};

defaultFactories.freact = function(plugin, modulePath, data, parsed) {
  var args, body, declaration, head, locals, name;
  locals = parsed[0], name = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  return head + "\ndeps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});\n\nfunction factory(require, React, ReactDOM) {\n    /*jshint validthis: true */\n\n    " + declaration + (args.join(', ')) + body + "\n\n    return freact.apply(this, Array.prototype.slice.call(arguments, 3));\n}";
};

defaultFactories.factory = function(plugin, modulePath, data, parsed) {
  var args, body, declaration, head, index, locals, name;
  locals = parsed[0], name = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  if ('require' !== args[0]) {
    while ((index = args.indexOf('require')) !== -1) {
      args[index] = 'undefined';
    }
    args.unshift('require');
    data = "" + head + declaration + (args.join(', ')) + body;
  }
  return data;
};

module.exports = AmdCompiler = (function() {
  AmdCompiler.prototype.brunchPlugin = true;

  AmdCompiler.prototype.type = 'javascript';

  AmdCompiler.prototype.completer = true;

  function AmdCompiler(config) {
    var options, ref1;
    if (config == null) {
      config = {};
    }
    if (config.optimize) {
      this.optimizer = new UglifyJSOptimizer(config);
    }
    this.paths = builder.generateConfig(config).paths;
    this.paths["public"] = config.paths["public"];
    this.config = _.clone(config);
    this.sourceMaps = !!config.sourceMaps;
    this.amdDestination = config.modules.amdDestination;
    this.nameCleaner = config.modules.nameCleaner;
    this.options = options = _.merge({}, defaultOptions, (ref1 = config.plugins) != null ? ref1.amd : void 0);
    if (this.options.jshint) {
      this.jshinter = new JsHinter(config);
    }
    this.isIgnored = this.options.ignore ? anymatch(this.options.ignore) : config.conventions && config.conventions.vendor ? config.conventions.vendor : anymatch(/^(?:bower_components|vendor)/);
    this.isVendor = config.conventions && config.conventions.vendor;
    this.initializing = false;
    this.pending = [];
    this.requirejs = config.requirejs;
    this.packages = {};
    this.noAmd = this.options.noAmd;
    this.factories = _.clone(this.options.factories);
    this.parseOptions = {
      factories: Object.keys(this.factories)
    };
  }

  AmdCompiler.prototype.compile = function(params, done) {
    var comData, data, dst, err, error, locals, map, modulePath, name, parsed, path, ref1, umdData;
    data = params.data, path = params.path, map = params.map;
    if (this.options.bind) {
      data = data.replace(/function\s*\(\)\s*\{\s*return fn.apply\(me, arguments\);\s*\}/, 'fn.bind(me)');
    }
    umdData = comData = data;
    if (!this.isIgnored(params.path)) {
      try {
        ref1 = parsed = factoryParse(data, this.parseOptions), locals = ref1[0], name = ref1[1];
      } catch (error) {
        err = error;
        logger.error(err);
      }
      if (name) {
        modulePath = this.nameCleaner(path);
        if (hasProp.call(this.factories, name) && 'function' === typeof this.factories[name]) {
          data = this.factories[name](this, modulePath, data, parsed);
        }
        umdData = this.options.umdWrapper(data, _.clone(this.options), modulePath);
        comData = this.options.comWrapper(data, _.clone(this.options), modulePath);
      }
    }
    dst = sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path) + '.js');
    this._getComponents((function(_this) {
      return function(err, components) {
        var match, ref2, relpath;
        if (err) {
          return done(err);
        }
        if (/^bower_components[\/\\]/.test(path) && _this.isVendor && _this.isVendor(path)) {
          ref2 = path.match(/^bower_components[\/\\]([^\/\\]+)[\/\\](.+)/), match = ref2[0], name = ref2[1], relpath = ref2[2];
          components[name].jsfiles || (components[name].jsfiles = {});
          components[name].jsfiles[relpath] = true;
        }
        _this._lint({
          comData: comData,
          umdData: umdData,
          path: path,
          map: map,
          dst: dst
        }, function(err, options) {
          if (err) {
            return done(err);
          }
          if (_this.noAmd) {
            done(err, {
              data: comData,
              path: path
            });
            return;
          }
          _this._writeData(options, function(err, options) {
            var dirname;
            if (err) {
              return done(err);
            }
            comData = options.comData, umdData = options.umdData, path = options.path;
            if (!_this.isVendor || !_this.isVendor(path)) {
              dirname = sysPath.dirname(path);
              _this.packages[dirname] || (_this.packages[dirname] = {});
              _this.packages[dirname][path.replace(/\.[^\.]+$/, '')] = true;
            }
            done(err, {
              data: comData,
              path: path
            });
          });
        });
      };
    })(this));
  };

  AmdCompiler.prototype.onCompile = function(generatedFiles, changedAssets) {
    var config, count, done, give, options, plugin, reject, resolve, take;
    if (generatedFiles.length === 0 && changedAssets.length === 0) {
      return;
    }
    options = _.pick(this, ['paths', 'lastPackages', 'options']);
    resolve = function() {};
    reject = function() {};
    done = function(err) {
      resolve();
    };
    config = {
      enforceDefine: false,
      baseUrl: this.paths.CLIENT_MODULES_URL,
      paths: {},
      groups: {},
      shim: {},
      deps: []
    };
    config = _.defaultsDeep({}, this.requirejs, config);
    config.map || (config.map = {});
    config.map['*'] || (config.map['*'] = {});
    plugin = this;
    count = 0;
    take = function() {
      return ++count;
    };
    give = function(err) {
      if (--count === 0 || err) {
        if (err) {
          logger.error('Error while building bower components', err);
          done(err);
          return;
        }
        _writeMainFile(config, options, function(err) {
          if (err) {
            logger.error('Error while building bower components', err);
            done(err);
            return;
          }
          plugin._compilePackages(generatedFiles, changedAssets);
          _compileIndex(config, options, done);
        });
      }
    };
    take();
    this._getComponents(function(err, components) {
      var component, name;
      if (err) {
        return give(err);
      }
      for (name in components) {
        component = components[name];
        take();
        _processComponent(component, config, options, give);
      }
      give();
    });
    return new Promise(function(_resolve, _reject) {
      resolve = _resolve;
      reject = _reject;
    });
  };

  AmdCompiler.prototype._getComponents = function(done) {
    var self;
    if (this.components) {
      done(null, this.components);
      return;
    }
    if (this.initializing) {
      this.pending.push(done);
      return;
    }
    self = this;
    self.initializing = true;
    readComponents(sysPath.resolve(self.paths.APPLICATION_PATH), 'bower', function(err, components) {
      var component, fn, j, len;
      self.initializing = false;
      if (err) {
        return done(err);
      }
      self.components = {};
      for (j = 0, len = components.length; j < len; j++) {
        component = components[j];
        self.components[component.name] = component;
      }
      components = self.components;
      done(err, components);
      while (fn = self.pending.shift()) {
        fn(err, components);
      }
    });
  };

  AmdCompiler.prototype._lint = function(options, done) {
    var comData, dst, linter, map, path, umdData;
    if (linter = this.jshinter) {
      comData = options.comData, umdData = options.umdData, path = options.path, map = options.map, dst = options.dst;
      linter.lint({
        data: umdData,
        path: path,
        map: map
      }, function(msg) {
        if (msg && linter.warnOnly) {
          logger.warn(path, msg);
          msg = null;
        }
        done(msg, options);
      });
      return;
    }
    done(null, options);
  };

  AmdCompiler.prototype._writeData = function(options, done) {
    var dst, map, next, path, umdData;
    umdData = options.umdData, path = options.path, map = options.map, dst = options.dst;
    next = function(err) {
      if (err) {
        return done(err);
      }
      done(err, options);
    };
    if (this.optimizer) {
      this.optimizer.optimize({
        data: umdData,
        path: path
      }, function(err, res) {
        var optimized;
        if (err) {
          return next(err);
        }
        optimized = res.data, path = res.path, map = res.map;
        writeData(optimized || umdData, dst, next);
      });
      return;
    }
    writeData(umdData, dst, next);
  };

  AmdCompiler.prototype._compilePackages = function(generatedFiles, changedAssets) {
    var absPath, arg, args, basename, content, deps, dirname, hasChanged, hasFile, i, j, keys, lastPackages, len, match, packageName, packageNameWithoutExt, packages, path, paths, plugin, ref1, status;
    plugin = this;
    lastPackages = plugin.lastPackages, packages = plugin.packages;
    if (!plugin.options["package"]) {
      return false;
    }
    generatedFiles.forEach(function(generatedFile, index) {
      generatedFile.sourceFiles.forEach(function(file, index) {
        var dirname, dst, path, ref1;
        if (file.removed) {
          path = file.path;
          if (path) {
            dirname = sysPath.dirname(path).replace(/[\\]/g, '/');
            if ((ref1 = packages[dirname]) != null) {
              delete ref1[path.replace(/\.[^\.]+$/, '')];
            }
            dst = sysPath.join(plugin.paths.PUBLIC_PATH, plugin.amdDestination(path) + '.js');
            fs.unlinkSync(dst);
          }
        }
      });
    });
    hasChanged = false;
    for (dirname in packages) {
      paths = packages[dirname];
      if (!lastPackages || !_.isEqual(lastPackages[dirname], paths)) {
        hasChanged = true;
        packageNameWithoutExt = fcache.packageName.replace(/\.[^\.]+$/, '');
        packageName = sysPath.join(dirname, fcache.packageName);
        absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep);
        paths = Object.keys(paths).sort();
        if (paths.length === 0) {
          delete packages[dirname];
          fs.unlinkSync(absPath);
          builder.fswatcher.emit('unlink', absPath);
          continue;
        }
        deps = [];
        args = [];
        keys = [];
        i = 0;
        for (j = 0, len = paths.length; j < len; j++) {
          path = paths[j];
          hasFile = true;
          ref1 = path.match(/([^\/\\]+)(?:\.[^\.]+)?$/), match = ref1[0], basename = ref1[1];
          if (basename === packageNameWithoutExt) {
            continue;
          }
          arg = 'arg' + i;
          args.push(arg);
          deps.push('./' + basename);
          keys.push('"' + basename + '": ' + arg);
          i++;
        }
        if (!hasFile) {
          return '';
        }
        content = "deps = [\n    \"" + (deps.join('",\n    "')) + "\"\n];\n\nfunction factory(\n    " + (args.join(',\n    ')) + "\n) {\n    return {\n        " + (keys.join(',\n        ')) + "\n    };\n}";
        status = fcache.updateFakeFile(packageName, content);
        if (status === 0) {
          builder.fswatcher.emit('add', absPath);
        } else {
          builder.fswatcher.emit('change', absPath);
        }
      }
    }
    plugin.lastPackages = _.cloneDeep(packages);
    return hasChanged;
  };

  return AmdCompiler;

})();

AmdCompiler.brunchPluginName = 'amd-brunch';
