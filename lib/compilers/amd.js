"use strict";
var AmdCompiler, NG_FACTORIES, UglifyJSOptimizer, _compileComponentFile, _compileIndex, _processComponent, _template, _writeHTML, _writeMainData, _writeMainFile, anymatch, beautify, builder, clone, cloneDeep, defaultFactories, defaultOptions, defaults, defaultsDeep, extend, factoryParse, fcache, fs, hasProp, isEqual, isFunction, isObjectLike, log4js, logger, merge, mkdirp, modules, ngFactory, pick, readComponents, ref, removeStrictOptions, sysPath, writeData;

log4js = global.log4js || (global.log4js = require("log4js"));

logger = log4js.getLogger("AmdCompiler");

fs = require("fs");

sysPath = require("path");

mkdirp = require("mkdirp");

beautify = require("js-beautify").js_beautify;

hasProp = Object.prototype.hasOwnProperty;

fcache = require("../../utils/fcache");

anymatch = require("anymatch");

clone = require("lodash/clone");

cloneDeep = require("lodash/cloneDeep");

defaults = require("lodash/defaults");

defaultsDeep = require("lodash/defaultsDeep");

extend = require("lodash/extend");

isEqual = require("lodash/isEqual");

isFunction = require("lodash/isFunction");

isObjectLike = require("lodash/isObjectLike");

merge = require("lodash/merge");

pick = require("lodash/pick");

_template = require("./jst/template");

UglifyJSOptimizer = require("uglify-js-brunch");

modules = require("../../utils/modules");

_processComponent = function(component, config, options, done) {
  var componentDir, count, give, isScript, j, k, len, len1, map, matcher, memo, name, opts, path, prop, ref, ref1, ref2, take, task, toCompile;
  if (component.umd) {
    done();
    return;
  }
  if (!(component.files instanceof Array)) {
    done();
    return;
  }
  name = component.name;
  if (component.lazy) {
    logger.debug("lazy", name);
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
      give = Function.prototype;
    }
  };
  take();
  memo = {
    processed: {}
  };
  componentDir = sysPath.join(options.paths.BOWER_COMPONENTS_ABSOLUTE_PATH, name);
  task = function(path, opts) {
    take();
    _compileComponentFile(path, component, config, memo, false, options, opts, give);
  };
  toCompile = {};
  ref = ["main", "scripts"];
  for (j = 0, len = ref.length; j < len; j++) {
    prop = ref[j];
    isScript = prop === "scripts";
    ref1 = component.package[prop];
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      path = ref1[k];
      path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, "/");
      if (/[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(path)) {
        matcher = anymatch([path]);
        for (path in component.jsfiles) {
          if (!hasProp.call(toCompile, path) && matcher(path.replace(/[\\]/g, "/"))) {
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
      path = sysPath.resolve(componentDir, path);
      path = sysPath.relative(componentDir, path).replace(/[\\]/g, "/");
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
  var absolutePath, configPaths, deps, exports, name, pathext, paths, plugin, processed, shim;
  name = component.name;
  configPaths = options.paths;
  processed = memo.processed;
  if (isAbsolutePath) {
    absolutePath = path;
    path = sysPath.relative(sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name), path);
  } else {
    absolutePath = sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name, path);
  }
  if (hasProp.call(processed, absolutePath)) {
    done();
    return;
  }
  processed[absolutePath] = true;
  memo.hasJs = true;
  pathext = configPaths.BOWER_COMPONENTS_URL + "/" + sysPath.join(name, path).replace(/[\\]/g, "/");
  path = pathext.replace(/\.js$/, "");
  exports = component.exports;
  if (typeof config.paths[name] === "undefined" && !opts.isScript && !opts.map) {
    if (exports) {
      shim = {
        exports: exports
      };
      if (typeof component.dependencies === "object" && component.dependencies !== null) {
        shim.deps = Object.keys(component.dependencies);
      }
      config.shim[name] = shim;
    }
    if (typeof component.paths === "string") {
      paths = [component.paths, path];
    } else if (Array.isArray(component.paths)) {
      paths = component.paths.slice(0);
      paths.push(path);
    } else {
      paths = path;
    }
    config.paths[name] = paths;
    config.map["*"][path] = name;
  } else {
    if (isObjectLike(opts.map)) {
      if (opts.map.exports) {
        exports = opts.map.exports;
      }
      paths = opts.map.paths;
      if ("string" === typeof paths) {
        paths = [paths];
      } else if (!Array.isArray(paths)) {
        paths = null;
      }
      if (opts.map.dependencies) {
        deps = Object.keys(opts.map.dependencies);
      }
      plugin = opts.map.name;
    } else if ("string" === typeof opts.map) {
      plugin = opts.map;
    }
    if (plugin) {
      if (hasProp.call(config.paths, plugin)) {
        done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path " + config.paths[plugin]));
        return;
      }
      if (Array.isArray(paths)) {
        paths.push(path);
      } else {
        paths = path;
      }
      config.paths[plugin] = paths;
      config.map["*"][path] = plugin;
    } else {
      if (exports) {
        plugin = name + "_" + Math.random().toString(36).slice(2);
      } else {
        plugin = path;
      }
      if (hasProp.call(config.paths, plugin)) {
        done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path " + config.paths[plugin]));
        return;
      }
      config.paths[plugin] = path;
    }
    if (exports) {
      if (deps) {
        if (deps.indexOf(name) === -1) {
          deps.unshift(name);
        }
      } else {
        deps = [name];
      }
      if (hasProp.call(config.groups, name)) {
        deps = deps.concat(config.groups[name]);
      }
      config.shim[plugin] = {
        exports: exports,
        deps: deps
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
  var filename, imports, index, iterate, keys, length, localOptions, pathBrowserify, paths, source, template, tplOpts, types;
  paths = options.paths;
  config = clone(config);
  pathBrowserify = config["path-browserify"] || "umd-core/path-browserify";
  delete config["path-browserify"];
  localOptions = options.options || {};
  filename = localOptions.mainTemplate || sysPath.resolve(__dirname, "../../templates/main.js");
  source = fs.readFileSync(filename, "utf8");
  imports = modules.makeModule(filename, module);
  template = _template(source, {
    variable: "root",
    imports: imports
  });
  tplOpts = extend({
    config: config,
    pathBrowserify: pathBrowserify,
    paths: paths,
    optimize: options.config.isProduction,
    root: paths.APPLICATION_PATH,
    "public": paths.PUBLIC_PATH
  }, imports, localOptions.tplOpts);
  types = {
    build: [sysPath.resolve(paths.APPLICATION_PATH, "work/rbuild.js"), "work/rbuild.js"],
    unit: [localOptions.unitBuildDest || sysPath.resolve(paths.APPLICATION_PATH, "test/unit/test-main.js"), "test/unit/test-main.js"],
    main: [sysPath.resolve(paths.PUBLIC_PATH, "javascripts/main.js"), "javascripts/main.js"],
    "main-dev": [sysPath.resolve(paths.PUBLIC_PATH, "javascripts/main-dev.js"), "javascripts/main-dev.js"]
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
    opts = tplOpts.type === "main-dev" ? {
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
      done(err);
      return;
    }
    writer = fs.createWriteStream(dst, {
      flags: "w"
    });
    if (options.optimizer) {
      options.optimizer.optimize({
        data: data,
        path: path
      }, function(err, arg) {
        var optimized;
        optimized = arg.data;
        if (err) {
          done(err);
          return;
        }
        writer.write(optimized || data, "utf8", done);
        writer.end();
        writer = null;
      });
    } else {
      writer.write(beautify(data, {
        indent_with_tabs: false,
        preserve_newlines: true,
        max_preserve_newlines: 4,
        space_in_paren: false,
        jslint_happy: false,
        brace_style: "collapse",
        keep_array_indentation: false,
        keep_function_indentation: false,
        eval_code: false,
        unescape_strings: false,
        break_chained_methods: false,
        e4x: false,
        wrap_line_length: 0
      }), "utf8", done);
      writer.end();
      writer = null;
    }
  });
};

_compileIndex = function(config, options, done) {
  var destFileSingle, err, paths, source, srcpath, stats, template, tplOpts;
  paths = options.paths;
  srcpath = sysPath.join(paths.CLIENT_ASSETS_PATH, "index.jst");
  try {
    stats = fs.lstatSync(srcpath);
    if (!stats.isFile()) {
      done();
      return;
    }
  } catch (error) {
    done();
    return;
  }
  source = fs.readFileSync(srcpath, "utf8");
  tplOpts = {
    require: require,
    __filename: srcpath,
    __dirname: sysPath.dirname(srcpath),
    optimize: Boolean(options.optimizer)
  };
  try {
    template = _template(source, {
      variable: "root"
    });
    destFileSingle = sysPath.resolve(paths.PUBLIC_PATH, "index.single.html");
    _writeHTML(template(defaults({
      build: "app"
    }, tplOpts)), destFileSingle, options.options, function(err) {
      var destFileClassic;
      if (err) {
        done(err);
        return;
      }
      destFileClassic = sysPath.resolve(paths.PUBLIC_PATH, "index.classic.html");
      _writeHTML(template(defaults({
        build: "web"
      }, tplOpts)), destFileClassic, options.options, function(err) {
        if (err) {
          done(err);
          return;
        }
        logger.info("compiled index file");
        done();
      });
    });
  } catch (error) {
    err = error;
    done(err);
  }
};

_writeHTML = function(html, dst, options, done) {
  var beforeWrite;
  beforeWrite = options.beforeWrite;
  if (isFunction(beforeWrite)) {
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

builder = require("../builder");

writeData = require("../writeData");

readComponents = require("../../utils/read-components");

ref = require("../../utils/method-parser"), factoryParse = ref.parse, NG_FACTORIES = ref.NG_FACTORIES;

removeStrictOptions = function(str) {
  return str.replace(/^\s*(['"])use strict\1;?[^\n]*$/m, "");
};

defaultOptions = {};

defaultOptions.umdWrapper = function(data, options, modulePath) {
  var strict;
  strict = "";
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return "(function(require, global) {\n    " + strict + "\n    var deps = [];\n\n    " + data + "\n\n    if (typeof process === 'object' && typeof process.platform !== 'undefined') {\n        // NodeJs\n        module.exports = depsLoader.common(require, 'node', deps, factory, global);\n    } else if (typeof exports !== 'undefined') {\n        // CommonJS\n        module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);\n    } else if (typeof define === 'function' && define.amd) {\n        // AMD\n        depsLoader.amd(deps, factory, global);\n    }\n}(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));";
};

defaultOptions.comWrapper = function(data, options) {
  var strict;
  strict = "";
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return strict + "\nvar deps = [];\n\n" + data + "\n\n(function(require, global) {\n    // CommonJS\n    module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);\n}(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));";
};

defaultFactories = defaultOptions.factories = {};

ngFactory = function(plugin, modulePath, data, parsed) {
  var $dirname, $name, $shortName, args, body, ctor, declaration, head, locals, ngmethod, realPath;
  locals = parsed[0], ctor = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  body = String(declaration) + args.join(", ") + body;
  ngmethod = ctor.slice("ng".length);
  realPath = plugin.config.paths.modules + "/" + modulePath;
  $name = modulePath.replace(/\//g, ".");
  $dirname = sysPath.dirname(realPath);
  $shortName = modulePath.replace(/.*\/([^\/]+)$/, "$1");
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.slice(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular" + (locals ? ", " + locals : "") + ") {\n    var resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    " + body + "\n    \n    return depsLoader.createNgUsable(" + ctor + ", '" + ngmethod + "', '" + $name + "', '" + realPath + "', '" + $dirname + "', '" + $shortName + "', ngdeps, resolvedDeps, ngmap);\n}";
};

(function() {
  var j, len, name;
  for (j = 0, len = NG_FACTORIES.length; j < len; j++) {
    name = NG_FACTORIES[j];
    defaultFactories[name] = ngFactory;
  }
})();

defaultFactories.ngmodule = function(plugin, modulePath, data, parsed) {
  var _UNUSED_, args, body, declaration, head;
  _UNUSED_ = parsed[0], _UNUSED_ = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  body = String(declaration) + args.join(", ") + body;
  return "var ngdeps = [];\n\n" + head + "\ndeps.unshift({amd: 'angular', common: '!angular'});\nvar ngoffset = deps.length, ngmap = {};\n\nfor (var i = 0, len = ngdeps.length, dep; i < len; i++) {\n    dep = ngdeps[i];\n    if ('string' === typeof dep && '/' === dep.charAt(0)) {\n        ngdeps[i] = dep.slice(1);\n        dep = ngdeps[i];\n        // deps.length - ngoffset + 1 correspond to ng dependency index\n        // that index will be used to know which ngdeps must only by a deps\n        // and therefore removed from ngdeps\n        ngmap[deps.length - ngoffset + 1] = i;\n        deps.push(dep);\n    }\n}\n\nfunction factory(require, angular) {\n    /*jshint validthis: true */\n    var name = '" + modulePath.replace(/\//g, ".") + "',\n        resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);\n\n    var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);\n\n    " + body + "\n\n    // eslint-disable-next-line no-invalid-this\n    ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));\n    return exports;\n}";
};

defaultFactories.freact = function(plugin, modulePath, data, parsed) {
  var _UNUSED_, args, body, declaration, head;
  _UNUSED_ = parsed[0], _UNUSED_ = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  return head + "\ndeps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});\n\nfunction factory(require, React, ReactDOM) {\n    /*jshint validthis: true */\n\n    " + declaration + args.join(", ") + body + "\n\n    // eslint-disable-next-line no-invalid-this\n    return freact.apply(this, Array.prototype.slice.call(arguments, 3));\n}";
};

defaultFactories.factory = function(plugin, modulePath, data, parsed) {
  var _UNUSED_, args, body, declaration, head, index;
  _UNUSED_ = parsed[0], _UNUSED_ = parsed[1], args = parsed[2], head = parsed[3], declaration = parsed[4], body = parsed[5];
  if ("require" !== args[0]) {
    while ((index = args.indexOf("require")) !== -1) {
      args[index] = "undefined";
    }
    args.unshift("require");
    data = String(head) + declaration + args.join(", ") + body;
  }
  return data;
};

module.exports = AmdCompiler = (function() {
  AmdCompiler.prototype.brunchPlugin = true;

  AmdCompiler.prototype.type = "javascript";

  AmdCompiler.prototype.completer = true;

  function AmdCompiler(config) {
    var EsLinter, JsHinter, ref1;
    if (config == null) {
      config = {};
    }
    if (config.isProduction) {
      this.optimizer = new UglifyJSOptimizer(config);
    }
    this.paths = builder.generateConfig(config).paths;
    this.paths.public = config.paths.public;
    this.joinTo = config.files.javascripts.joinTo;
    this.config = clone(config);
    this.sourceMaps = Boolean(config.sourceMaps);
    this.amdDestination = config.modules.amdDestination;
    this.nameCleaner = config.modules.nameCleaner;
    this.options = merge({}, defaultOptions, (ref1 = config.plugins) != null ? ref1.amd : void 0);
    if (this.options.eslint) {
      EsLinter = require("./eslinter");
      this.linter = new EsLinter(config);
    } else if (this.options.jshint) {
      JsHinter = require("./jshinter");
      this.linter = new JsHinter(config);
    }
    this.isIgnored = this.options.ignore ? anymatch(this.options.ignore) : config.conventions && config.conventions.vendor ? config.conventions.vendor : anymatch(/^(?:bower_components|vendor)/);
    this.isVendor = config.conventions && config.conventions.vendor;
    this.initializing = false;
    this.pending = [];
    this.requirejs = config.requirejs;
    this.packages = {};
    this.deepacks = {};
    this.noAmd = this.options.noAmd;
    this.factories = clone(this.options.factories);
    this.parseOptions = {
      factories: Object.keys(this.factories)
    };
  }

  AmdCompiler.prototype.compile = function(params, done) {
    var _UNUSED_, comData, data, dst, err, joinTo, map, modulePath, name, parsed, path, ref1, umdData;
    joinTo = this.joinTo;
    data = params.data, path = params.path, map = params.map;
    if (this.options.bind) {
      data = data.replace(/function\s*\(\)\s*\{\s*return fn.apply\(me, arguments\);\s*\}/, "fn.bind(me)");
    }
    umdData = comData = data;
    if (!this.isIgnored(params.path)) {
      try {
        ref1 = parsed = factoryParse(data, this.parseOptions), _UNUSED_ = ref1[0], name = ref1[1];
      } catch (error) {
        err = error;
        logger.error(err);
      }
      if (name) {
        modulePath = this.nameCleaner(path);
        if (hasProp.call(this.factories, name) && "function" === typeof this.factories[name]) {
          data = this.factories[name](this, modulePath, data, parsed);
        }
        umdData = this.options.umdWrapper(data, clone(this.options), modulePath);
        comData = this.options.comWrapper(data, clone(this.options), modulePath);
      }
    }
    dst = sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path) + ".js");
    this._getComponents((function(_this) {
      return function(err, components) {
        var match, ref2, relpath;
        if (err) {
          done(err);
          return;
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
            done(err);
            return;
          }
          if (_this.noAmd) {
            done(err, {
              data: comData,
              path: path
            });
            return;
          }
          _this._writeData(options, function(err, options) {
            var deepackName, dirname, pathWithoutExt, reg;
            if (err) {
              done(err);
              return;
            }
            comData = options.comData, umdData = options.umdData, path = options.path;
            if (!_this.isVendor || !_this.isVendor(path)) {
              pathWithoutExt = path.replace(/\.[^\.]+$/, "");
              deepackName = fcache.deepackName;
              reg = /[\/\\]/g;
              while (match = reg.exec(path)) {
                dirname = path.slice(0, match.index);
                if (_this.canJoin(dirname + "/" + deepackName, joinTo)) {
                  if (!hasProp.call(_this.deepacks, dirname)) {
                    _this.deepacks[dirname] = {};
                  }
                  _this.deepacks[dirname][pathWithoutExt] = path;
                }
              }
              if (!hasProp.call(_this.packages, dirname)) {
                _this.packages[dirname] = {};
              }
              _this.packages[dirname][pathWithoutExt] = path;
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

  AmdCompiler.prototype.canJoin = function(path, joinTo) {
    var file, reg;
    if (/^bower_components[\/\\]/.test(path) && !/^bower_components[\/\\][^\/\\]+[\/\\]/.test(path)) {
      return false;
    }
    for (file in joinTo) {
      reg = joinTo[file];
      if (reg.test(path)) {
        return true;
      }
    }
    return false;
  };

  AmdCompiler.prototype.onCompile = function(generatedFiles, changedAssets) {
    var components, config, count, done, give, options, plugin, resolve, take;
    if (generatedFiles.length === 0 && changedAssets.length === 0) {
      return null;
    }
    options = pick(this, ["paths", "lastPackages", "options", "config", "optimizer"]);
    resolve = Function.prototype;
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
    config = defaultsDeep({}, this.requirejs, config);
    config.map || (config.map = {});
    config.map["*"] || (config.map["*"] = {});
    plugin = this;
    count = 0;
    take = function() {
      return ++count;
    };
    give = function(err) {
      if (--count === 0 || err) {
        if (err) {
          logger.error("Error while building bower components", err);
          done(err);
          return;
        }
        _writeMainFile(config, options, function(err) {
          if (err) {
            logger.error("Error while building bower components", err);
            done(err);
            return;
          }
          plugin._compilePackages(generatedFiles, changedAssets, components);
          _compileIndex(config, options, done);
        });
      }
    };
    take();
    components = null;
    this._getComponents(function(err, _components) {
      var component, name;
      if (err) {
        give(err);
        return;
      }
      components = _components;
      for (name in components) {
        component = components[name];
        take();
        _processComponent(component, config, options, give);
      }
      give();
    });
    return new Promise(function(_resolve) {
      resolve = _resolve;
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
    readComponents(sysPath.resolve(self.paths.APPLICATION_PATH), "bower", function(err, components) {
      var component, fn, j, len;
      self.initializing = false;
      if (err) {
        done(err);
        return;
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
    var linter, map, path, ref1, umdData;
    if (linter = this.linter) {
      umdData = options.umdData, path = options.path, map = options.map;
      if ((ref1 = sysPath.basename(path)) === fcache.packageName || ref1 === fcache.deepackName) {
        done(null, options);
        return;
      }
      linter.lint({
        data: umdData,
        path: path,
        map: map
      }, function(msg, output) {
        if (msg && linter.warnOnly) {
          logger.warn(path, msg);
          msg = null;
        }
        if (output) {
          options.umdData = output;
        }
        done(msg, options);
      });
      return;
    }
    done(null, options);
  };

  AmdCompiler.prototype._writeData = function(options, done) {
    var dst, next, path, umdData;
    umdData = options.umdData, path = options.path, dst = options.dst;
    next = function(err) {
      if (err) {
        done(err);
        return;
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
          next(err);
          return;
        }
        optimized = res.data, path = res.path;
        writeData(optimized || umdData, dst, next);
      });
      return;
    }
    writeData(umdData, dst, next);
  };

  AmdCompiler.prototype._compilePackages = function(generatedFiles, changedAssets, components) {
    var deepacks, packages, plugin, res1, res2;
    plugin = this;
    if (!plugin.options.package) {
      return false;
    }
    packages = plugin.packages, deepacks = plugin.deepacks;
    generatedFiles.forEach(function(generatedFile, index) {
      generatedFile.sourceFiles.forEach(function(file, index) {
        var dirname, dst, match, path, ref1, ref2, reg;
        if (!file.removed) {
          return;
        }
        path = file.path;
        if (!path) {
          return;
        }
        reg = /[\/\\]/g;
        while (match = reg.exec(path)) {
          dirname = path.slice(0, match.index).replace(/[\\]/g, "/");
          if ((ref1 = deepacks[dirname]) != null) {
            delete ref1[path.replace(/\.[^\.]+$/, "")];
          }
        }
        if ((ref2 = packages[dirname]) != null) {
          delete ref2[path.replace(/\.[^\.]+$/, "")];
        }
        dst = sysPath.join(plugin.paths.PUBLIC_PATH, plugin.amdDestination(path) + ".js");
        fs.unlinkSync(dst);
      });
    });
    res1 = this._processPackages(plugin, "package", components);
    if (!plugin.options.deepack) {
      return res1;
    }
    res2 = this._processPackages(plugin, "deepack", components);
    return res1 || res2;
  };

  AmdCompiler.prototype._processPackages = function(plugin, name, components) {
    var _UNUSED_, __deepackName, __packageName, _dirname, _module, _packageName, absPath, basename, content, deps, dirname, getIndex, hasChanged, hasFile, i, j, k, key, lastIndex, lastPackages, lastPackagesKey, len, len1, match, obj, packageName, packages, path, paths, ref1, ref2, reg, relModulePath, relpath, sorter, status;
    packages = plugin[name + "s"];
    lastPackagesKey = "last" + name[0].toUpperCase() + name.slice(1) + "s";
    lastPackages = this[lastPackagesKey];
    _packageName = fcache[name + "Name"];
    __packageName = fcache.packageName.replace(/\.[^\.]+$/, "");
    __deepackName = fcache.deepackName.replace(/\.[^\.]+$/, "");
    hasChanged = false;
    if (!lastPackages) {
      lastPackages = {};
    }
    for (dirname in lastPackages) {
      paths = lastPackages[dirname];
      if (hasProp.call(packages, dirname)) {
        continue;
      }
      hasChanged = true;
      packageName = sysPath.join(dirname, _packageName);
      absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep);
      paths = Object.keys(paths).sort();
      if (paths.length === 0) {
        continue;
      }
      hasFile = false;
      for (j = 0, len = paths.length; j < len; j++) {
        path = paths[j];
        ref1 = path.match(/([^\/\\]+)(?:\.[^\.]+)?$/), _UNUSED_ = ref1[0], basename = ref1[1];
        if (basename === __packageName || basename === __deepackName) {
          continue;
        }
        hasFile = true;
        break;
      }
      if (!hasFile) {
        continue;
      }
      fcache.removeFakeFile(packageName);
      builder.fswatcher.emit("unlink", absPath);
    }
    getIndex = function(path) {
      var file, files, i, k, len1, ref2;
      ref2 = dirname.match(/^bower_components[\/\\]([^\/\\]+)/), _UNUSED_ = ref2[0], name = ref2[1];
      files = components[name].files;
      if (files.length === 1) {
        return 0;
      }
      path = sysPath.join(plugin.paths.APPLICATION_PATH, path);
      for (i = k = 0, len1 = files.length; k < len1; i = ++k) {
        file = files[i];
        if (/[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(file)) {
          if (anymatch(file)(path)) {
            return i;
          }
        } else if (file === path) {
          return i;
        }
      }
      return -1;
    };
    sorter = function(a, b) {
      var ia, ib;
      a = paths[a];
      b = paths[b];
      ia = getIndex(a);
      ib = getIndex(b);
      if (ia > ib) {
        return 1;
      }
      if (ia < ib) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      if (a < b) {
        return -1;
      }
      return 0;
    };
    for (dirname in packages) {
      paths = packages[dirname];
      if (isEqual(lastPackages[dirname], paths)) {
        continue;
      }
      hasChanged = true;
      packageName = sysPath.join(dirname, _packageName);
      absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep);
      if (/^bower_components[\/\\]/.test(dirname)) {
        paths = Object.keys(paths).sort(sorter);
      } else {
        paths = Object.keys(paths).sort();
      }
      if (paths.length === 0) {
        delete packages[dirname];
        fcache.removeFakeFile(packageName);
        fs.unlinkSync(absPath);
        builder.fswatcher.emit("unlink", absPath);
        continue;
      }
      deps = [];
      _module = {};
      i = 0;
      hasFile = false;
      for (k = 0, len1 = paths.length; k < len1; k++) {
        path = paths[k];
        relpath = path.slice(dirname.length + 1);
        ref2 = sysPath.parse(relpath), basename = ref2.name, _dirname = ref2.dir;
        if (basename === __packageName || basename === __deepackName) {
          continue;
        }
        if (_dirname.length !== 0) {
          _dirname = _dirname.replace(/\\/g, "/") + "/";
        }
        relModulePath = _dirname + basename;
        hasFile = true;
        deps.push("./" + relModulePath);
        obj = _module;
        reg = /\//g;
        lastIndex = 0;
        while (match = reg.exec(relModulePath)) {
          key = relModulePath.slice(lastIndex, match.index);
          lastIndex = reg.lastIndex;
          if (!hasProp.call(obj, key)) {
            obj[key] = {};
          }
          obj = obj[key];
        }
        obj[basename] = i;
        i++;
      }
      if (!hasFile) {
        continue;
      }
      content = "deps = [\n    \"" + deps.join("\",\n    \"") + "\"\n];\n\nfunction factory() {\n    var args = Array.prototype.slice.call(arguments, arguments.length - " + i + ");\n    return " + this.stringifyModule(_module, 4, 4, true) + ";\n}";
      status = fcache.updateFakeFile(packageName, content);
      if (status === 0) {
        builder.fswatcher.emit("add", absPath);
      } else {
        builder.fswatcher.emit("change", absPath);
      }
    }
    plugin[lastPackagesKey] = cloneDeep(packages);
    return hasChanged;
  };

  AmdCompiler.prototype.stringifyModule = function(module, initialSpace, space, order) {
    var indent, initialIndent, j, key, keys, len, str, value;
    if (initialSpace == null) {
      initialSpace = 0;
    }
    if (space == null) {
      space = 4;
    }
    initialIndent = " ".repeat(initialSpace);
    indent = " ".repeat(space);
    str = [];
    initialSpace += space;
    keys = Object.keys(module);
    if (order) {
      keys.sort();
    }
    for (j = 0, len = keys.length; j < len; j++) {
      key = keys[j];
      value = module[key];
      if (isObjectLike(value)) {
        str.push(JSON.stringify(key) + ": " + this.stringifyModule(value, initialSpace, space, order));
      } else {
        str.push(JSON.stringify(key) + ": args[" + value + "]");
      }
    }
    if (str.length === 0) {
      return "{}";
    }
    indent = initialIndent + indent;
    if (indent.length !== 0) {
      indent = "\n" + indent;
      initialIndent = "\n" + initialIndent;
    }
    return "{" + indent + str.join("," + indent) + initialIndent + "}";
  };

  return AmdCompiler;

})();

AmdCompiler.brunchPluginName = "amd-brunch";
