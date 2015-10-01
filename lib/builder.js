// Generated by CoffeeScript 1.10.0
var _, _compileBowerFile, _matchBowerFiles, _processBowerConfiguration, _processComponent, _processComponentMainFiles, _writeMainFile, anymatch, build, buildBower, buildClient, buildSem, capitalize, chokidar, cluster, compileIndex, emptyFn, explore, exploreClientFiles, fs, initConfig, isFile, isFileSync, log4js, logger, mkdirp, semLib, sysPath, util, watchClientFiles;

log4js = require('../log4js');

cluster = require('cluster');

util = require('util');

fs = require('fs');

mkdirp = require('mkdirp');

sysPath = require('path');

_ = require('lodash');

explore = require('fs-explorer').explore;

semLib = require('sem-lib');

anymatch = require('anymatch');

logger = log4js.getLogger('umd-builder');

chokidar = require('chokidar');

initConfig = function(options) {
  var APPLICATION_PATH, BOWER_COMPONENTS_RELATIVE_PATH, BOWER_COMPONENTS_URL, BOWER_PUBLIC_PATH, CLIENT_ASSETS_PATH, CLIENT_ASSETS_RELATIVE_PATH, CLIENT_MODULES_PATH, CLIENT_MODULES_URL, CLIENT_PATH, CLIENT_RELATIVE_PATH, PUBLIC_PATH, bowerConfig, config;
  config = options._c = {};
  APPLICATION_PATH = sysPath.resolve(options.paths.root);
  CLIENT_RELATIVE_PATH = options.paths.watched[0];
  CLIENT_PATH = sysPath.join(APPLICATION_PATH, CLIENT_RELATIVE_PATH);
  CLIENT_ASSETS_PATH = sysPath.join(CLIENT_PATH, 'assets');
  CLIENT_ASSETS_RELATIVE_PATH = sysPath.relative(CLIENT_PATH, CLIENT_ASSETS_PATH);
  BOWER_COMPONENTS_RELATIVE_PATH = 'bower_components';
  PUBLIC_PATH = sysPath.resolve(APPLICATION_PATH, options.paths["public"]);
  CLIENT_MODULES_URL = 'node_modules';
  CLIENT_MODULES_PATH = sysPath.join(PUBLIC_PATH, CLIENT_MODULES_URL);
  BOWER_PUBLIC_PATH = sysPath.join(PUBLIC_PATH, BOWER_COMPONENTS_RELATIVE_PATH);
  BOWER_COMPONENTS_URL = sysPath.relative(CLIENT_MODULES_PATH, BOWER_PUBLIC_PATH).replace(/[\\]/g, '/');
  bowerConfig = require(sysPath.resolve(APPLICATION_PATH, 'bower.json'));
  config.dependencies = bowerConfig.dependencies;
  config.overrides = bowerConfig.overrides || {};
  config.paths = {
    APPLICATION_PATH: APPLICATION_PATH,
    CLIENT_RELATIVE_PATH: CLIENT_RELATIVE_PATH,
    CLIENT_PATH: CLIENT_PATH,
    CLIENT_ASSETS_PATH: CLIENT_ASSETS_PATH,
    CLIENT_ASSETS_RELATIVE_PATH: CLIENT_ASSETS_RELATIVE_PATH,
    BOWER_COMPONENTS_RELATIVE_PATH: BOWER_COMPONENTS_RELATIVE_PATH,
    PUBLIC_PATH: PUBLIC_PATH,
    CLIENT_MODULES_URL: CLIENT_MODULES_URL,
    CLIENT_MODULES_PATH: CLIENT_MODULES_PATH,
    BOWER_PUBLIC_PATH: BOWER_PUBLIC_PATH,
    BOWER_COMPONENTS_URL: BOWER_COMPONENTS_URL
  };
  return options._c;
};

emptyFn = function() {};

capitalize = function(str) {
  if (typeof str === 'string' && str.length > 0) {
    return str[0].toUpperCase() + str.substring(1);
  }
  return str;
};

isFile = function(path, next) {
  fs.exists(path, function(exists) {
    if (!exists) {
      return next(null, exists);
    }
    fs.lstat(path, function(err, stats) {
      if (err) {
        return next(err);
      }
      next(err, stats.isFile() && path);
    });
  });
};

isFileSync = function(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isFile() && path;
};

buildBower = function(options, next) {
  var component, config, count, give, take;
  logger.info('Build Bower start');
  config = {
    enforceDefine: true,
    baseUrl: options._c.paths.CLIENT_MODULES_URL,
    paths: {},
    bundles: {},
    shim: {},
    deps: []
  };
  _.extend(config, options.requirejs);
  count = 0;
  take = function() {
    return ++count;
  };
  give = function(err) {
    if (--count === 0 || err) {
      _writeMainFile(config, options);
      logger.info('Build Bower finish');
      if (err) {
        logger.error('Error while building bower components', err);
      }
      if (typeof next === 'function') {
        next(err);
      }
    }
  };
  take();
  for (component in options._c.dependencies) {
    take();
    _processComponent(component, options._c.overrides[component], config, options, give);
  }
  give();
};

_processComponent = function(component, overrides, config, options, done) {
  var configPaths;
  configPaths = options._c.paths;
  isFile(sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, '.bower.json'), function(err, path) {
    var bowerConfig;
    if (path) {
      bowerConfig = require(path);
      _.extend(bowerConfig, overrides);
      _processBowerConfiguration(component, bowerConfig, config, options, done);
      return;
    }
    isFile(sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, 'bower.json'), function(err, path) {
      if (path) {
        bowerConfig = require(path);
        _.extend(bowerConfig, overrides);
      } else {
        bowerConfig = overrides || {};
      }
      _processBowerConfiguration(component, bowerConfig, config, options, done);
    });
  });
};

_processBowerConfiguration = function(component, bowerConfig, config, options, done) {
  var mainFiles;
  if (bowerConfig.umd) {
    done();
    return;
  }
  mainFiles = bowerConfig.main;
  if (typeof mainFiles === 'string') {
    mainFiles = [mainFiles];
  }
  if (!(mainFiles instanceof Array)) {
    return done();
  }
  if (bowerConfig.ignored) {
    logger.debug('ignored', component);
  } else {
    config.deps.push(component);
  }
  _processComponentMainFiles(mainFiles, component, bowerConfig, config, options, done);
};

_processComponentMainFiles = function(mainFiles, component, bowerConfig, config, options, done) {
  var bundleIndex, componentDir, count, give, i, len, memo, path, processed, take;
  count = 0;
  take = function() {
    return ++count;
  };
  give = function(err) {
    var idx;
    if (--count === 0 || err) {
      if (!memo.hasJs) {
        delete config.paths[component];
        if (~(idx = config.deps.indexOf(component))) {
          config.deps.splice(idx, 1);
        }
      }
      done();
    }
  };
  take();
  processed = {};
  bundleIndex = 0;
  memo = {
    processed: processed,
    bundleIndex: bundleIndex
  };
  for (i = 0, len = mainFiles.length; i < len; i++) {
    path = mainFiles[i];
    take();
    if (/\*/.test(path)) {
      componentDir = sysPath.resolve(options._c.paths.BOWER_COMPONENTS_RELATIVE_PATH, component);
      _matchBowerFiles(component, bowerConfig, config, {
        path: path,
        componentDir: componentDir,
        memo: memo
      }, options, give);
    } else {
      _compileBowerFile(path, component, bowerConfig, config, memo, false, options, give);
    }
  }
  give();
};

_matchBowerFiles = function(component, bowerConfig, config, arg, options, done) {
  var componentDir, matcher, memo, path, start;
  path = arg.path, componentDir = arg.componentDir, memo = arg.memo;
  matcher = anymatch([path]);
  start = componentDir.length + 1;
  explore(componentDir, function(path, stats, next) {
    var relativePath;
    relativePath = path.substring(start).replace(/[\\]/g, '/');
    if (matcher(relativePath)) {
      _compileBowerFile(path, component, bowerConfig, config, memo, true, options, next);
      return;
    }
    return next();
  }, done);
};

_compileBowerFile = function(path, component, bowerConfig, config, memo, isAbsolutePath, options, done) {
  var absolutePath, bundleIndex, configPaths, destFile, extname, i, index, jsExtensions, len, paths, plugin, processed, shim, url;
  configPaths = options._c.paths;
  processed = memo.processed, bundleIndex = memo.bundleIndex;
  jsExtensions = options.jsExtensions;
  if (isAbsolutePath) {
    absolutePath = path;
    path = sysPath.relative(sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component), path);
  } else {
    absolutePath = sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, path);
  }
  if (processed.hasOwnProperty(absolutePath)) {
    return done();
  }
  processed[absolutePath] = true;
  extname = sysPath.extname(path);
  destFile = sysPath.resolve(configPaths.BOWER_PUBLIC_PATH, component, path);
  if (jsExtensions.test(extname)) {
    memo.hasJs = true;
    if (typeof config.paths[component] === 'undefined') {
      if (bowerConfig.exports) {
        shim = {
          exports: bowerConfig.exports
        };
        if (typeof bowerConfig.dependencies === 'object' && bowerConfig.dependencies !== null) {
          shim.deps = Object.keys(bowerConfig.dependencies);
        }
        config.shim[component] = shim;
      }
      if (typeof bowerConfig.paths === 'string') {
        paths = [bowerConfig.paths];
      } else if (bowerConfig.paths instanceof Array) {
        paths = bowerConfig.paths;
      } else {
        paths = [];
      }
      paths.push(configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace(/[\\]/g, '/'));
      for (index = i = 0, len = paths.length; i < len; index = ++i) {
        url = paths[index];
        paths[index] = url.replace(/\.js$/, '');
      }
      config.paths[component] = paths;
    } else {
      logger.debug("[" + component + "] add [" + path + "] as bundle");
      if (bowerConfig.exports) {
        if (!config.bundles.hasOwnProperty(component)) {
          plugin = component + '.plugin.' + memo.bundleIndex++;
          config.shim[plugin] = config.shim[component];
          config.paths[plugin] = config.paths[component];
          config.bundles[component] = [plugin];
        }
        plugin = component + '.plugin.' + memo.bundleIndex++;
        config.bundles[component].push(plugin);
        config.shim[plugin] = {
          exports: bowerConfig.exports,
          deps: [config.bundles[component][0]]
        };
        path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace(/[\\]/g, '/').replace(/\.js$/, '');
        config.paths[plugin] = [path];
      } else {
        if (!config.bundles.hasOwnProperty(component)) {
          config.bundles[component] = [config.paths[component][0]];
          delete config.paths[component];
        }
        path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace(/[\\]/g, '/').replace(/\.js$/, '');
        config.bundles[component].push(path);
      }
    }
  }
  done();
};

_writeMainFile = function(config, options) {
  var MAIN_JS_FILE, bundles, loader, mainjs, writer;
  bundles = "// Bundles\nvar bundles = " + (JSON.stringify(config.bundles)) + ",\n    component;\nfor (component in bundles) {\n    define(component, bundles[component], function(main) {\n        return main;\n    });\n}";
  delete config.bundles;
  loader = config.loader || 'umd-stdlib/core/depsLoader';
  mainjs = "window.appConfig || (window.appConfig = {});\n(function() {\n    'use strict';\n    var config = " + (util.inspect(config, {
    depth: null
  })) + ";\n    if (!/\\.\\w+$/.test(window.location.pathname)) {\n        if (typeof appConfig.baseUrl === 'string') {\n            config.baseUrl = appConfig.baseUrl + config.baseUrl;\n        } else {\n            config.baseUrl = '/' + config.baseUrl;\n        }\n    }\n    var deps = config.deps;\n    delete config.deps;\n\n    " + bundles + "\n\n    requirejs.config(config);\n\n    define(['" + loader + "'], function(depsLoader) {\n        window.depsLoader = depsLoader;\n        require(deps, function() {\n            require(['initialize']);\n        });\n    });\n})();";
  MAIN_JS_FILE = sysPath.resolve(options._c.paths.PUBLIC_PATH, 'javascripts/main.js');
  mkdirp.sync(sysPath.dirname(MAIN_JS_FILE));
  writer = fs.createWriteStream(MAIN_JS_FILE, {
    flags: 'w'
  });
  writer.write(mainjs);
};

compileIndex = function(path, options) {
  var Handlebars, configPaths, destFileClassic, destFileSingle, source, template;
  configPaths = options._c.paths;
  logger.info('compile amd index file');
  Handlebars = require('handlebars');
  source = fs.readFileSync(sysPath.resolve(configPaths.CLIENT_ASSETS_PATH, path), 'utf8');
  template = Handlebars.compile(source);
  destFileSingle = sysPath.resolve(configPaths.PUBLIC_PATH, 'index.single.html');
  destFileClassic = sysPath.resolve(configPaths.PUBLIC_PATH, 'index.classic.html');
  fs.writeFileSync(destFileSingle, template({
    single: true,
    resource: 'app'
  }));
  return fs.writeFileSync(destFileClassic, template({
    single: false,
    resource: 'web'
  }));
};

buildClient = function(options, next) {
  var command, configPaths, dstpath, ref, ref1, srcpath, type;
  if (cluster.isMaster) {
    if (options.links) {
      ref = options.links;
      for (dstpath in ref) {
        srcpath = ref[dstpath];
        configPaths = options._c.paths;
        dstpath = sysPath.join(configPaths.PUBLIC_PATH, dstpath);
        if ('string' === typeof srcpath) {
          type = 'file';
        } else {
          ref1 = srcpath, srcpath = ref1[0], type = ref1[1];
        }
        srcpath = sysPath.resolve(configPaths.APPLICATION_PATH, srcpath);
        logger.info("link\n    " + srcpath + "\n    " + dstpath);
        fs.symlink(srcpath, dstpath, type, function(err) {
          if (err && (err.code !== 'EEXIST' || err.path !== srcpath)) {
            logger.error(err);
          }
        });
      }
    }
    command = process.argv[2];
    if (command === 'watch') {
      watchClientFiles(options, next);
      return;
    }
    exploreClientFiles(options, next);
  }
};

watchClientFiles = function(options, next) {
  var watcher;
  logger.info('Start watching client files');
  watcher = chokidar.watch(sysPath.join(options._c.paths.CLIENT_ASSETS_PATH, 'index.hbs'));
  watcher.on('add', function(path) {
    compileIndex(path, options);
  }).on('change', function(path) {
    compileIndex(path, options);
  });
  if ('function' === typeof next) {
    next();
  }
};

exploreClientFiles = function(options, next) {
  compileIndex('index.hbs', options);
  next();
};

buildSem = semLib.semCreate(1, true);

build = function(options, next) {
  if (this.config) {
    return next(this.config);
  }
  if (this.building) {
    buildSem.semTake((function(_this) {
      return function() {
        next(_this.config);
      };
    })(this));
    return;
  }
  this.building = true;
  buildSem.semTake(function() {
    var config;
    config = initConfig(options);
    buildBower(options, function() {
      buildClient(options, function() {
        this.config = config;
        this.building = false;
        buildSem.semFlush();
        next(config);
      });
    });
  });
};

exports.initialize = function(options, next) {
  if (options == null) {
    options = {};
  }
  options.jsExtensions || (options.jsExtensions = /\.js$/);
  build(options, (function(_this) {
    return function(config) {
      next(config);
    };
  })(this));
};