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

clone = require("lodash/clone")
cloneDeep = require("lodash/cloneDeep")
defaults = require("lodash/defaults")
defaultsDeep = require("lodash/defaultsDeep")
extend = require("lodash/extend")
isEqual = require("lodash/isEqual")
isFunction = require("lodash/isFunction")
isObjectLike = require("lodash/isObjectLike")
merge = require("lodash/merge")
pick = require("lodash/pick")

_template = require("./jst/template")

UglifyJSOptimizer = require 'uglify-js-brunch'

modules = require("../../utils/modules")

_processComponent = (component, config, options, done)->
    if component.umd
        done()
        return

    if not (component.files instanceof Array)
        done()
        return

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
            give = Function.prototype
        return

    take()

    memo = {processed: {}}
    componentDir = sysPath.join options.paths.BOWER_COMPONENTS_ABSOLUTE_PATH, name

    task = (path, opts)->
        take()
        _compileComponentFile path, component, config, memo, false, options, opts, give
        return

    toCompile = {}

    for prop in ['main', 'scripts']
        isScript = prop is 'scripts'
        files = component.package[prop]
        continue if not files

        for path in files
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
    {processed} = memo

    if isAbsolutePath
        absolutePath = path
        path = sysPath.relative sysPath.join(configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name), path
    else
        absolutePath = sysPath.join configPaths.BOWER_COMPONENTS_ABSOLUTE_PATH, name, path

    if hasProp.call processed, absolutePath
        done()
        return

    # logger.trace "compiling bower file #{component.name}: #{path}"

    processed[absolutePath] = true

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
        # logger.trace  "[#{name}] add [#{path}] as group"

        if isObjectLike(opts.map)
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

            if hasProp.call(config.groups, name)
                deps = deps.concat(config.groups[name])

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
    config = clone config
    pathBrowserify = config['path-browserify'] or 'umd-core/path-browserify'
    delete config['path-browserify']

    localOptions = options.options or {}
    filename = localOptions.mainTemplate or sysPath.resolve(__dirname, '../../templates/main.js')
    source = fs.readFileSync filename, 'utf8'

    imports = modules.makeModule(filename, module)

    template = _template(source, {
        variable: "root",
        imports: imports
    })

    tplOpts = extend {
        config
        pathBrowserify
        paths: paths
        optimize: options.config.isProduction
        root: paths.APPLICATION_PATH
        public: paths.PUBLIC_PATH
    }, imports, localOptions.tplOpts

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
        if err
            done(err)
            return

        writer = fs.createWriteStream dst, flags: 'w'

        if options.optimizer
            writeOptimized = ({data: optimized})->
                writer.write(optimized || data, 'utf8', done)
                writer.end()
                writer = null
                return

            obj = options.optimizer.optimize({data, path})

            if obj isnt null and typeof obj is "object" and typeof obj.then is "function"
                obj.then writeOptimized, done
            else
                writeOptimized(obj)
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
        if not stats.isFile()
            done()
            return
    catch
        done()
        return

    source = fs.readFileSync srcpath, 'utf8'

    try
        filename = srcpath

        imports = modules.makeModule(filename, module)

        template = _template(source, {
            variable: "root",
            imports: imports
        })

        tplOpts = defaults {
            optimize: !!options.optimizer
        }, imports

        destFileSingle = sysPath.resolve paths.PUBLIC_PATH, 'index.single.html'
        _writeHTML template(defaults({build: 'app'}, tplOpts)), destFileSingle, options.options, (err)->
            if err
                done(err)
                return

            destFileClassic = sysPath.resolve paths.PUBLIC_PATH, 'index.classic.html'
            _writeHTML template(defaults({build: 'web'}, tplOpts)), destFileClassic, options.options, (err)->
                if err
                    done(err)
                    return
                logger.info 'compiled index file'
                done()
                return

            return
    catch err
        done(err)

    return

_writeHTML = (html, dst, options, done)->
    beforeWrite = options.beforeWrite
    if isFunction beforeWrite
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
{ parse: factoryParse } = require('umd-loader/lib/method-parser')

removeStrictOptions = (str)->
    str.replace /^\s*(['"])use strict\1;?[^\n]*$/m, ''

defaultOptions = {}

defaultOptions.umdWrapper = require('umd-loader/lib/umdWrapper')

defaultOptions.comWrapper = (data, options)->
    _g = options.global or 'typeof global === "undefined" ? self : global'

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

    }(require, #{ _g }));
    """

defaultFactories = defaultOptions.factories = {}

require("../factories/ng")(defaultFactories);
require("../factories/freact")(defaultFactories);
defaultFactories.factory = require("umd-loader/lib/factories").factory

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true

    constructor: (config = {})->
        @paths = builder.generateConfig(config).paths
        @paths.public = config.paths.public

        joinTo = config.files.javascripts.joinTo

        if typeof joinTo is "string"
            file = joinTo
            joinTo = {}
            joinTo[file] = /\.js$/ # matches all JavaScript files

        for file, pattern of joinTo
            joinTo[file] = anymatch(pattern)

        @joinTo = joinTo

        @config = clone config
        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @nameCleaner = config.modules.nameCleaner
        @options = merge {}, defaultOptions, config.plugins?.amd

        if @options.eslint
            EsLinter = require './eslinter'
            @linter = new EsLinter config
        else if @options.jshint
            JsHinter = require './jshinter'
            @linter = new JsHinter config

        if config.isProduction
            Ctor = @options.optimizer or UglifyJSOptimizer
            @optimizer = new Ctor(config)

        delete @options.eslint
        delete @options.jshint
        delete @options.optimizer

        @isIgnored = if @options.ignore then anymatch(@options.ignore) else if config.conventions and config.conventions.vendor then config.conventions.vendor else anymatch(/^(?:bower_components|vendor)/)
        @isVendor = config.conventions and config.conventions.vendor
        @initializing = false
        @pending = []
        @requirejs = config.requirejs
        @packages = {}
        @deepacks = {}
        @noAmd = @options.noAmd
        @factories = clone @options.factories
        @parseOptions = factories: Object.keys @factories

    compile: (params, done)->
        { joinTo } = @
        { data, path, map } = params

        if @options.bind
            data = data.replace /function\s*\(\)\s*\{\s*return fn.apply\(me, arguments\);\s*\}/, 'fn.bind(me)'

        umdData = comData = data
        
        if not @isIgnored params.path
            try
                [_UNUSED_, name] = parsed = factoryParse data, @parseOptions
            catch err
                logger.error err

            if name
                modulePath = @nameCleaner path
                if hasProp.call(@factories, name) and 'function' is typeof @factories[name]
                    data = @factories[name] @, modulePath, data, parsed

                umdData = @options.umdWrapper data, clone(@options), modulePath
                comData = @options.comWrapper data, clone(@options), modulePath

        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path) + '.js'

        @_getComponents (err, components)=>
            if (err)
                done(err)
                return

            if /^bower_components[\/\\]/.test(path) and @isVendor and @isVendor(path)
                [match, name, relpath] = path.match(/^bower_components[\/\\]([^\/\\]+)[\/\\](.+)/)
                components[name].jsfiles or (components[name].jsfiles = {})
                components[name].jsfiles[relpath] = true

            @_lint {comData, umdData, path, map, dst}, (err, options)=>
                if (err)
                    done(err)
                    return

                if @noAmd
                    done err, {data: comData, path}
                    return

                @_writeData options, (err, options)=>
                    if err
                        done(err)
                        return

                    {comData, umdData, path} = options

                    if not @isVendor or not @isVendor(path)
                        pathWithoutExt = path.replace(/\.[^\.]+$/, '')

                        deepackName = fcache.deepackName
                        reg = /[\/\\]/g
                        while match = reg.exec(path)
                            dirname = path.slice(0, match.index)
                            if @canJoin(dirname + "/" + deepackName, joinTo)
                                @deepacks[dirname] = {} if not hasProp.call(@deepacks, dirname)
                                @deepacks[dirname][pathWithoutExt] = path

                        @packages[dirname] = {} if not hasProp.call(@packages, dirname)
                        @packages[dirname][pathWithoutExt] = path

                    done err, {data: comData, path}

                    return
                return
            return
        return

    # eslint-disable-next-line class-methods-use-this
    canJoin: (path, joinTo)->
        if /^bower_components[\/\\]/.test(path) and not /^bower_components[\/\\][^\/\\]+[\/\\]/.test(path)
            return false
        return Object.keys(joinTo).some((file) -> joinTo[file](path))

    onCompile: (generatedFiles, changedAssets)->
        if generatedFiles.length is 0 and changedAssets.length is 0
            return null

        options = pick @, ['paths', 'lastPackages', 'options', 'config', 'optimizer']

        resolve = Function.prototype
        done = (err)->
            if err
                logger.error(err)
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
        config = defaultsDeep {}, @requirejs, config
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

                    plugin._compilePackages generatedFiles, changedAssets, components
                    _compileIndex config, options, done

                    return
            return

        # Start work
        take()
        components = null
        @_getComponents (err, _components)->
            if err
                give(err)
                return

            components = _components
            for name, component of components
                take()
                _processComponent component, config, options, give

            # End of current work
            give()
            return

        return new Promise (_resolve)->
            resolve = _resolve
            return

    teardown: ->
        if @linter?.teardown
            @linter.teardown()
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
            if (err)
                done(err)
                return

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
            {umdData, path, map} = options
            if sysPath.basename(path) in [ fcache.packageName, fcache.deepackName ]
                done null, options
                return

            linter.lint {data: umdData, path, map}, (msg, output)->
                if msg and linter.warnOnly
                    logger.warn path, msg
                    msg = null

                if output
                    options.umdData = output
                done msg, options
                return

            return
        done null, options
        return

    _writeData: (options, done)->
        {umdData, path, dst} = options

        next = (err)->
            if err
                done(err)
                return
            done(err, options)
            return

        if @optimizer
            writeOptimized = ({data: optimized})->
                writeData optimized || umdData, dst, next
                return

            obj = @optimizer.optimize({data: umdData, path})

            if obj isnt null and typeof obj is "object" and typeof obj.then is "function"
                obj.then writeOptimized, next
            else
                writeOptimized(obj)
            return

        writeData umdData, dst, next
        return

    _compilePackages: (generatedFiles, changedAssets, components)->
        plugin = @

        if not plugin.options.package
            return false

        { packages, deepacks } = plugin

        generatedFiles.forEach (generatedFile, index)->
            generatedFile.sourceFiles.forEach (file, index)->
                return if not file.removed
                path = file.path
                return if not path

                reg = /[\/\\]/g
                while match = reg.exec(path)
                    dirname = path.slice(0, match.index).replace /[\\]/g, '/'
                    delete deepacks[dirname]?[path.replace(/\.[^\.]+$/, '')]

                delete packages[dirname]?[path.replace(/\.[^\.]+$/, '')]

                dst = sysPath.join plugin.paths.PUBLIC_PATH, plugin.amdDestination(path) + '.js'
                fs.unlinkSync dst
                return
            return

        res1 = @_processPackages(plugin, "package", components)

        if not plugin.options.deepack
            return res1

        res2 = @_processPackages(plugin, "deepack", components)

        res1 or res2

    _processPackages: (plugin, name, components)->
        packages = plugin[name + "s"]
        lastPackagesKey = "last" + name[0].toUpperCase() + name.slice(1) + "s"
        lastPackages = @[lastPackagesKey]
        _packageName = fcache[name + "Name"]

        __packageName = fcache.packageName.replace(/\.[^\.]+$/, '')
        __deepackName = fcache.deepackName.replace(/\.[^\.]+$/, '')

        hasChanged = false
        if not lastPackages
            lastPackages = {}

        for dirname, paths of lastPackages
            if hasProp.call(packages, dirname)
                continue

            hasChanged = true

            packageName = sysPath.join dirname, _packageName
            absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep)

            paths = Object.keys(paths).sort()

            if paths.length is 0
                continue

            hasFile = false
            for path in paths
                [_UNUSED_, basename] = path.match /([^\/\\]+)(?:\.[^\.]+)?$/
                if basename in [ __packageName, __deepackName ]
                    continue

                hasFile = true
                break

            if not hasFile
                continue

            fcache.removeFakeFile(packageName)
            builder.fswatcher.emit 'unlink', absPath

        getIndex = (path)->
            [ _UNUSED_, name ] = dirname.match(/^bower_components[\/\\]([^\/\\]+)/)
            files = components[name].files
            if files.length is 1
                return 0

            path = sysPath.join(plugin.paths.APPLICATION_PATH, path)

            for file, i in files
                if /[\^\$\|\?\*\+\(\)\[\]\{\}]/.test(file)
                    if anymatch(file)(path)
                        return i
                else if file is path
                    return i

            return -1

        sorter = (a, b)->
            a = paths[a]
            b = paths[b]

            ia = getIndex(a)
            ib = getIndex(b)

            if ia > ib
                return 1

            if ia < ib
                return -1

            if a > b
                return 1

            if a < b
                return -1

            return 0

        for dirname, paths of packages
            if isEqual(lastPackages[dirname], paths)
                continue

            hasChanged = true
            packageName = sysPath.join dirname, _packageName
            absPath = sysPath.join(plugin.paths.APPLICATION_PATH, packageName).replace(/[\\]/g, sysPath.sep)

            if /^bower_components[\/\\]/.test(dirname)
                paths = Object.keys(paths).sort(sorter)
            else
                paths = Object.keys(paths).sort()

            if paths.length is 0
                delete packages[dirname]
                fcache.removeFakeFile(packageName)
                fs.unlinkSync absPath
                builder.fswatcher.emit 'unlink', absPath
                continue

            deps = []
            _module = {}

            i = 0
            hasFile = false
            for path in paths
                relpath = path.slice(dirname.length + 1)
                { name: basename, dir: _dirname } = sysPath.parse(relpath)

                if basename in [ __packageName, __deepackName ]
                    continue

                if _dirname.length isnt 0
                    _dirname = _dirname.replace(/\\/g, "/") + "/"

                relModulePath = _dirname + basename

                hasFile = true

                deps.push "./" + relModulePath

                obj = _module
                reg = /\//g
                lastIndex = 0
                while match = reg.exec(relModulePath)
                    key = relModulePath.slice(lastIndex, match.index)
                    lastIndex = reg.lastIndex

                    if !hasProp.call(obj, key)
                        obj[key] = {}

                    else if typeof obj[key] isnt "object"
                        # handle cases like src/core.js, src/core/anoter.js
                        obj[key] = {
                            ".": obj[key]
                        }

                    obj = obj[key]

                obj[basename] = i

                i++

            if not hasFile
                continue

            content = """
                (function(global, factory) {
                    if (typeof define === "function" && define.amd) {
                        define(["module", "#{ deps.join('",\n    "') }"], function() {
                            return factory.apply(global, arguments);
                        });
                    } else if (typeof exports === "object" && typeof module !== "undefined") {
                        factory.call(global, module, require("#{ deps.join('"), require("') }"));
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
                    var args = Array.prototype.slice.call(arguments, arguments.length - #{i});
                    module.exports = #{this.stringifyModule(_module, 4, 4, true)};
                });
            """

            status = fcache.updateFakeFile(packageName, content)
            if status is 0
                builder.fswatcher.emit 'add', absPath
            else
                builder.fswatcher.emit 'change', absPath

        plugin[lastPackagesKey] = cloneDeep packages

        return hasChanged

    stringifyModule: (module, initialSpace = 0, space = 4, order)->
        initialIndent = " ".repeat(initialSpace)
        indent = " ".repeat(space)
        str = []
        initialSpace += space
        keys = Object.keys(module)
        if order
            keys.sort()

        for key in keys
            value = module[key]

            if isObjectLike(value)
                str.push(JSON.stringify(key) + ": " + this.stringifyModule(value, initialSpace, space, order))
            else
                str.push(JSON.stringify(key) + ": args[" + value + "]" )
        
        if str.length is 0
            return "{}"

        indent = initialIndent + indent
        if indent.length isnt 0
            indent = "\n" + indent
            initialIndent = "\n" + initialIndent

        return "{#{ indent }#{ str.join("," + indent) }#{ initialIndent }}"

AmdCompiler.brunchPluginName = 'amd-brunch'
