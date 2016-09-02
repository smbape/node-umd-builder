'use strict'

log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'AmdCompiler'

fs = require 'fs'
mkdirp = require 'mkdirp'
beautify = require('js-beautify').js_beautify
hasProp = Object::hasOwnProperty
fcache = require '../../utils/fcache'

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

    memo = {processed: {}, groupIndex: 0}
    componentDir = sysPath.join options.paths.BOWER_COMPONENTS_ABSOLUTE_PATH, name

    task = (path, opts)->
        take()
        _compileComponentFile path, component, config, memo, false, options, opts, give
        return

    for prop in ['main', 'scripts']
        isScript = prop is 'scripts'
        for path in component.package[prop]
            # normalize path
            path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, '/')
            task path, {isScript} if component.jsfiles and hasProp.call component.jsfiles, path

    if component.map
        for path, map of component.map
            # normalize path
            path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, '/')
            task path, {map} if component.jsfiles and hasProp.call component.jsfiles, path

    give()
    return

_compileComponentFile = (path, component, config, memo, isAbsolutePath, options, opts, done)->
    name = component.name
    configPaths = options.paths
    {processed, groupIndex} = memo

    if isAbsolutePath
        absolutePath = path
        path = sysPath.relative sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name), path
    else
        absolutePath = sysPath.join configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name, path

    return done() if hasProp.call processed, absolutePath
    logger.trace "compiling bower file #{component.name}, #{path}"

    processed[absolutePath] = true
    extname = sysPath.extname path
    destFile = sysPath.resolve configPaths.BOWER_PUBLIC_PATH, name, path

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
    paths = options.paths
    config = _.clone config
    pathBrowserify = config['path-browserify'] or 'umd-core/path-browserify'
    delete config['path-browserify']

    srcPath = sysPath.resolve(__dirname, '../../templates/main.js')
    source = fs.readFileSync srcPath, 'utf8'
    template = _.template source

    tplOpts = {
        require: require
        __filename: srcPath
        __dirname: sysPath.dirname srcPath
        config
        pathBrowserify
        paths: paths
        optimize: !!options.optimizer
        root: paths.APPLICATION_PATH
        public: paths.PUBLIC_PATH
    }

    types =
        build: [sysPath.resolve(paths.APPLICATION_PATH, 'work/rbuild.js'), 'work/rbuild.js' ]
        unit: [sysPath.resolve(paths.APPLICATION_PATH, 'test/unit/test-main.js'), 'test/unit/test-main.js']
        main: [sysPath.resolve(paths.PUBLIC_PATH, 'javascripts/main.js'), 'javascripts/main.js']
        'main-dev': [sysPath.resolve(paths.PUBLIC_PATH, 'javascripts/main-dev.js'), 'javascripts/main-dev.js']

    keys = Object.keys types
    index = 0
    length = keys.length

    iterate = (err)->
        if err or index is length
            done err
            return

        tplOpts.type = keys[index++]
        data = template tplOpts

        opts = if tplOpts.type is 'main-dev' then {optimizer: options.optimizer} else {}

        _writeMainData data, types[tplOpts.type][0], types[tplOpts.type][1], opts, iterate

        return

    iterate()

    return

_writeMainData = (data, dst, path, options, done)->
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

_compileIndex = (config, options, done)->
    paths = options.paths
    srcpath = sysPath.join paths.CLIENT_ASSETS_PATH, 'index.jst'
    source = fs.readFileSync srcpath, 'utf8'
    tplOpts =
        require: require
        __filename: srcpath
        __dirname: sysPath.dirname srcpath
        optimize: !!options.optimizer

    try
        template = _.template source

        destFileSingle = sysPath.resolve paths.PUBLIC_PATH, 'index.single.html'
        fs.writeFileSync destFileSingle, template _.defaults
            build: 'app'
        , tplOpts

        destFileClassic = sysPath.resolve paths.PUBLIC_PATH, 'index.classic.html'
        fs.writeFileSync destFileClassic, template _.defaults
            build: 'web'
        , tplOpts

        logger.info 'compiled index file'
    catch e
        logger.error e

    done()
    return

anymatch = require 'anymatch'
sysPath = require 'path'
_ = require 'lodash'
UglifyJSOptimizer = require 'uglify-js-brunch'

builder = require '../builder'
writeData = require '../writeData'
readComponents = require '../../utils/read-components'
{parse, NG_FNS, NG_PREFIX} = require('../../utils/method-parser')

JsHinter = require './jshinter'

removeStrictOptions = (str)->
    str.replace /^\s*(['"])use strict\1;?[^\n]*$/m, ''

umdWrapper = (data, options, modulePath)->
    strict = ''
    if options.strict
        data = removeStrictOptions data
        strict = "'use strict';"

    """
    (function(require, global) {
        #{strict}
        var deps = [];

        #{data}

        if (typeof process === 'object' && typeof process.platform !== 'undefined') {
            // NodeJs
            module.exports = depsLoader.common(require, 'node', deps, factory, global);
        } else if (typeof exports !== 'undefined') {
            // CommonJS
            module.exports = depsLoader.common(require, 'common', deps, factory, global);
        } else if (typeof define === 'function' && define.amd) {
            // AMD
            depsLoader.amd(deps, factory, global);
        }
    }(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));
    """

comWrapper = (data, options)->
    strict = ''
    if options.strict
        data = removeStrictOptions data
        strict = "'use strict';"

    """
    #{strict}
    var deps = [];

    #{data}

    module.exports = depsLoader.common(require, 'common', deps, factory, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null);
    """

ngFactoryProxy = (plugin, modulePath, ctor, locals, head, body)->
    ngmethod = ctor.substring NG_PREFIX.length
    realPath = plugin.config.paths.modules + '/' + modulePath
    $name = modulePath.replace(/\//g, '.')
    $dirname = sysPath.dirname realPath
    $shortName = modulePath.replace(/.*\/([^\/]+)$/, '$1')

    """
    var ngdeps = [];

    #{head}
    deps.unshift({amd: 'angular', common: '!angular'});
    var ngoffset = deps.length, ngmap = {};

    for (var i = 0, len = ngdeps.length, dep; i < len; i++) {
        dep = ngdeps[i];
        if ('string' === typeof dep && '/' === dep.charAt(0)) {
            ngdeps[i] = dep.substring(1);
            dep = ngdeps[i];
            // deps.length - ngoffset + 1 correspond to ng dependency index
            // that index will be used to know which ngdeps must only by a deps
            // and therefore removed from ngdeps
            ngmap[deps.length - ngoffset + 1] = i;
            deps.push(dep);
        }
    }

    function factory(require, angular#{if locals then ', ' + locals else ''}) {
        var resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);

        #{body}
        
        return depsLoader.createNgUsable(#{ctor}, '#{ngmethod}', '#{$name}', '#{realPath}', '#{$dirname}', '#{$shortName}', ngdeps, resolvedDeps, ngmap);
    }
    """

ngModuleFactoryProxy = (modulePath, head, body)->
    """
    var ngdeps = [];

    #{head}
    deps.unshift({amd: 'angular', common: '!angular'});
    var ngoffset = deps.length, ngmap = {};

    for (var i = 0, len = ngdeps.length, dep; i < len; i++) {
        dep = ngdeps[i];
        if ('string' === typeof dep && '/' === dep.charAt(0)) {
            ngdeps[i] = dep.substring(1);
            dep = ngdeps[i];
            // deps.length - ngoffset + 1 correspond to ng dependency index
            // that index will be used to know which ngdeps must only by a deps
            // and therefore removed from ngdeps
            ngmap[deps.length - ngoffset + 1] = i;
            deps.push(dep);
        }
    }

    function factory(require, angular) {
        /*jshint validthis: true */
        var name = '#{modulePath.replace(/\//g, '.')}',
            resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);

        var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);

        #{body}

        ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));
        return exports;
    }
    """

reactFactoryProxy = (modulePath, head, declaration, args, body)->
    """
    #{head}
    deps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});
    
    function factory(require, React, ReactDOM) {
        /*jshint validthis: true */

        #{declaration}#{args.join(', ')}#{body}

        return freact.apply(this, Array.prototype.slice.call(arguments, 3));
    }
    """

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true
    
    constructor: (config = {})->
        if config.optimize
            @optimizer = new UglifyJSOptimizer config

        @paths = builder.generateConfig(config).paths
        @paths.public = config.paths.public

        @config = _.clone config
        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @nameCleaner = config.modules.nameCleaner
        @options = _.extend {}, config.plugins?.amd
        if @options.jshint
            @jshinter = new JsHinter config
        @isIgnored = if @options.ignore then anymatch(@options.ignore) else if config.conventions and config.conventions.vendor then config.conventions.vendor else anymatch(/^(?:bower_components|vendor)/)
        @isVendor = config.conventions and config.conventions.vendor
        @initializing = false
        @pending = []
        @requirejs = config.requirejs
        @packages = {}

    compile: (params, done)->
        {data, path, map} = params

        umdData = comData = data
        
        if not @isIgnored params.path
            try
                [locals, name, args, head, declaration, body] = res = parse data
            catch err
                logger.error err

            if name
                modulePath = @nameCleaner path
                switch name
                    when 'factory'
                        if 'require' isnt args[0]
                            # remove any require variable
                            while (index = args.indexOf('require')) isnt -1
                                args[index] = 'undefined'

                            args.unshift 'require'
                            data = "#{head}#{declaration}#{args.join(', ')}#{body}"
                    when 'freact'
                        data = reactFactoryProxy modulePath, head, declaration, args, body
                    when 'ngmodule'
                        data = ngModuleFactoryProxy modulePath, head, "#{declaration}#{args.join(', ')}#{body}"
                    else
                        if name in NG_FNS
                            data = ngFactoryProxy self, modulePath, name, locals, head, "#{declaration}#{args.join(', ')}#{body}"

                umdData = umdWrapper data, @options, modulePath
                comData = comWrapper data, @options

        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path) + '.js'

        @_getComponents (err, components)=>
            return done(err) if (err)
            if /^bower_components[\/\\]/.test(path) and @isVendor and @isVendor(path)
                [match, name, relpath] = path.match(/^bower_components[\/\\]([^\/\\]+)[\/\\](.+)/)
                components[name].jsfiles or (components[name].jsfiles = {})
                components[name].jsfiles[relpath] = true
                # console.log name, path, components[name].jsfiles

            @_lint {comData, umdData, path, map, dst}, (err, options)=>
                return done(err) if (err)

                @_writeData options, (err, options)=>
                    return done(err) if err

                    {comData, umdData, path} = options

                    if not @isVendor or not @isVendor(path)
                        dirname = sysPath.dirname(path)
                        @packages[dirname] or (@packages[dirname] = {})
                        @packages[dirname][path.replace(/\.[^\.]+$/, '')] = true

                    done err, {data: comData, path}

                    return
                return
            return
        return

    onCompile: (generatedFiles, changedAssets, done)->
        if 'function' isnt typeof done
            done = ->

        if generatedFiles.length is 0
            done()
            return

        config =
            # http://requirejs.org/docs/api.html#config-enforceDefine
            # To get timely, correct error triggers in IE, force a define/shim exports check.
            enforceDefine: false,

            # http://requirejs.org/docs/api.html#config
            # By default load any module IDs from CLIENT_MODULES_URL
            baseUrl: @paths.CLIENT_MODULES_URL,

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
        config = _.defaultsDeep {}, @requirejs, config
        config.map or (config.map = {})
        config.map['*'] or (config.map['*'] = {})

        options = {
            paths: @paths
            optimizer: @optimizer
            lastPackages: @lastPackages
        }

        plugin = @
        watcherIsReady = builder.bwatcher.watcherIsReady
        builder.bwatcher.watcherIsReady = false

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

                    plugin._compilePackages generatedFiles, changedAssets
                    builder.bwatcher.watcherIsReady = true if watcherIsReady
                    _compileIndex config, options, done

                    return
            return

        # Start work
        take()
        @_getComponents (err, components)->
            return give(err) if err
            for name, component of components
                take()
                _processComponent component, config, options, give

            # End of current work
            give()
            return

        return

    _getComponents: (done)->
        if @components
            done(null, @components)
            return

        if @initializing
            @pending.push done
            return

        self = @
        self.initializing = true
        readComponents sysPath.resolve(self.paths.APPLICATION_PATH), 'bower', (err, components)->
            self.initializing = false
            return done(err) if (err)

            self.components = {}
            for component in components
                self.components[component.name] = component

            components = self.components
            # console.log components

            done(err, components)

            while fn = self.pending.shift()
                fn(err, components)

            return
        return

    _lint: (options, done)->
        if linter = @jshinter
            {comData, umdData, path, map, dst} = options
            linter.lint {data: umdData, path, map}, (msg)->
                if msg and linter.warnOnly
                    logger.warn path, msg
                    msg = null
                done msg, options
                return
            return
        done null, options
        return

    _writeData: (options, done)->
        {comData, umdData, path, dst} = options

        next = (err)->
            return done(err) if err
            done(err, options)
            return

        if @optimizer
            @optimizer.optimize {data: umdData, path}, (err, res)->
                return next(err) if err
                {data: optimized, path, map} = res
                writeData optimized || umdData, dst, next
                return
            return

        writeData umdData, dst, next
        return

    _compilePackages: (generatedFiles, changedAssets)->
        plugin = @
        {lastPackages, packages} = plugin

        if not plugin.options.package
            return

        generatedFiles.forEach (generatedFile, index)->
            generatedFile.sourceFiles.forEach (file, index)->
                if file.removed
                    path = file.path
                    dirname = sysPath.dirname(path).replace /[\\]/g, '/'
                    delete packages[dirname][path]

                    dst = sysPath.join plugin.paths.PUBLIC_PATH, plugin.amdDestination(path) + '.js'
                    fs.unlinkSync dst
                return
            return

        for dirname, paths of packages
            if not lastPackages or not _.isEqual(lastPackages[dirname], paths)
                packageName = sysPath.join dirname, fcache.packageName
                absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep)
                paths = Object.keys(paths)

                if paths.length is 0
                    delete packages[dirname]
                    fs.unlinkSync absPath
                    builder.fswatcher.emit 'unlink', absPath
                    continue

                deps = []
                args = []
                keys = []

                i = 0
                for path in paths
                    hasFile = true
                    [match, basename] = path.match /([^\/\\]+)(?:\.[^\.]+)?$/
                    arg = 'arg' + i
                    args.push arg
                    deps.push './' + basename
                    keys.push '"' + basename + '": ' + arg
                    i++

                if not hasFile
                    return ''

                content = """
                    deps = [
                        "#{deps.join('",\n    "')}"
                    ];

                    function factory(
                        #{args.join(',\n    ')}
                    ) {
                        return {
                            #{keys.join(',\n        ')}
                        };
                    }
                """

                status = fcache.updateFakeFile(packageName, content)
                if status is 0
                    builder.fswatcher.emit 'add', absPath
                else
                    builder.fswatcher.emit 'change', absPath

        plugin.lastPackages = _.clone packages

        return

AmdCompiler.brunchPluginName = 'amd-brunch'
