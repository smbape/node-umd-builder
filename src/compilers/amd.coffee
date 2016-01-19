log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'AmdCompiler'

sysPath = require 'path'
_ = require 'lodash'
UglifyJSOptimizer = require 'uglify-js-brunch'
anymatch = require 'anymatch'
JsHinter = require './jshinter'

builder = require '../builder'
writeData = require '../writeData'
methodParser = require('../../utils/method-parser')
parse = methodParser.parse
NG_PREFIX = methodParser.NG_PREFIX

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
            module.exports = depsLoader.common.call(this, require, 'node', deps, factory);
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
    deps.unshift({amd: 'react', common: '!React'}, {amd: 'bundle-react-0', common: '!ReactDOM'});
    
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

        @config = _.clone config
        @amdDestination = config.modules.amdDestination

        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @nameCleaner = config.modules.nameCleaner
        @options = _.extend {}, config.plugins?.amd
        if @options.jshint
            @jshinter = new JsHinter config
        @isIgnored = if @options.ignore then anymatch(@options.ignore) else if config.conventions and config.conventions.vendor then config.conventions.vendor else anymatch(/^(bower_components|vendor)/)

    compile: (params, next)->
        self = @
        {data, path, map} = params

        self.paths = self.paths or builder.getConfig().paths

        umdData = comData = data
        
        if not @isIgnored params.path
            [locals, name, args, head, declaration, body] = res = parse data

            if name
                modulePath = self.nameCleaner path
                switch name
                    when 'factory'
                        if 'require' isnt args[0]
                            args.unshift 'require'
                            data = "#{head}#{declaration}#{args.join(', ')}#{body}"
                    when 'freact'
                        data = reactFactoryProxy modulePath, head, declaration, args, body
                    when 'ngmodule'
                        data = ngModuleFactoryProxy modulePath, head, "#{declaration}#{args.join(', ')}#{body}"
                    else
                        if name in methodParser.NG_FNS
                            data = ngFactoryProxy self, modulePath, name, locals, head, "#{declaration}#{args.join(', ')}#{body}"

                umdData = umdWrapper data, self.options, modulePath
                comData = comWrapper data, self.options

        done = ->
            next null, {data: comData, path}
            return

        dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path) + '.js'

        finishCompilation = ->
            if self.optimizer
                self.optimizer.optimize {data: umdData, path}, (err, res)->
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
