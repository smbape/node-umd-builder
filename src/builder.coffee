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
anyspawn = require 'anyspawn'

_.template = require('./compilers/jst/template')
_.templateSettings.variable = 'root'
_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g

hasProp = {}.hasOwnProperty

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
        enforceDefine: false,

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

        # http://requirejs.org/docs/api.html#config-groups
        # allows configuring multiple module IDs to be found in another script
        # i.e. when requiring a lib in a group, all others modules are also loaded
        groups: {}

        # http://requirejs.org/docs/api.html#config-shim
        # Configure the dependencies, exports, and custom initialization for older, 
        # traditional "browser globals" scripts that do not use define() to declare the dependencies and set a module value
        shim: {}

        # http://requirejs.org/docs/api.html#config-deps
        deps: []

    # options is immutable, thats why deep is required
    config = _.defaultsDeep {}, options.requirejs, config
    config.map or (config.map = {})
    config.map['*'] or (config.map['*'] = {})

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

    read = require '../utils/read-components'
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

    return done() if not (component.files instanceof Array)

    name = component.name

    if component.lazy
        logger.debug 'lazy', name
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
            done(err)
            give = ->
        return

    take()

    processed = {}
    groupIndex = 0

    memo = {processed, groupIndex}
    componentDir = sysPath.resolve options._c.paths.BOWER_COMPONENTS_RELATIVE_PATH, name

    task = (path, opts)->
        take()
        path = path.replace(/[\\]/g, '/')
        if /\*/.test path
            _matchBowerFiles component, config, {path, componentDir, memo}, options, opts, give
        else
            _compileBowerFile path, component, config, memo, false, options, opts, give

        return

    for prop in ['main', 'scripts', 'styles']
        isScript = prop is 'scripts'
        for path in component.package[prop]
            task path, {isScript}

    if component.map
        opts = {}
        for path, map of component.map
            task path, {map}

    give()
    return

# path is relative path without leading slash
# componentDir is absolute path without trailing slash
_matchBowerFiles = (component, config, {path, componentDir, memo}, options, opts, done)->
    matcher = anymatch [path]
    start = componentDir.length + 1
    explore componentDir, (path, stats, next)->
        relativePath = path.substring(start).replace(/[\\]/g, '/')
        if matcher relativePath
            _compileBowerFile path, component, config, memo, true, options, opts, next
            return
        next()
    , done
    return

_compileBowerFile = (path, component, config, memo, isAbsolutePath, options, opts, done)->
    name = component.name
    configPaths = options._c.paths
    {processed, groupIndex} = memo

    if isAbsolutePath
        absolutePath = path
        path = sysPath.relative sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name), path
    else
        absolutePath = sysPath.resolve configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name, path

    return done() if hasProp.call processed, absolutePath
    logger.trace "compiling bower file #{component.name}, #{path}"

    processed[absolutePath] = true
    extname = sysPath.extname path
    destFile = sysPath.resolve configPaths.BOWER_PUBLIC_PATH, name, path

    if options.jsExtensions.test extname
        memo.hasJs = true

        pathext = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/')
        path = pathext.replace(/\.js$/, '')

        if typeof config.paths[name] is 'undefined' and not opts.isScript and not opts.map
            if component.exports
                # shim non amd file
                shim = exports: component.exports

                if typeof component.dependencies is 'object' and component.dependencies isnt null
                    shim.deps = Object.keys component.dependencies

                config.shim[name] = shim

            if typeof component.paths is 'string'
                paths = [component.paths, path]
            else if Array.isArray(component.paths)
                paths = component.paths
                paths.push path
            else
                paths = path

            config.paths[name] = paths

            # reverse path, treat full path as name
            config.map['*'][path] = name

        else
            logger.debug  "[#{name}] add [#{path}] as group"

            if opts.map
                plugin = opts.map

                if hasProp.call(config.paths, plugin)
                    done new Error "[#{name}] - Cannot add [#{plugin}] to groups. Already exists as path name"
                    return

                # configure requirejs for plugin path resolution
                config.paths[plugin] = path

                # reverse path, treat full path as name
                config.map['*'][path] = plugin
            else
                if component.exports
                    plugin = name + ( '' + Math.random() ).replace( /\D/g, '' )
                else
                    plugin = path

                if hasProp.call(config.paths, plugin)
                    done new Error "[#{name}] - Cannot add [#{plugin}] to groups. Already exists as path name"
                    return

            if component.exports
                # shim non amd file

                # make current file to load after the main file
                config.shim[plugin] =
                    exports: component.exports
                    deps: [name]

            if not hasProp.call config.groups, name
                config.groups[name] = [name]

            config.groups[name].push plugin

    done()
    return

_writeMainFile = (config, options, done)->

    # for name in Object.keys(config.groups)
    #     group = name + '-group'
    #     if hasProp.call(config.paths, group)
    #         done new Error "[#{name}] - Cannot add group [#{group}]. Already exists as path name"
    #         return

    # groups = config.groups
    # delete config.groups

    # deps = config.deps

    # for component of groups
    #     groups[component].shift()
    #     i = 0
    #     len = groups[component].length
    #     while i < len
    #         path = groups[component][i]
    #         group = 'group-' + component + '-' + i
    #         deps[deps.length] = group
    #         config.paths[group] = groups[component][i]
    #         if config.shim[component]?.exports
    #             config.shim[group] = deps: [ component ]
    #             config.shim[group].exports = config.shim[component].exports
    #         i++

    pathBrowserify = config['path-browserify'] or 'umd-core/path-browserify'
    delete config['path-browserify']

    srcPath = sysPath.resolve(__dirname, '../templates/main.js')
    source = fs.readFileSync srcPath, 'utf8'
    template = _.template source

    tplOpts = {
        require: require
        __filename: srcPath
        __dirname: sysPath.dirname srcPath
        config
        pathBrowserify
        paths: options.paths
        optimize: !!options._c.optimizer
        root: options._c.paths.APPLICATION_PATH
        public: options._c.paths.PUBLIC_PATH
    }

    types =
        build: [sysPath.resolve(options._c.paths.APPLICATION_PATH, 'work/rbuild.js'), 'work/rbuild.js' ]
        unit: [sysPath.resolve(options._c.paths.APPLICATION_PATH, 'test/unit/test-main.js'), 'test/unit/test-main.js']
        main: [sysPath.resolve(options._c.paths.PUBLIC_PATH, 'javascripts/main.js'), 'javascripts/main.js']
        'main-dev': [sysPath.resolve(options._c.paths.PUBLIC_PATH, 'javascripts/main-dev.js'), 'javascripts/main-dev.js']

    keys = Object.keys types
    index = 0
    length = keys.length

    iterate = (err)->
        if err or index is length
            done err
            return

        tplOpts.type = keys[index++]
        data = template tplOpts

        opts = if tplOpts.type is 'main-dev' then {optimizer: options._c.optimizer} else {}

        _writeData data, types[tplOpts.type][0], types[tplOpts.type][1], opts, iterate

        return

    iterate()

    return

_writeData = (data, dst, path, options, done)->
    mkdirp sysPath.dirname(dst), (err)->
        return done err if err

        writer = fs.createWriteStream dst, flags: 'w'

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
    tplOpts =
        require: require
        __filename: srcpath
        __dirname: sysPath.dirname srcpath
        optimize: !!options._c.optimizer

    try
        template = _.template source

        destFileSingle = sysPath.resolve configPaths.PUBLIC_PATH, 'index.single.html'
        fs.writeFileSync destFileSingle, template _.defaults
            build: 'app'
        , tplOpts

        destFileClassic = sysPath.resolve configPaths.PUBLIC_PATH, 'index.classic.html'
        fs.writeFileSync destFileClassic, template _.defaults
            build: 'web'
        , tplOpts

        logger.info 'compiled index file'
    catch e
        logger.error e

buildClient = (config, options, extra, next)->
    {APPLICATION_PATH, PUBLIC_PATH} = options._c.paths

    if extra.watcher
        {watcher, bwatcher} = extra
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
                dstpath = sysPath.join PUBLIC_PATH, dstpath
                if 'string' is typeof srcpath
                    type = 'file'
                else
                    [srcpath, type] = srcpath
                srcpath = sysPath.resolve APPLICATION_PATH, srcpath
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
