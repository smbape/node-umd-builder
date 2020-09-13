"use strict";
var AmdCompiler, UglifyJSOptimizer, _compileComponentFile, _compileIndex, _processComponent, _template, _writeHTML, _writeMainData, _writeMainFile, anymatch, beautify, builder, clone, cloneDeep, defaultFactories, defaultOptions, defaults, defaultsDeep, extend, factoryParse, fcache, fs, hasProp, isEqual, isFunction, isObjectLike, log4js, logger, merge, mkdirp, modules, pick, readComponents, removeStrictOptions, sysPath, writeData;

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
  var componentDir, count, files, give, isScript, j, k, len, len1, map, matcher, memo, name, opts, path, prop, ref, ref1, take, task, toCompile;
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
    files = component.package[prop];
    if (!files) {
      continue;
    }
    for (k = 0, len1 = files.length; k < len1; k++) {
      path = files[k];
      // normalize path
      path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, "/");
      if (/[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(path)) {
        matcher = anymatch([path]);
        for (path in component.jsfiles) {
          if (!hasProp.call(toCompile, path) && matcher(path.replace(/[\\]/g, "/"))) {
            toCompile[path] = {isScript};
          }
        }
      } else if (!hasProp.call(toCompile, path) && component.jsfiles && hasProp.call(component.jsfiles, path)) {
        toCompile[path] = {isScript};
      }
    }
  }
  for (path in toCompile) {
    opts = toCompile[path];
    task(path, opts);
  }
  if (component.map) {
    ref1 = component.map;
    for (path in ref1) {
      map = ref1[path];
      // normalize path
      path = sysPath.resolve(componentDir, path);
      path = sysPath.relative(componentDir, path).replace(/[\\]/g, "/");
      if (component.jsfiles && hasProp.call(component.jsfiles, path)) {
        task(path, {map});
      }
    }
  }
  give();
};

_compileComponentFile = function(path, component, config, memo, isAbsolutePath, options, opts, done) {
  var absolutePath, configPaths, deps, exports, name, pathext, paths, plugin, processed, shim;
  name = component.name;
  configPaths = options.paths;
  ({processed} = memo);
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
  // logger.trace "compiling bower file #{component.name}: #{path}"
  processed[absolutePath] = true;
  memo.hasJs = true;
  pathext = configPaths.BOWER_COMPONENTS_URL + "/" + sysPath.join(name, path).replace(/[\\]/g, "/");
  path = pathext.replace(/\.js$/, "");
  exports = component.exports;
  if (typeof config.paths[name] === "undefined" && !opts.isScript && !opts.map) {
    if (exports) {
      // shim non amd file
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
    // reverse path, treat full path as name
    config.map["*"][path] = name;
  } else {
    // logger.trace  "[#{name}] add [#{path}] as group"
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
        done(new Error(`[${name}] - Cannot add [${plugin}] to groups. Already exists as path ${config.paths[plugin]}`));
        return;
      }
      if (Array.isArray(paths)) {
        paths.push(path);
      } else {
        paths = path;
      }
      // configure requirejs for plugin path resolution
      config.paths[plugin] = paths;
      // reverse path, treat full path as name
      config.map["*"][path] = plugin;
    } else {
      if (exports) {
        plugin = name + "_" + Math.random().toString(36).slice(2);
      } else {
        plugin = path;
      }
      if (hasProp.call(config.paths, plugin)) {
        done(new Error(`[${name}] - Cannot add [${plugin}] to groups. Already exists as path ${config.paths[plugin]}`));
        return;
      }
      // configure requirejs for plugin path resolution
      config.paths[plugin] = path;
    }
    if (exports) {
      // shim non amd file
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
      // make current file to load after the main file
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
    config,
    pathBrowserify,
    paths: paths,
    optimize: options.config.isProduction,
    root: paths.APPLICATION_PATH,
    public: paths.PUBLIC_PATH
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
    var obj, writeOptimized, writer;
    if (err) {
      done(err);
      return;
    }
    writer = fs.createWriteStream(dst, {
      flags: "w"
    });
    if (options.optimizer) {
      writeOptimized = function({
          data: optimized
        }) {
        writer.write(optimized || data, "utf8", done);
        writer.end();
        writer = null;
      };
      obj = options.optimizer.optimize({data, path});
      if (obj !== null && typeof obj === "object" && typeof obj.then === "function") {
        obj.then(writeOptimized, done);
      } else {
        writeOptimized(obj);
      }
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
  var destFileSingle, err, filename, imports, paths, source, srcpath, stats, template, tplOpts;
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
  try {
    filename = srcpath;
    imports = modules.makeModule(filename, module);
    template = _template(source, {
      variable: "root",
      imports: imports
    });
    tplOpts = defaults({
      optimize: Boolean(options.optimizer)
    }, imports);
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

({
  parse: factoryParse
} = require("umd-loader/lib/method-parser"));

removeStrictOptions = function(str) {
  return str.replace(/^\s*(['"])use strict\1;?[^\n]*$/m, "");
};

defaultOptions = {};

defaultOptions.umdWrapper = require("umd-loader/lib/umdWrapper");

defaultOptions.comWrapper = function(data, options) {
  var _g, strict;
  _g = options.global || "typeof global === \"undefined\" ? self : global";
  strict = "";
  if (options.strict) {
    data = removeStrictOptions(data);
    strict = "'use strict';";
  }
  return `${strict}
var deps = [];

${data}

(function(require, global) {
    // CommonJS
    module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);

}(require, ${_g}));`;
};

defaultFactories = defaultOptions.factories = {};

require("../factories/ng")(defaultFactories);

require("../factories/freact")(defaultFactories);

defaultFactories.factory = require("umd-loader/lib/factories").factory;

module.exports = AmdCompiler = function() {
  class AmdCompiler {
    constructor(config = {}) {
      var Ctor, EsLinter, JsHinter, file, joinTo, pattern, ref;
      this.paths = builder.generateConfig(config).paths;
      this.paths.public = config.paths.public;
      joinTo = config.files.javascripts.joinTo;
      if (typeof joinTo === "string") {
        file = joinTo;
        joinTo = {};
        joinTo[file] = /\.js$/; // matches all JavaScript files
      }
      for (file in joinTo) {
        pattern = joinTo[file];
        joinTo[file] = anymatch(pattern);
      }
      this.joinTo = joinTo;
      this.config = clone(config);
      this.sourceMaps = Boolean(config.sourceMaps);
      this.amdDestination = config.modules.amdDestination;
      this.nameCleaner = config.modules.nameCleaner;
      this.options = merge({}, defaultOptions, (ref = config.plugins) != null ? ref.amd : void 0);
      if (this.options.eslint) {
        EsLinter = require("./eslinter");
        this.linter = new EsLinter(config);
      } else if (this.options.jshint) {
        JsHinter = require("./jshinter");
        this.linter = new JsHinter(config);
      }
      if (config.isProduction) {
        Ctor = this.options.optimizer || UglifyJSOptimizer;
        this.optimizer = new Ctor(config);
      }
      delete this.options.eslint;
      delete this.options.jshint;
      delete this.options.optimizer;
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

    compile(params, done) {
      var _UNUSED_, comData, data, dst, err, joinTo, map, modulePath, name, parsed, path, umdData;
      ({joinTo} = this);
      ({data, path, map} = params);
      if (this.options.bind) {
        data = data.replace(/function\s*\(\)\s*\{\s*return fn.apply\(me, arguments\);\s*\}/, "fn.bind(me)");
      }
      umdData = comData = data;
      if (!this.isIgnored(params.path)) {
        try {
          [_UNUSED_, name] = parsed = factoryParse(data, this.parseOptions);
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
      this._getComponents((err, components) => {
        var match, relpath;
        if (err) {
          done(err);
          return;
        }
        if (/^bower_components[\/\\]/.test(path) && this.isVendor && this.isVendor(path)) {
          [match, name, relpath] = path.match(/^bower_components[\/\\]([^\/\\]+)[\/\\](.+)/);
          components[name].jsfiles || (components[name].jsfiles = {});
          components[name].jsfiles[relpath] = true;
        }
        this._lint({comData, umdData, path, map, dst}, (err, options) => {
          if (err) {
            done(err);
            return;
          }
          if (this.noAmd) {
            done(err, {
              data: comData,
              path
            });
            return;
          }
          this._writeData(options, (err, options) => {
            var deepackName, dirname, pathWithoutExt, reg;
            if (err) {
              done(err);
              return;
            }
            ({comData, umdData, path} = options);
            if (!this.isVendor || !this.isVendor(path)) {
              pathWithoutExt = path.replace(/\.[^\.]+$/, "");
              deepackName = fcache.deepackName;
              reg = /[\/\\]/g;
              while (match = reg.exec(path)) {
                dirname = path.slice(0, match.index);
                if (this.canJoin(dirname + "/" + deepackName, joinTo)) {
                  if (!hasProp.call(this.deepacks, dirname)) {
                    this.deepacks[dirname] = {};
                  }
                  this.deepacks[dirname][pathWithoutExt] = path;
                }
              }
              if (!hasProp.call(this.packages, dirname)) {
                this.packages[dirname] = {};
              }
              this.packages[dirname][pathWithoutExt] = path;
            }
            done(err, {
              data: comData,
              path
            });
          });
        });
      });
    }

    // eslint-disable-next-line class-methods-use-this
    canJoin(path, joinTo) {
      if (/^bower_components[\/\\]/.test(path) && !/^bower_components[\/\\][^\/\\]+[\/\\]/.test(path)) {
        return false;
      }
      return Object.keys(joinTo).some(function(file) {
        return joinTo[file](path);
      });
    }

    onCompile(generatedFiles, changedAssets) {
      var components, config, count, done, give, options, plugin, resolve, take;
      if (generatedFiles.length === 0 && changedAssets.length === 0) {
        return null;
      }
      options = pick(this, ["paths", "lastPackages", "options", "config", "optimizer"]);
      resolve = Function.prototype;
      done = function(err) {
        if (err) {
          logger.error(err);
        }
        resolve();
      };
      config = {
        // http://requirejs.org/docs/api.html#config-enforceDefine
        // To get timely, correct error triggers in IE, force a define/shim exports check.
        enforceDefine: false,
        // http://requirejs.org/docs/api.html#config
        // By default load any module IDs from CLIENT_MODULES_URL
        baseUrl: this.paths.CLIENT_MODULES_URL,
        // http://requirejs.org/docs/api.html#config-paths
        // except, if the module ID starts with 'app',
        // load it from the CLIENT_MODULES_URL/app directory. paths
        // config is relative to the baseUrl, and
        // never includes a '.js' extension since
        // the paths config could be for a directory.
        paths: {},
        // http://requirejs.org/docs/api.html#config-groups
        // allows configuring multiple module IDs to be found in another script
        // i.e. when requiring a lib in a group, all others modules are also loaded
        groups: {},
        // http://requirejs.org/docs/api.html#config-shim
        // Configure the dependencies, exports, and custom initialization for older, 
        // traditional "browser globals" scripts that do not use define() to declare the dependencies and set a module value
        shim: {},
        // http://requirejs.org/docs/api.html#config-deps
        deps: []
      };
      // options is immutable, thats why deep is required
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
      // Start work
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
        // End of current work
        give();
      });
      return new Promise(function(_resolve) {
        resolve = _resolve;
      });
    }

    teardown() {
      var ref;
      if ((ref = this.linter) != null ? ref.teardown : void 0) {
        this.linter.teardown();
      }
    }

    _getComponents(done) {
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
        // console.log components
        done(err, components);
        while (fn = self.pending.shift()) {
          fn(err, components);
        }
      });
    }

    _lint(options, done) {
      var linter, map, path, ref, umdData;
      if (linter = this.linter) {
        ({umdData, path, map} = options);
        if ((ref = sysPath.basename(path)) === fcache.packageName || ref === fcache.deepackName) {
          done(null, options);
          return;
        }
        linter.lint({
          data: umdData,
          path,
          map
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
    }

    _writeData(options, done) {
      var dst, next, obj, path, umdData, writeOptimized;
      ({umdData, path, dst} = options);
      next = function(err) {
        if (err) {
          done(err);
          return;
        }
        done(err, options);
      };
      if (this.optimizer) {
        writeOptimized = function({
            data: optimized
          }) {
          writeData(optimized || umdData, dst, next);
        };
        obj = this.optimizer.optimize({
          data: umdData,
          path
        });
        if (obj !== null && typeof obj === "object" && typeof obj.then === "function") {
          obj.then(writeOptimized, next);
        } else {
          writeOptimized(obj);
        }
        return;
      }
      writeData(umdData, dst, next);
    }

    _compilePackages(generatedFiles, changedAssets, components) {
      var deepacks, packages, plugin, res1, res2;
      plugin = this;
      if (!plugin.options.package) {
        return false;
      }
      ({packages, deepacks} = plugin);
      generatedFiles.forEach(function(generatedFile, index) {
        generatedFile.sourceFiles.forEach(function(file, index) {
          var dirname, dst, match, path, ref, ref1, reg;
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
            if ((ref = deepacks[dirname]) != null) {
              delete ref[path.replace(/\.[^\.]+$/, "")];
            }
          }
          if ((ref1 = packages[dirname]) != null) {
            delete ref1[path.replace(/\.[^\.]+$/, "")];
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
    }

    _processPackages(plugin, name, components) {
      var _UNUSED_, __deepackName, __packageName, _dirname, _module, _packageName, absPath, basename, content, deps, dirname, getIndex, hasChanged, hasFile, i, j, k, key, lastIndex, lastPackages, lastPackagesKey, len, len1, match, obj, packageName, packages, path, paths, reg, relModulePath, relpath, sorter, status;
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
          [_UNUSED_, basename] = path.match(/([^\/\\]+)(?:\.[^\.]+)?$/);
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
        var file, files, i, k, len1;
        [_UNUSED_, name] = dirname.match(/^bower_components[\/\\]([^\/\\]+)/);
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
          ({
            name: basename,
            dir: _dirname
          } = sysPath.parse(relpath));
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
            } else if (typeof obj[key] !== "object") {
              // handle cases like src/core.js, src/core/anoter.js
              obj[key] = {
                ".": obj[key]
              };
            }
            obj = obj[key];
          }
          obj[basename] = i;
          i++;
        }
        if (!hasFile) {
          continue;
        }
        content = `(function(global, factory) {
    if (typeof define === "function" && define.amd) {
        define(["module", "${deps.join("\",\n    \"")}"], function() {
            return factory.apply(global, arguments);
        });
    } else if (typeof exports === "object" && typeof module !== "undefined") {
        factory.call(global, module, require("${deps.join("\"), require(\"")}"));
    } else {
        throw new Error("global loading is not allowed");
    }
})(function(_this) {
    var g;

    if (typeof window !== "undefined") {
        g = window;
    } else if (typeof global !== "undefined") {
        g = global;
    } else if (typeof self !== "undefined") {
        g = self;
    } else {
        g = _this;
    }

    return g; //eslint-disable-next-line no-invalid-this
}(this), function(module) {
    "use strict";
    var args = Array.prototype.slice.call(arguments, arguments.length - ${i});
    module.exports = ${this.stringifyModule(_module, 4, 4, true)};
});`;
        status = fcache.updateFakeFile(packageName, content);
        if (status === 0) {
          builder.fswatcher.emit("add", absPath);
        } else {
          builder.fswatcher.emit("change", absPath);
        }
      }
      plugin[lastPackagesKey] = cloneDeep(packages);
      return hasChanged;
    }

    stringifyModule(module, initialSpace = 0, space = 4, order) {
      var indent, initialIndent, j, key, keys, len, str, value;
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
      return `{${indent}${str.join("," + indent)}${initialIndent}}`;
    }

  }

  AmdCompiler.prototype.brunchPlugin = true;

  AmdCompiler.prototype.type = "javascript";

  AmdCompiler.prototype.completer = true;

  return AmdCompiler;

}.call(this);

AmdCompiler.brunchPluginName = "amd-brunch";
