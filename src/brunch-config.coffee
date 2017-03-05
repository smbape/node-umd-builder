log4js = require '../log4js'
logger = log4js.getLogger 'brunch-config'

util = require 'util'
sysPath = require 'path'
builder = require './builder'
read = require '../utils/read-components'
matcher = require './glob-matcher'
hasProp = Object::hasOwnProperty

cache = {}

exports.logger = logger
exports.matcher = matcher
exports.isVendor = new RegExp matcher(['bower_components', 'components', 'vendor']).source + /[/\\]/.source

moduleSources = ['app/node_modules', 'bower_components', 'components']
pathCleaner = new RegExp matcher(moduleSources).source + /[/\\](.*)$/.source

# https://github.com/brunch/brunch/blob/2.7.4/docs/config.md
config = exports.config =
    # npm.enabled = true makes any folder named 'node_modules' in app to be treated as an npm package
    # .i.e expecting a package.json
    npm: enabled: false

    compilers: [
        require('./compilers/amd')          # Mandatory. Transform files with a top level factory or freact function in umd modules
        require('./compilers/copy')         # Recommended. copy all watched files that do not match a compiler
        require('./compilers/relativecss')  # Recommended. keep correct path in css. ex: bootstrap
    ]

    modules:
        pathCleaner: pathCleaner

        nameCleaner: (path, ext = false)->
            if not config.conventions.vendor path
                path = path.replace(config.modules.pathCleaner, '$1')

            path = path.replace(/[\\]/g, '/')
            if ext then path else path.replace(/\.[^.]*$/, '')

        amdDestination: (path, ext = false)->
            if not config.conventions.vendor path
                path = path.replace(config.modules.pathCleaner, 'node_modules/$1')

            path = path.replace(/[\\]/g, '/')
            if ext then path else path.replace(/\.[^.]*$/, '')

        wrapper: (moduleName, data, isVendor) ->
            if isVendor
                logger.debug "Not wrapping '#{moduleName}', is vendor file"
                data
            else
                logger.debug "commonJs wrapping for '#{moduleName}'"
                """
                require.define({"#{moduleName}": function(exports, require, module) {
                    #{data}
                }});\n
                """

    paths:
        watched: ['app', 'vendor']  # only build files in app/ and vendor/

    files:
        javascripts:
            joinTo:
                'javascripts/app.js': matcher ['app/node_modules/']
                'javascripts/vendor.js': exports.isVendor

        stylesheets:
            joinTo:
                'stylesheets/app.css': matcher ['app/node_modules/', 'bower_components/', 'components/', 'vendor/'], ['app/node_modules/**/variables.styl$']

        templates:
            joinTo: 'javascripts/app.js'

    plugins:
        amd:
            strict: true
            jshint: false
            eslint: false
            package: false
            tplOpts:
                karma:
                    pattern: /-test\.js$/
        coffeescript:
            bare: true
        eslint:
            warnOnly: true
        jshint:
            warnOnly: true
        jst:
            # _.template uses with when no variable is given. Since with is not recommended on MDN, I prefer not to use it
            # https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with
            variable: 'root'
            ignore: /<%--([\s\S]+?)--%>/g # added for comments within templates
            escape: /<%-([\s\S]+?)%>/g # default value
            interpolate: /<%=([\s\S]+?)%>/g # default value
            evaluate: /<%([\s\S]+?)%>/g # default value
            strict: true

    initialize: (config, done)->
        read sysPath.resolve(config.paths.root), 'bower', (err, components)->
            throw err if err
            for component in components
                cache[sysPath.join('bower_components', component.name)] = !component.umd
            done()
            return
        return

    onwatch: (fswatcher, bwatcher)->
        builder.fswatcher = fswatcher
        builder.bwatcher = bwatcher
        return

    # watcher:
    #     ignored: (path)-> /[\\/]\.(?![\\/.])/.test(path)
    #     usePolling: false

    conventions:
        ignored: [
            /[\\/]\.(?![\\/.])/
            /[\\/]_/
            /(?!^|[\\/])bower\.json/
            /(?!^|[\\/])component\.json/
            /(?!^|[\\/])package\.json/
            /(?!^|[\\/])vendor[\\/](?:node|j?ruby-.*|bundle)[\\/]/
        ]
        vendor: (path)->
            if hasProp.call(cache, path)
                return cache[path]

            res = cache[path] = exports.isVendor.test path
            return res if not res

            if m = /^bower_components[\/\\]([^\/\\]+)/.exec(path)
                folder = sysPath.join('bower_components', m[1])
                if hasProp.call(cache, folder)
                    return cache[path] = cache[folder]

            return res

    overrides:
        production:
            conventions:
                ignored: [
                    /[\\/]\.(?![\\/.])/
                    /[\\/]_/
                    /(?!^|[\\/])bower\.json/
                    /(?!^|[\\/])component\.json/
                    /(?!^|[\\/])package\.json/
                    /(?!^|[\\/])vendor[\\/](?:node|j?ruby-.*|bundle)[\\/]/
                    /\btest\b/
                ]
