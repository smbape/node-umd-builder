log4js = require '../log4js'
logger = log4js.getLogger 'brunch-config'

util = require 'util'
sysPath = require 'path'
builder = require './builder'
read = require '../utils/read-components'
matcher = require './glob-matcher'
hasOwn = Object::hasOwnProperty

cache = {}

exports.logger = logger
exports.matcher = matcher
exports.isVendor = matcher ['bower_components/', 'components/', 'vendor/']

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
        nameCleaner: (path, ext = false)->
            if not config.conventions.vendor path
                path = path.replace(/^(?:app[\/\\]node_modules|bower_components|components)[\/\\](.*)$/, '$1')

            path = path.replace(/[\\]/g, '/')
            if ext then path else path.replace(/\.[^.]*$/, '')

        amdDestination: (path, ext = false)->
            if not config.conventions.vendor path
                path = path.replace(/^(?:app[\/\\]node_modules|bower_components|components)[\/\\](.*)$/, 'node_modules/$1')

            path = path.replace(/[\\]/g, '/')
            if ext then path else path.replace(/\.[^.]*$/, '')

        wrapper: (path, data, isVendor) ->
            if isVendor
                logger.debug "Not wrapping '#{path}', is vendor file"
                data
            else
                modulePath = config.modules.nameCleaner path

                logger.debug "commonJs wrapping for '#{path}'"
                """
                require.define({"#{modulePath}": function(exports, require, module) {
                    #{data}
                }});\n
                """

    paths:
        watched: ['app', 'vendor']  # only build files in app/ and vendor/

    files:
        javascripts:
            joinTo:
                'javascripts/app.js': matcher ['app/node_modules/']
                'javascripts/vendor.js': matcher ['bower_components/', 'components/', 'vendor/']

        stylesheets:
            joinTo:
                'stylesheets/app.css': matcher ['app/node_modules/', 'bower_components/', 'components/', 'vendor/'], ['app/node_modules/**/variables.styl$']

        templates:
            joinTo: 'javascripts/app.js'

    plugins:
        amd:
            strict: true
            jshint: true
            package: false
        coffeescript:
            bare: true
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

    conventions:
        ignored: [
            /[\\/]\./
            /[\\/]_/
            /bower.json/
            /component.json/
            /package.json/
            /vendor[\\/](?:node|j?ruby-.*|bundle)[\\/]/
        ]
        vendor: (path)->
            if hasOwn.call cache, path
                return cache[path]

            res = cache[path] = exports.isVendor.test path
            return res if not res

            if m = /^bower_components[\/\\]([^\/\\]+)/.exec(path)
                folder = sysPath.join('bower_components', m[1])
                if hasOwn.call cache, folder
                    return cache[path] = cache[folder]

            return res

    overrides:
        production:
            conventions:
                ignored: [
                    /[\\/]\./
                    /[\\/]_/
                    /bower.json/
                    /component.json/
                    /package.json/
                    /vendor[\\/](?:node|j?ruby-.*|bundle)[\\/]/
                    /\btest\b/
                ]
