log4js = require('../log4js')
cluster = require 'cluster'
util = require 'util'
fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
_ = require 'lodash'
explore = require('fs-explorer').explore
semLib = require 'sem-lib'
anymatch = require 'anymatch'
logger = log4js.getLogger 'umd-builder'
chokidar = require 'chokidar'

initConfig = (options)->
    config = options._c = {}

    APPLICATION_PATH = sysPath.resolve options.paths.root
    CLIENT_RELATIVE_PATH = options.paths.watched[0]

    # Where to find client files
    CLIENT_PATH = sysPath.join APPLICATION_PATH, CLIENT_RELATIVE_PATH

    # where to find index.hbs
    CLIENT_ASSETS_PATH = sysPath.join CLIENT_PATH, 'assets'
    CLIENT_ASSETS_RELATIVE_PATH = sysPath.relative CLIENT_PATH, CLIENT_ASSETS_PATH

    BOWER_COMPONENTS_RELATIVE_PATH = 'bower_components'

    PUBLIC_PATH = sysPath.resolve APPLICATION_PATH, options.paths.public

    # where to copy non asset files
    CLIENT_MODULES_URL = 'node_modules'
    CLIENT_MODULES_PATH = sysPath.join PUBLIC_PATH, CLIENT_MODULES_URL

    # where to copy bower files
    BOWER_PUBLIC_PATH = sysPath.join PUBLIC_PATH, BOWER_COMPONENTS_RELATIVE_PATH

    # Bower relative path to be used by require.js for path resolution
    BOWER_COMPONENTS_URL = sysPath.relative(CLIENT_MODULES_PATH, BOWER_PUBLIC_PATH).replace /[\\]/g, '/'

    bowerConfig = require sysPath.resolve APPLICATION_PATH, 'bower.json'
    config.dependencies = bowerConfig.dependencies
    config.overrides = bowerConfig.overrides || {}

    config.paths = {
        APPLICATION_PATH
        CLIENT_RELATIVE_PATH
        CLIENT_PATH
        CLIENT_ASSETS_PATH
        CLIENT_ASSETS_RELATIVE_PATH
        BOWER_COMPONENTS_RELATIVE_PATH
        PUBLIC_PATH
        CLIENT_MODULES_URL
        CLIENT_MODULES_PATH
        BOWER_PUBLIC_PATH
        BOWER_COMPONENTS_URL
    }

    options._c

emptyFn = ->

capitalize = (str)->
    if typeof str is 'string' and str.length > 0
        return str[0].toUpperCase() + str.substring 1
    str

isFile = (path, next)->
    fs.exists path, (exists)->
        return next null, exists if not exists
        fs.lstat path, (err, stats)->
            return next(err) if err
            next err, stats.isFile() and path
            return
        return
    return

isFileSync = (path)->
    return fs.existsSync(path) and fs.lstatSync(path).isFile() and path

buildBower = (options, next)->
    logger.info 'Build Bower start'

    config =
        # http://requirejs.org/docs/api.html#config-enforceDefine
        # To get timely, correct error triggers in IE, force a define/shim exports check.
        enforceDefine: true,

        # http://requirejs.org/docs/api.html#config
        # By default load any module IDs from CLIENT_MODULES_URL
        baseUrl: options._c.paths.CLIENT_MODULES_URL,

        # http://requirejs.org/docs/api.html#config-paths
        # except, if the module ID starts with 'app',
        # load it from the CLIENT_MODULES_URL/app directory. paths
        # config is relative to the baseUrl, and
        # never includes a '.js' extension since
        # the paths config could be for a directory.
        paths: {}

        # http://requirejs.org/docs/api.html#config-bundles
        # allows configuring multiple module IDs to be found in another script
        # i.e. when requiring a lib in a bundle, all others modules are also loaded
        bundles: {}

        # http://requirejs.org/docs/api.html#config-shim
        # Configure the dependencies, exports, and custom initialization for older, 
        # traditional "browser globals" scripts that do not use define() to declare the dependencies and set a module value
        shim: {}

        # http://requirejs.org/docs/api.html#config-deps
        deps: []

    _.extend config, options.requirejs

    count = 0

    take = -> ++count

    give = (err)->
        if --count is 0 or err
            _writeMainFile config, options
            logger.info 'Build Bower finish'
            logger.error 'Error while building bower components', err if err
            next(err) if typeof next is 'function'
        return

    # Start work
    take()

    for component of options._c.dependencies
        take()
        _processComponent component, options._c.overrides[component], config, options, give

    # End of current work
    give()
    
    return 

_processComponent = (component, overrides, config, options, done)->
    configPaths = options._c.paths
    isFile sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, '.bower.json'), (err, path)->
        if path
            bowerConfig = require path
            _.extend bowerConfig, overrides
            _processBowerConfiguration component, bowerConfig, config, options, done
            return

        isFile sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, 'bower.json'), (err, path)->
            if path
                bowerConfig = require path
                _.extend bowerConfig, overrides
            else
                bowerConfig = overrides or {}

            _processBowerConfiguration component, bowerConfig, config, options, done
            return
        return
    return

_processBowerConfiguration = (component, bowerConfig, config, options, done)->
    if bowerConfig.umd
        done()
        return

    mainFiles = bowerConfig.main

    mainFiles = [mainFiles] if typeof mainFiles is 'string'
    return done() if not (mainFiles instanceof Array)

    if bowerConfig.ignored
        logger.debug 'ignored', component
    else
        config.deps.push component

    _processComponentMainFiles mainFiles, component, bowerConfig, config, options, done
    return

_processComponentMainFiles = (mainFiles, component, bowerConfig, config, options, done)->
    count = 0

    take = -> ++count

    give = (err)->
        if --count is 0 or err
            if not memo.hasJs
                delete config.paths[component]
                if ~(idx = config.deps.indexOf component)
                    config.deps.splice idx, 1
            done()
        return

    take()

    processed = {}
    bundleIndex = 0

    memo = {processed, bundleIndex}

    for path in mainFiles
        take()
        if /\*/.test path
            componentDir = sysPath.resolve options._c.paths.BOWER_COMPONENTS_RELATIVE_PATH, component
            _matchBowerFiles component, bowerConfig, config, {path, componentDir, memo}, options, give
        else
            _compileBowerFile path, component, bowerConfig, config, memo, false, options, give

    give()
    return

# path is relative path without leading slash
# componentDir is absolute path without trailing slash
_matchBowerFiles = (component, bowerConfig, config, {path, componentDir, memo}, options, done)->
    matcher = anymatch [path]
    start = componentDir.length + 1
    explore componentDir, (path, stats, next)->
        relativePath = path.substring(start).replace(/[\\]/g, '/')
        if matcher relativePath
            _compileBowerFile path, component, bowerConfig, config, memo, true, options, next
            return
        next()
    , done
    return

_compileBowerFile = (path, component, bowerConfig, config, memo, isAbsolutePath, options, done)->
    configPaths = options._c.paths
    {processed, bundleIndex} = memo
    jsExtensions = options.jsExtensions

    if isAbsolutePath
        absolutePath = path
        path = sysPath.relative sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component), path
    else
        absolutePath = sysPath.resolve configPaths.BOWER_COMPONENTS_RELATIVE_PATH, component, path

    return done() if processed.hasOwnProperty absolutePath

    processed[absolutePath] = true
    extname = sysPath.extname path
    destFile = sysPath.resolve configPaths.BOWER_PUBLIC_PATH, component, path

    if jsExtensions.test extname
        memo.hasJs = true

        if typeof config.paths[component] is 'undefined'
            if bowerConfig.exports
                # shim non amd file
                shim = exports: bowerConfig.exports

                if typeof bowerConfig.dependencies is 'object' and bowerConfig.dependencies isnt null
                    shim.deps = Object.keys bowerConfig.dependencies

                config.shim[component] = shim

            if typeof bowerConfig.paths is 'string'
                paths = [bowerConfig.paths]
            else if bowerConfig.paths instanceof Array
                paths = bowerConfig.paths
            else
                paths = []

            # never includes a '.js' extension since
            # the paths config could be for a directory.
            paths.push configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace /[\\]/g, '/'
            for url, index in paths
                paths[index] = url.replace /\.js$/, ''
            config.paths[component] = paths

        else
            logger.debug  "[#{component}] add [#{path}] as bundle"

            if bowerConfig.exports
                # shim non amd file

                if not config.bundles.hasOwnProperty component
                    # Make first file the main file
                    plugin = component + '.plugin.' + memo.bundleIndex++
                    config.shim[plugin] = config.shim[component]
                    config.paths[plugin] = config.paths[component]
                    config.bundles[component] = [plugin]

                # make current file to load with component
                plugin = component + '.plugin.' + memo.bundleIndex++
                config.bundles[component].push plugin

                # make current file to load after the main file
                config.shim[plugin] =
                    exports: bowerConfig.exports
                    deps: [config.bundles[component][0]]

                # configure requirejs for plugin path resolution
                path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace(/[\\]/g, '/').replace(/\.js$/, '')
                config.paths[plugin] = [path]

            else
                # amd module
                if not config.bundles.hasOwnProperty component
                    config.bundles[component] = [config.paths[component][0]]
                    delete config.paths[component]

                # never includes a '.js' extension since
                # the paths config could be for a directory.
                path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(component, path).replace(/[\\]/g, '/').replace(/\.js$/, '')

                # make current file to load with component
                # full path name is needed for relative path resolution
                config.bundles[component].push path

    done()
    return

_writeMainFile = (config, options)->
    bundles = """
    // Bundles
    var bundles = #{JSON.stringify config.bundles},
        component;
    for (component in bundles) {
        define(component, bundles[component], function(main) {
            return main;
        });
    }
    """
    delete config.bundles
    loader = config.loader or 'umd-stdlib/core/depsLoader'

    mainjs = """
        window.appConfig || (window.appConfig = {});
        (function() {
            'use strict';
            var config = #{util.inspect config, depth: null};
            if (!/\\.\\w+$/.test(window.location.pathname)) {
                if (typeof appConfig.baseUrl === 'string') {
                    config.baseUrl = appConfig.baseUrl + config.baseUrl;
                } else {
                    config.baseUrl = '/' + config.baseUrl;
                }
            }
            var deps = config.deps;
            delete config.deps;

            #{bundles}

            requirejs.config(config);

            define(['#{loader}'], function(depsLoader) {
                window.depsLoader = depsLoader;
                require(deps, function() {
                    require(['initialize']);
                });
            });
        })();
    """

    MAIN_JS_FILE = sysPath.resolve options._c.paths.PUBLIC_PATH, 'javascripts/main.js'
    mkdirp.sync sysPath.dirname MAIN_JS_FILE
    writer = fs.createWriteStream MAIN_JS_FILE, flags: 'w'
    writer.write mainjs
    return

compileIndex = (path, options)->
    configPaths = options._c.paths
    logger.info 'compile amd index file'
    Handlebars = require 'handlebars'
    source = fs.readFileSync sysPath.resolve(configPaths.CLIENT_ASSETS_PATH, path), 'utf8'
    template = Handlebars.compile source
    destFileSingle = sysPath.resolve configPaths.PUBLIC_PATH, 'index.single.html'
    destFileClassic = sysPath.resolve configPaths.PUBLIC_PATH, 'index.classic.html'
    fs.writeFileSync destFileSingle, template
        single: true
        resource: 'app'
    fs.writeFileSync destFileClassic, template
        single: false
        resource: 'web'

buildClient = (options, next)->
    if cluster.isMaster
        if options.links
            for dstpath, srcpath of options.links
                configPaths = options._c.paths
                dstpath = sysPath.join configPaths.PUBLIC_PATH, dstpath
                if 'string' is typeof srcpath
                    type = 'file'
                else
                    [srcpath, type] = srcpath
                srcpath = sysPath.resolve configPaths.APPLICATION_PATH, srcpath
                logger.info "link\n    #{srcpath}\n    #{dstpath}"
                fs.symlink srcpath, dstpath, type, (err)->
                    if err and (err.code isnt 'EEXIST' or err.path isnt srcpath)
                        logger.error(err)
                    return
        
        command = process.argv[2]
        if command is 'watch'
            watchClientFiles options, next
            return

        exploreClientFiles options, next
    return

watchClientFiles = (options, next)->
    logger.info 'Start watching client files'

    watcher = chokidar.watch sysPath.join options._c.paths.CLIENT_ASSETS_PATH, 'index.hbs'
    watcher.on('add', (path)->
        compileIndex path, options
        return
    ).on 'change', (path)->
        compileIndex path, options
        return

    next() if 'function' is typeof next
    return

exploreClientFiles = (options, next)->
    compileIndex  'index.hbs', options
    next()
    return

buildSem = semLib.semCreate 1, true
# count = 0

build = (options, next)->
    return next @config if @config

    if @building
        # logger.warn 'waiting', ++count
        buildSem.semTake =>
            # logger.warn 'freeing', --count
            next @config
            return
        return

    @building = true

    buildSem.semTake ->
        config = initConfig options
        buildBower options, ->
            buildClient options, ->
                @config = config
                @building = false
                # logger.warn 'flushing', count
                buildSem.semFlush()
                next config
                return
            return
        return

    return

exports.initialize = (options = {}, next)->
    options.jsExtensions or (options.jsExtensions = /\.js$/)
    build options, (config)=>
        next config
        return
    return
