log4js = require '../log4js'
logger = log4js.getLogger 'brunch-config'

util = require 'util'
sysPath = require 'path'
builder = require './builder'
read = require '../utils/read-components'
hasOwn = Object::hasOwnProperty

cache = {}

# Light glob to regexp
processSpecial = do ->
    sep = '[\\/\\\\]' # separation
    nsep = '[^\\/\\\\]' # not separation
    mnsep = nsep + '*' # multiple not separation
    star = '\\*' # star
    mstar = '\\*{2,}' # multiple star
    specialPattern = new RegExp '(?:' + [
        # 1.1 # /**$ => /**: everything
        # 1.2 # ioio/**$ => /**: everything
        '(' + sep + mstar + '$)'

        # 2 # ouiuo/**/iuuo => /**/?: sep, (everything, sep) or nothing
        '(' + sep + mstar + sep + ')'

        # 3 # ioio/**fodpo => /**: sep, everything
        '(' + sep + mstar + ')'

        # 4.1 # **/$ => **/: everything, sep
        # 4.2 # **/iofid => **/: everything, sep
        # 4.3 # fiodu**/iofid => **/: everything, sep
        '(' + mstar + sep + ')'

        # 5.1 # ** => **: everything
        # 5.2 # iido** => **: everything
        # 5.3 # **opoio => **: everything
        '(' + mstar + ')'

        # 6 # ouiuo/*/iuuo => /*/: sep, (mnsep, sep) or nothing
        '(' + sep + star + sep + ')'

        '(' + [
            # 7.1 # /* => /*$: mnsep
            # 7.2 # ioio/* => /*$: mnsep
            sep + star + '$'

            # 7.3 # */ => */$: mnsep
            star + sep + '$'

            # 7.4 # ioio/*fodpo => *: mnsep
            # 7.5 # fiodu*/iofid => *: mnsep
            # 7.6 # iido* => *: mnsep
            # 7.7 # *opoio => *: mnsep
            # 7.8 # */iofid => *: mnsep
            # 7.9 # * => *: mnsep
            star
        ].join('|') + ')'

        # 8 # http://www.regular-expressions.info/characters.html#special
        '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])'

    ].join('|') + ')', 'g'

    map =
        # keep special meaning
        '|': '|'
        '$': '$'

        # ignore OS specific path sep
        '/': sep
        '\\': sep

    (str)->
        str.replace specialPattern, (match)->
            if arguments[1] or arguments[5]
                # everything
                return '.*?'

            if arguments[2]
                # sep, (everything, sep) or nothing
                return sep + '(?:.*?' + sep + '|)'

            if arguments[3]
                # sep, everything
                return sep + '.*?'

            if arguments[4]
                # everything, sep
                return '.*?' + sep

            if arguments[6]
                # sep, (mnsep, sep) or nothing
                return sep + '(?:' + mnsep + sep + '|)'

            if arguments[7]
                # mnsep
                return mnsep

            map[match] or '\\' + match

matcher = (include, exclude) ->

    if Array.isArray include
        include = processSpecial include.join('|')
    else if 'string' is typeof include
        include = processSpecial include
    else
        include = ''

    if Array.isArray exclude
        exclude = processSpecial exclude.join('|')
    else if 'string' is typeof exclude
        exclude = processSpecial exclude
    else
        exclude = ''

    if include.length is 0 and exclude.length is 0
        /(?!^)^/ # never matches, similar to true === false
    else if exclude.length is 0
        new RegExp '^(?:' + include + ')'
    else if include.length is 0
        new RegExp '^(?!' + exclude + ')'
    else
        new RegExp '^(?!' + exclude + ')(?:' + include + ')'

exports.logger = logger
exports.matcher = matcher
exports.isVendor = matcher ['bower_components/', 'components/', 'vendor/']

# https://github.com/brunch/brunch/blob/1.8.5/docs/config.md
config = exports.config =

    # TODO : take from compilers
    # in brunch 1.8.x, compilers are not publicly available
    # used by builder to know what are the js files
    jsExtensions: /\.(?:js|hbs|handlebars|markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text|coffee(?:\.md)?|litcoffee)$/

    # add some compilers
    # amd and copy are required for any project
    compilers: [
        require('./compilers/amd')
        require('./compilers/copy')
        require('./compilers/esprima')
        require('./compilers/relativecss')
        require('./compilers/stylus')
    ]

    # TODO : take from compilers
    # in brunch 1.8.x, compilers are not publicly available
    # used by builder to know what are the js files
    # jsExtensions: /\.(?:js|hbs|handlebars|markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text|coffee(?:\.md)?|litcoffee)$/

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

    files:
        javascripts:
            joinTo:
                'javascripts/app.js': matcher ['app/node_modules/']
                'javascripts/vendor.js': matcher ['bower_components/', 'components/', 'vendor/'], ['vendor/html5shiv.js$', 'vendor/require.js$', 'vendor/modernizr-custom.js$', 'vendor/respond.src.js$']

        stylesheets:
            joinTo:
                'stylesheets/app.css': matcher ['app/node_modules/', 'bower_components/', 'components/', 'vendor/'], ['app/node_modules/**/variables.styl$']

        templates:
            joinTo: 'javascripts/app.js'

    plugins:
        amd:
            strict: true
            jshint: true
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
        builder.buildBower config, ->
            read config.paths.root, 'bower', (err, components)->
                throw err if err
                for component in components
                    cache[sysPath.join('bower_components', component.name)] = !component.umd
                done()
                return
            return
        return

    onwatch: (watcher)->
        builder.buildClient {watcher}
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
