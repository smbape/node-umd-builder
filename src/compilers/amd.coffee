'use strict'

log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'AmdCompiler'

fs = require 'fs'
sysPath = require 'path'
mkdirp = require 'mkdirp'
beautify = require('js-beautify').js_beautify
hasProp = Object::hasOwnProperty
fcache = require '../../utils/fcache'
anymatch = require 'anymatch'
_ = require 'lodash'
UglifyJSOptimizer = require 'uglify-js-brunch'

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

    toCompile = {}

    for prop in ['main', 'scripts']
        isScript = prop is 'scripts'
        for path in component.package[prop]
            # normalize path
            path = sysPath.relative(componentDir, sysPath.resolve(componentDir, path)).replace(/[\\]/g, '/')
            if /[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(path)
                matcher = anymatch [path]
                for path of component.jsfiles
                    if not hasProp.call(toCompile, path) and matcher path.replace(/[\\]/g, '/')
                        toCompile[path] = {isScript}
            else if not hasProp.call(toCompile, path) and component.jsfiles and hasProp.call component.jsfiles, path
                toCompile[path] = {isScript}

    for path, opts of toCompile
        task path, opts

    if component.map
        for path, map of component.map
            # normalize path
            path = sysPath.resolve(componentDir, path)
            path = sysPath.relative(componentDir, path).replace(/[\\]/g, '/')
            task path, { map } if component.jsfiles and hasProp.call(component.jsfiles, path)

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
    logger.trace "compiling bower file #{component.name}: #{path}"

    processed[absolutePath] = true
    extname = sysPath.extname path
    destFile = sysPath.resolve configPaths.BOWER_PUBLIC_PATH, name, path

    memo.hasJs = true
    pathext = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/')
    path = pathext.replace(/\.js$/, '')
    exports = component.exports

    if typeof config.paths[name] is 'undefined' and not opts.isScript and not opts.map
        if exports
            # shim non amd file
            shim = exports: exports

            if typeof component.dependencies is 'object' and component.dependencies isnt null
                shim.deps = Object.keys(component.dependencies)

            config.shim[name] = shim

        if typeof component.paths is 'string'
            paths = [component.paths, path]
        else if Array.isArray(component.paths)
            paths = component.paths.slice(0)
            paths.push path
        else
            paths = path

        config.paths[name] = paths

        # reverse path, treat full path as name
        config.map['*'][path] = name

    else
        logger.debug  "[#{name}] add [#{path}] as group"

        if _.isObject(opts.map)
            if opts.map.exports
                exports = opts.map.exports
            paths = opts.map.paths
            if "string" is typeof paths
                paths = [paths]
            else if not Array.isArray(paths)
                paths = null

            if opts.map.dependencies
                deps = Object.keys(opts.map.dependencies)

            plugin = opts.map.name
        else if "string" is typeof opts.map
            plugin = opts.map

        if plugin
            if hasProp.call(config.paths, plugin)
                done new Error "[#{name}] - Cannot add [#{plugin}] to groups. Already exists as path #{config.paths[plugin]}"
                return

            if Array.isArray(paths)
                paths.push(path)
            else
                paths = path

            # configure requirejs for plugin path resolution
            config.paths[plugin] = paths

            # reverse path, treat full path as name
            config.map['*'][path] = plugin
        else
            if exports
                plugin = name + "_" + Math.random().toString(36).slice(2)
            else
                plugin = path

            if hasProp.call(config.paths, plugin)
                done new Error "[#{name}] - Cannot add [#{plugin}] to groups. Already exists as path #{config.paths[plugin]}"
                return

            # configure requirejs for plugin path resolution
            config.paths[plugin] = path

        if exports
            # shim non amd file
            if deps
                if deps.indexOf(name) is -1
                    deps.unshift(name)
            else
                deps = [name]

            # make current file to load after the main file
            config.shim[plugin] =
                exports: exports
                deps: deps

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

    localOptions = options.options or {}
    srcPath = localOptions.mainTemplate or sysPath.resolve(__dirname, '../../templates/main.js')
    source = fs.readFileSync srcPath, 'utf8'
    template = _.template source

    tplOpts = _.extend {
        require: require
        __filename: srcPath
        __dirname: sysPath.dirname srcPath
        config
        pathBrowserify
        paths: paths
        optimize: options.config.isProduction
        root: paths.APPLICATION_PATH
        public: paths.PUBLIC_PATH
    }, localOptions.tplOpts

    types =
        build: [sysPath.resolve(paths.APPLICATION_PATH, 'work/rbuild.js'), 'work/rbuild.js' ]
        unit: [localOptions.unitBuildDest or sysPath.resolve(paths.APPLICATION_PATH, 'test/unit/test-main.js'), 'test/unit/test-main.js']
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

        opts = if tplOpts.type is 'main-dev' then { optimizer: options.optimizer } else {}

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
                writer.write(optimized || data, 'utf8', done)
                writer.end()
                writer = null
        else
            writer.write beautify(data, 
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
            ), 'utf8', done

            writer.end()
            writer = null
        return
    return

_compileIndex = (config, options, done)->
    paths = options.paths
    srcpath = sysPath.join paths.CLIENT_ASSETS_PATH, 'index.jst'

    try
        stats = fs.lstatSync(srcpath)
        return done() if not stats.isFile()
    catch e
        return done()

    source = fs.readFileSync srcpath, 'utf8'
    tplOpts =
        require: require
        __filename: srcpath
        __dirname: sysPath.dirname srcpath
        optimize: !!options.optimizer

    try
        template = _.template source

        destFileSingle = sysPath.resolve paths.PUBLIC_PATH, 'index.single.html'
        _writeHTML template(_.defaults({build: 'app'}, tplOpts)), destFileSingle, options.options, (err)->
            return done(err) if err

            destFileClassic = sysPath.resolve paths.PUBLIC_PATH, 'index.classic.html'
            _writeHTML template(_.defaults({build: 'web'}, tplOpts)), destFileClassic, options.options, (err)->
                return done(err) if err
                logger.info 'compiled index file'
                done()
                return
    catch err
        done(err)

    return

_writeHTML = (html, dst, options, done)->
    beforeWrite = options.beforeWrite
    if _.isFunction beforeWrite
        html = beforeWrite html, dst, options
        if html instanceof Promise
            html.then (html)->
                fs.writeFile dst, html, done
                return
        else
            fs.writeFile dst, html, done
    else
        fs.writeFile dst, html, done
    return

builder = require '../builder'
writeData = require '../writeData'
readComponents = require '../../utils/read-components'
{ parse: factoryParse, NG_FACTORIES } = require('../../utils/method-parser')

removeStrictOptions = (str)->
    str.replace /^\s*(['"])use strict\1;?[^\n]*$/m, ''

defaultOptions = {}

defaultOptions.umdWrapper = (data, options, modulePath)->
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
            module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);
        } else if (typeof define === 'function' && define.amd) {
            // AMD
            depsLoader.amd(deps, factory, global);
        }
    }(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));
    """

defaultOptions.comWrapper = (data, options)->
    strict = ''
    if options.strict
        data = removeStrictOptions data
        strict = "'use strict';"

    """
    #{strict}
    var deps = [];

    #{data}

    (function(require, global) {
        // CommonJS
        module.exports = depsLoader.common(require, global.require && global.require.brunch ? ['brunch', 'common'] : 'common', deps, factory, global);
    }(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));
    """

defaultFactories = defaultOptions.factories = {}

ngFactory = (plugin, modulePath, data, parsed)->
    [locals, name, args, head, declaration, body] = parsed

    body = "#{declaration}#{args.join(', ')}#{body}"

    ngmethod = ctor.substring 'ng'.length
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

do ->
    for name in NG_FACTORIES
        defaultFactories[name] = ngFactory

    return

defaultFactories.ngmodule = (plugin, modulePath, data, parsed)->
    [locals, name, args, head, declaration, body] = parsed

    body = "#{declaration}#{args.join(', ')}#{body}"

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

        // eslint-disable-next-line no-invalid-this
        ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));
        return exports;
    }
    """

defaultFactories.freact = (plugin, modulePath, data, parsed)->
    [locals, name, args, head, declaration, body] = parsed

    """
    #{head}
    deps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});
    
    function factory(require, React, ReactDOM) {
        /*jshint validthis: true */

        #{declaration}#{args.join(', ')}#{body}

        // eslint-disable-next-line no-invalid-this
        return freact.apply(this, Array.prototype.slice.call(arguments, 3));
    }
    """

defaultFactories.factory = (plugin, modulePath, data, parsed)->
    [locals, name, args, head, declaration, body] = parsed

    if 'require' isnt args[0]
        # remove any require variable
        while (index = args.indexOf('require')) isnt -1
            args[index] = 'undefined'

        args.unshift 'require'
        data = "#{head}#{declaration}#{args.join(', ')}#{body}"

    return data

JsHinter = require './jshinter'
EsLinter = require './eslinter'

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true

    constructor: (config = {})->
        if config.isProduction
            @optimizer = new UglifyJSOptimizer config

        @paths = builder.generateConfig(config).paths
        @paths.public = config.paths.public

        @config = _.clone config
        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @nameCleaner = config.modules.nameCleaner
        @options = options = _.merge {}, defaultOptions, config.plugins?.amd

        if @options.eslint
            @linter = new EsLinter config
        else if @options.jshint
            @linter = new JsHinter config

        @isIgnored = if @options.ignore then anymatch(@options.ignore) else if config.conventions and config.conventions.vendor then config.conventions.vendor else anymatch(/^(?:bower_components|vendor)/)
        @isVendor = config.conventions and config.conventions.vendor
        @initializing = false
        @pending = []
        @requirejs = config.requirejs
        @packages = {}
        @noAmd = @options.noAmd
        @factories = _.clone @options.factories
        @parseOptions = factories: Object.keys @factories

    compile: (params, done)->
        {data, path, map} = params

        if @options.bind
            data = data.replace /function\s*\(\)\s*\{\s*return fn.apply\(me, arguments\);\s*\}/, 'fn.bind(me)'

        umdData = comData = data
        
        if not @isIgnored params.path
            try
                [locals, name] = parsed = factoryParse data, @parseOptions
            catch err
                logger.error err

            if name
                modulePath = @nameCleaner path
                if hasProp.call(@factories, name) and 'function' is typeof @factories[name]
                    data = @factories[name] @, modulePath, data, parsed

                umdData = @options.umdWrapper data, _.clone(@options), modulePath
                comData = @options.comWrapper data, _.clone(@options), modulePath

        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path) + '.js'

        @_getComponents (err, components)=>
            return done(err) if (err)
            if /^bower_components[\/\\]/.test(path) and @isVendor and @isVendor(path)
                [match, name, relpath] = path.match(/^bower_components[\/\\]([^\/\\]+)[\/\\](.+)/)
                components[name].jsfiles or (components[name].jsfiles = {})
                components[name].jsfiles[relpath] = true

            @_lint {comData, umdData, path, map, dst}, (err, options)=>
                return done(err) if (err)

                if @noAmd
                    done err, {data: comData, path}
                    return

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

    onCompile: (generatedFiles, changedAssets)->
        if generatedFiles.length is 0 and changedAssets.length is 0
            return

        options = _.pick @, ['paths', 'lastPackages', 'options', 'config', 'optimizer']

        resolve = ->
        reject = ->
        done = (err)->
            resolve()
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

        plugin = @

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

        return new Promise (_resolve, _reject)->
            resolve = _resolve
            reject = _reject
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
        if linter = @linter
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
        {umdData, path, map, dst} = options

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
            return false

        generatedFiles.forEach (generatedFile, index)->
            generatedFile.sourceFiles.forEach (file, index)->
                if file.removed
                    path = file.path
                    if path
                        dirname = sysPath.dirname(path).replace /[\\]/g, '/'
                        delete packages[dirname]?[path.replace(/\.[^\.]+$/, '')]

                        dst = sysPath.join plugin.paths.PUBLIC_PATH, plugin.amdDestination(path) + '.js'
                        fs.unlinkSync dst
                return
            return

        hasChanged = false
        for dirname, paths of packages

            if not lastPackages or not _.isEqual(lastPackages[dirname], paths)
                hasChanged = true
                packageNameWithoutExt = fcache.packageName.replace(/\.[^\.]+$/, '')
                packageName = sysPath.join dirname, fcache.packageName
                absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep)
                paths = Object.keys(paths).sort()

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
                    if basename is packageNameWithoutExt
                        continue
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

        plugin.lastPackages = _.cloneDeep packages

        return hasChanged

AmdCompiler.brunchPluginName = 'amd-brunch'
