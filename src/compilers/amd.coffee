log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'AmdCompiler'

sysPath = require 'path'
_ = require 'lodash'
UglifyJSOptimizer = require 'uglify-js-brunch'
JsHinter = require './jshinter'

builder = require('../../').builder
writeData = require '../writeData'

# http://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically-from-javascript#12108723
FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m
FN_ARG_SPLIT = /,/
FN_ARG = /^\s*(_?)(.+?)\1\s*$/
STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg

forEach = (arr, cb)->
    Array::forEach.call arr, cb

annotate = (fn) ->
    return if 'string' isnt typeof fn
    $inject = []
    fnText = fn.replace(STRIP_COMMENTS, '')
    argDecl = fnText.match(FN_ARGS)
    forEach argDecl[1].split(FN_ARG_SPLIT), (arg) ->
        arg.replace FN_ARG, (all, underscore, name) ->
            $inject.push name
            return
        return
    $inject

NG_PREFIX = 'ng'
FN_ARGS_REG = '(\\b\\s*[^\\(]*\\(\\s*[^\\)]*\\))'
authorisedFunctions = ['usable', 'run', 'config', 'module', 'factory', 'filter', 'directive', 'controller', 'service', 'value', 'constant', 'decorator', 'provider']
selectorReg = '(' + NG_PREFIX + authorisedFunctions.join( '|' + NG_PREFIX) + ')'
NG_REGEXP = new RegExp "^(?:#{selectorReg}\\s*=|function\\s+#{selectorReg}\\b|factory\\s*=\\s*function#{FN_ARGS_REG}|function\\s+factory#{FN_ARGS_REG})", 'mg'

checkMethod = (path, script, done)->
    # reset lastIndex to start search from the begining of string
    NG_REGEXP.lastIndex = 0 if NG_REGEXP.lastIndex

    match = NG_REGEXP.exec script
    return done() if not match

    name = match[1] || match[2] || 'factory'
    index = NG_REGEXP.lastIndex - match[0].length

    head = script.substring 0, index
    body = script.substring index

    res = {name, head, body}

    switch name
        when 'factory'
            res.$inject = $inject = annotate "function #{match[3] || match[4]}"
            return done(null, res) if $inject[0] is 'require'
        else
            # find locals
            res.head = head.replace /^\/\*\s*locals\s*=\s*([^*]+)\s*\*\/\n?/m, (match, _locals)->
                res.locals = _locals.trim()
                return ''
    return done(null, res)

removeStrictOptions = (str)->
    str.replace /^\s*(['"])use strict\1;?[^\n]*$/m, ''

umdWrapper = (data, options)->
    strict = ''
    if options.strict
        data = removeStrictOptions data
        strict = "'use strict';"

    """
    (function(require) {
        #{strict}
        var deps = [];

        #{data}

        if (typeof process === 'object' && typeof process.platform !== 'undefined') {
            // NodeJs
            module.exports = depsLoader.common.call(this, require, 'node', deps, factory);
        } else if (typeof define === 'function' && define.amd) {
            // AMD
            depsLoader.amd.call(this, deps, factory);
        }
    }.call(typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null, require));
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

    module.exports = depsLoader.common.call(typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null, require);
    """

factoryProxy = (plugin, modulePath, ctor, locals, head, body)->
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
            dep = ngdeps[i].replace(/\\./g, '/');
            // deps.length - ngoffset + 1 correspond to ng dependency index
            // that index will be used to know which ngdeps must only by a deps
            // and therefore removed from ngdeps
            ngmap[deps.length - ngoffset + 1] = i;
            deps.push(dep);
        }
    }

    function factory(require, angular) {
        var name = '#{modulePath.replace(/\//g, '.')}',
            resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);

        var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);

        #{body}

        ngmodule.apply(typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null, Array.prototype.slice.call(arguments, 2));
        return exports;
    }
    """

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true
    
    constructor: (config = {})->
        if config.optimize
            @optimizer = new UglifyJSOptimizer config

        @config = _.clone config
        @amdDestination = config.modules.amdDestination

        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @nameCleaner = config.modules.nameCleaner
        @options = _.extend {}, config.plugins?.amd
        if @options.jshint
            @jshinter = new JsHinter config

    compile: (params, next)->
        self = @
        {data, path, map} = params

        self.paths = self.paths or builder.getConfig().paths

        checkMethod path, data, (err, res)->
            umdData = comData = data
            if res
                {name, $inject, locals, head, body} = res
                switch name
                    when 'factory'
                        umdData = umdWrapper data, self.options
                        comData = comWrapper data, self.options
                    when 'ngmodule'
                        modulePath = self.nameCleaner path
                        data = ngModuleFactoryProxy modulePath, head, body
                        umdData = umdWrapper data, self.options
                        comData = comWrapper data, self.options
                    else
                        modulePath = self.nameCleaner path
                        data = factoryProxy self, modulePath, name, locals, head, body
                        umdData = umdWrapper data, self.options
                        comData = comWrapper data, self.options

            done = ->
                next null, {data: comData, path, map}
                return

            dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path) + '.js'

            finishCompilation = ->
                if self.optimizer
                    self.optimizer.optimize {data: umdData, path, map}, (err, res)->
                        return logger.error err if err
                        {data: optimized, path, map} = res
                        writeData optimized || umdData, dst, done
                        return
                    return

                writeData umdData, dst, done
                return

            if self.jshinter
                self.jshinter.lint {data: umdData, path, map}, (msg)->
                    logger.warn path, msg if msg
                    finishCompilation()
                    return

                return

            finishCompilation()

            return

        return
