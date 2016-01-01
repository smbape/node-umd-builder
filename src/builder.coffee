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
UglifyJSOptimizer = require 'uglify-js-brunch'
beautify = require('js-beautify').js_beautify

_.template = require('./compilers/jst/template')
_.templateSettings.variable = 'root'
_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g

initConfig = (options)->
    config = options._c = {}
    if options.optimize
        config.optimizer = new UglifyJSOptimizer options

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
    CLIENT_MODULES_URL = options.paths.modules  or 'node_modules'
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

buildBower = (options, done)->
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
            if err
                logger.error 'Error while building bower components', err
                done(err)
                return

            _writeMainFile config, options, (err)->
                if err
                    logger.error 'Error while building bower components', err
                    done(err)
                    return
                logger.info 'Build Bower finish'
                done(err)
                return
        return

    read = require './read'
    read sysPath.resolve(options._c.paths.APPLICATION_PATH), 'bower', (err, components)->
        return give err if err

        # Start work
        take()

        for component in components
            take()
            # _processComponent component, options._c.overrides[component], config, options, give
            _processComponent component, config, options, give

        # End of current work
        give()

        return
        
    return 

_processComponent = (component, config, options, done)->
    if component.umd
        done()
        return

    files = component.files
    return done() if not (files instanceof Array)

    name = component.name

    if component.ignored
        logger.debug 'ignored', name
    else
        config.deps.push name

    count = 0

    take = -> ++count

    give = (err)->
        if --count is 0 or err
            if not memo.hasJs
                delete config.paths[name]
                if ~(idx = config.deps.indexOf name)
                    config.deps.splice idx, 1
            done()
        return

    take()

    processed = {}
    bundleIndex = 0

    memo = {processed, bundleIndex}
    componentDir = sysPath.resolve options._c.paths.BOWER_COMPONENTS_RELATIVE_PATH, name

    for path in files
        take()
        path = path.substring(componentDir.length + 1).replace(/[\\]/g, '/')
        if /\*/.test path
            _matchBowerFiles component, config, {path, componentDir, memo}, options, give
        else
            _compileBowerFile path, component, config, memo, false, options, give

    give()
    return

# path is relative path without leading slash
# componentDir is absolute path without trailing slash
_matchBowerFiles = (component, config, {path, componentDir, memo}, options, done)->
    anyspawn = require 'anyspawn'
    anyspawn.exec 'ls ' + path.replace(/[\\]/g, '/'), {cwd: componentDir, prompt: false}, (err, outpout, code)->
        return done(err) if err
        outpout = outpout.split(/[\r?\n]+/g)

        next = (err)->
            if err or outpout.length is 0
                done(err)
                return

            path = outpout.shift()
            return next() if path is ''
            path = sysPath.resolve(componentDir, path)
            _compileBowerFile path, component, config, memo, true, options, next
            return

        next()
        return
    # return done()
    # matcher = anymatch [path]
    # start = componentDir.length + 1
    # explore componentDir, (path, stats, next)->
    #     relativePath = path.substring(start).replace(/[\\]/g, '/')
    #     if matcher relativePath
    #         _compileBowerFile path, component, config, memo, true, options, next
    #         return
    #     next()
    # , done
    # return

_compileBowerFile = (path, component, config, memo, isAbsolutePath, options, done)->
    name = component.name
    configPaths = options._c.paths
    {processed, bundleIndex} = memo
    jsExtensions = options.jsExtensions

    if isAbsolutePath
        absolutePath = path
        path = sysPath.relative sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name), path
    else
        absolutePath = sysPath.resolve configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name, path

    return done() if processed.hasOwnProperty absolutePath
    logger.trace "compiling bower file #{component.name}, #{path}"

    processed[absolutePath] = true
    extname = sysPath.extname path
    destFile = sysPath.resolve configPaths.BOWER_PUBLIC_PATH, name, path

    if jsExtensions.test extname
        memo.hasJs = true

        if typeof config.paths[name] is 'undefined'
            if component.exports
                # shim non amd file
                shim = exports: component.exports

                if typeof component.dependencies is 'object' and component.dependencies isnt null
                    shim.deps = Object.keys component.dependencies

                config.shim[name] = shim

            if typeof component.paths is 'string'
                paths = [component.paths]
            else if component.paths instanceof Array
                paths = component.paths
            else
                paths = []

            # never includes a '.js' extension since
            # the paths config could be for a directory.
            paths.push configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace /[\\]/g, '/'
            for url, index in paths
                paths[index] = url.replace /\.js$/, ''
            config.paths[name] = paths

        else
            logger.debug  "[#{name}] add [#{path}] as bundle"

            if component.exports
                # shim non amd file

                if not config.bundles.hasOwnProperty name
                    # Make first file the main file
                    plugin = name + '.plugin.' + memo.bundleIndex++
                    config.shim[plugin] = config.shim[name]
                    config.paths[plugin] = config.paths[name]
                    config.bundles[name] = [plugin]

                # make current file to load with name
                plugin = name + '.plugin.' + memo.bundleIndex++
                config.bundles[name].push plugin

                # make current file to load after the main file
                config.shim[plugin] =
                    exports: component.exports
                    deps: [config.bundles[name][0]]

                # configure requirejs for plugin path resolution
                path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/').replace(/\.js$/, '')
                config.paths[plugin] = [path]

            else
                # amd module
                if not config.bundles.hasOwnProperty name
                    config.bundles[name] = [config.paths[name][0]]
                    delete config.paths[name]

                # never includes a '.js' extension since
                # the paths config could be for a directory.
                path = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/').replace(/\.js$/, '')

                # make current file to load with name
                # full path name is needed for relative path resolution
                config.bundles[name].push path

    done()
    return

_writeMainFile = (config, options, done)->
    bundles = config.bundles
    delete config.bundles

    loader = config.loader or 'umd-core/depsLoader'
    delete config.loader

    pathBrowserify = config['path-browserify'] or 'umd-core/path-browserify'
    delete config['path-browserify']

    srcPath = sysPath.resolve(__dirname, '../templates/main.js')
    source = fs.readFileSync srcPath, 'utf8'
    template = _.template source

    data = template
        require: require
        __filename: srcPath
        __dirname: sysPath.dirname srcPath
        config: util.inspect config, depth: null
        bundles: JSON.stringify bundles
        loader: loader
        pathBrowserify: pathBrowserify
        unit: false

    path = 'javascripts/main.js'
    realPath = sysPath.resolve options._c.paths.PUBLIC_PATH, path

    _writeData data, realPath, path, {optimizer: options._c.optimizer}, (err)->
        return done(err) if err

        config.baseUrl = '/base/' + options.paths.public + '/' + config.baseUrl
        config.paths['angular-mocks'] = ['/base/bower_components/angular-mocks/angular-mocks']
        config.shim['angular-mocks'] =
            exports: 'angular.module'
            deps: ['angular']
        data = template
            require: require
            __filename: srcPath
            __dirname: sysPath.dirname srcPath
            config: util.inspect config, depth: null
            bundles: JSON.stringify bundles
            loader: loader
            pathBrowserify: pathBrowserify
            unit: true

        path = 'test/unit/test-main.js'
        realPath = sysPath.resolve options._c.paths.APPLICATION_PATH, path
        _writeData data, realPath, path, {}, done

        return
    return

_writeData = (data, realPath, path, options, done)->
    mkdirp sysPath.dirname(realPath), (err)->
        return done err if err

        writer = fs.createWriteStream realPath, flags: 'w'

        if options.optimizer
            options.optimizer.optimize {data, path}, (err, {data: optimized, path, map})->
                return done err if err
                writer.write optimized || data
                done()
                return
        else
            writer.write beautify data, 
                indent_with_tabs: false
                preserve_newlines: true
                max_preserve_newlines: 4
                space_in_paren: false
                jslint_happy: false
                brace_style: 'collapse'
                keep_array_indentation: false
                keep_function_indentation: false
                eval_code: false
                unescape_strings: false
                break_chained_methods: false
                e4x: false
                wrap_line_length: 0
            done()
        return
    return


compileIndex = do ->
    timeWindow = 500
    # time in ms
    timeout = undefined

    ->
        context = this
        args = arguments
        clearTimeout timeout
        timeout = setTimeout ->
            _compileIndex.apply context, args
            return
        , timeWindow
        return

_compileIndex = (path, options)->
    configPaths = options._c.paths
    srcpath = sysPath.resolve(configPaths.CLIENT_ASSETS_PATH, path)
    source = fs.readFileSync srcpath, 'utf8'
    template = _.template source

    destFileSingle = sysPath.resolve configPaths.PUBLIC_PATH, 'index.single.html'
    fs.writeFileSync destFileSingle, template
        require: require
        __filename: srcpath
        __dirname: sysPath.dirname srcpath
        single: true
        resource: 'app'

    destFileClassic = sysPath.resolve configPaths.PUBLIC_PATH, 'index.classic.html'
    fs.writeFileSync destFileClassic, template
        require: require
        __filename: srcpath
        __dirname: sysPath.dirname srcpath
        single: false
        resource: 'web'

    logger.info 'compiled index file'

buildClient = (config, options, extra, next)->
    if extra.watcher
        watcher = extra.watcher
        indexPath = sysPath.join config.paths.CLIENT_ASSETS_PATH, INDEX_FILE
        watcher.on 'ready', ->
            compileIndex indexPath, options
            return
        watcher.on 'change', (path)->
            compileIndex indexPath, options, path
            return

        next()
        return

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
        if command is 'watch' or command is 'w'
            watchClientFiles options, next
            return

        exploreClientFiles options, next
    return

INDEX_FILE = 'index.jst'

watchClientFiles = (options, next)->
    logger.info 'Start watching client files'

    watcher = chokidar.watch sysPath.join options._c.paths.CLIENT_ASSETS_PATH, INDEX_FILE
    watcher.on('add', (path)->
        compileIndex path, options
        return
    ).on 'change', (path)->
        compileIndex path, options
        return

    next() if 'function' is typeof next
    return

exploreClientFiles = (options, next)->
    compileIndex  INDEX_FILE, options
    next()
    return

buildSem = semLib.semCreate 1, true
# count = 0

build = (options, next)->
    self = build
    return next self.config if self.config

    if self.building
        # logger.warn 'waiting', ++count
        buildSem.semTake ->
            # logger.warn 'freeing', --count
            next self.config
            return
        return

    self.building = true
    options = self.options = _.clone options
    self.config = initConfig options

    buildSem.semTake ->
        buildBower options, (err)->
            throw err if err
            self.building = false
            next self.config
            return
        return

    return


self = {}

exports.getConfig = ->
    self.config

exports.buildClient = (extra, done)->
    buildClient self.config, self.options, extra, done or (->)
    return

exports.buildBower = (options, done)->
    options = self.options = _.clone options
    self.config = initConfig options

    options.jsExtensions or (options.jsExtensions = /\.js$/)

    buildBower options, ->
        done self.config
        return
    return
