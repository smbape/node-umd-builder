log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'JsHinter'

JSHINT = require('jshint').JSHINT
fs = require('fs')
sysPath = require('path')
chalk = require('chalk')
pluralize = require('pluralize')
minimatch = require('minimatch')
_ = require('lodash')
mkdirp = require('mkdirp')

pad = (str, length) ->
    while str.length < length
        str = ' ' + str
    str

removeComments = (str) ->
  str.replace /\/\/[^\n\r]*|\/\*(?:(?!\*\/)[\s\S])*\*\//g, ""

module.exports = class JsHinter
    brunchPlugin: false
    type: 'javascript'
    extension: 'js'

    constructor: (config)->
        if 'jshint' of config
            console.warn "Warning: config.jshint is deprecated, please move it to config.plugins.jshint"

        cfg = config?.plugins?.jshint ? config?.jshint ? {}
        {@options, @globals, @warnOnly, @reporterOptions, @overrides} = cfg

        # pattern property is used to determine if it is also a compiler
        @jshintPattern = new RegExp(cfg.pattern ? ///^app.*$///)
        @reporter = if cfg.reporter? then require(require(cfg.reporter))

        unless @options
            filename = sysPath.join process.cwd(), ".jshintrc"

            # read settings from .jshintrc file if exists
            try
                stats = fs.statSync(filename)

                if stats.isFile()
                    buff = fs.readFileSync filename
                    @options = JSON.parse removeComments buff.toString()
                    {@globals, @overrides} = @options
                    delete @options.globals
                    delete @options.overrides
            catch e
                e = e.toString().replace "Error: ENOENT, ", ""
                console.warn ".jshintrc parsing error: #{e}. jshint will run with default options."

    lint: (params, next)->
        {data, path, map} = params

        # check if it is a file to lint
        if not @jshintPattern.test path
            return next null

        config = _.clone @options
        globals = _.clone @globals
        if @overrides
            _.each @overrides, (options, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    if options.globals
                        globals = _.extend(globals or {}, options.globals)
                        delete options.globals
                    _.extend config, options
                return

        JSHINT data, config, globals
        errors = JSHINT.errors.filter (error) -> error?
        JSHINT.errors.splice 0, JSHINT.errors.length

        if @reporter
            results = errors.map (error) ->
                error: error
                file: path

            # some reporters accept an options object as a third parameter
            # examples: jshint-stylish, jshint-summary
            @reporter.reporter results, undefined, @reporterOptions

            msg = "#{chalk.gray 'via JSHint'}"
        else
            errorMsg = for error in errors
                do (error) ->
                    if Math.max(error.evidence?.length, error.character + error.reason.length) <= 120
                        """
                        #{pad error.line.toString(), 7} | #{chalk.gray error.evidence}
                        #{pad "^", 10 + error.character} #{chalk.bold error.reason}
                        """
                    else
                        """
                        #{pad error.line.toString(), 7} | col: #{error.character} | #{chalk.bold error.reason}
                        """

            errorMsg.unshift "JSHint detected #{errors.length} #{pluralize 'problem', errors.length}:"
            errorMsg.push '\n'

            msg = errorMsg.join '\n'

        if errors.length is 0
            msg = null
        else
            msg = "warn: #{msg}" if @warnOnly
            # dst = sysPath.join(process.cwd(), 'jshint', path.replace(/.(?!js)([^.]+)$/, '.$1.js'))
            # mkdirp.sync sysPath.dirname dst
            # fs.writeFileSync dst, data

        next msg

        return