# log4js = global.log4js || (global.log4js = require('log4js'))
# logger = log4js.getLogger 'EsLinter'

sysPath = require('path')
anymatch = require('anymatch')
minimatch = require('minimatch')

clone = require("lodash/clone")
each = require("lodash/each")
merge = require("lodash/merge")

Module = require("module")

resolve = (name, directory)->
    relativeMod = new Module()
    filename = sysPath.join(directory, ".eslintrc")
    relativeMod.id = filename
    relativeMod.filename = filename
    relativeMod.paths = Module._nodeModulePaths(directory).concat Module._nodeModulePaths(__dirname)

    try
        return Module._resolveFilename(name, relativeMod)
    catch
        return null

module.exports = class EsLinter
    brunchPlugin: false
    type: 'javascript'
    extension: 'js'

    constructor: (config)->
        cfg = config?.plugins?.eslint ? config?.eslint ? {}
        { @warnOnly, @overrides, ignore, config, pattern } = cfg
        options = clone(config)

        if ignore
            @isIgnored = anymatch(ignore)
        else if config.conventions and config.conventions.vendor
            @isIgnored = config.conventions.vendor
        else
            @isIgnored = anymatch(/^(?:bower_components|vendor)[/\\]/)

        if pattern
            @pattern = anymatch(pattern)

        @options = options
        @CLIEngine = require(resolve('eslint', process.cwd())).CLIEngine

    lint: (params, done)->
        {data, path} = params

        # check if it is a file to lint
        if @isIgnored(path)
            done()
            return

        if @pattern and not @pattern(path)
            done()
            return

        config = @options
        if "function" is typeof config
            config = config(params)

        if @overrides
            config = clone @options
            each @overrides, (options, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    if "function" is typeof options
                        options = options(params)
                    merge config, options
                return

        CLIEngine = @CLIEngine

        linter = new CLIEngine(config)
        report = linter.executeOnText(data, path)

        if report.errorCount is 0 and report.warningCount is 0
            done(null, report.results[0]?.output)
            return

        formatter = CLIEngine.getFormatter()
        msg = 'ESLint reported:\n' + formatter(report.results)

        if @warnOnly
            msg = "warn: #{msg}"

        done(msg, report.results[0]?.output)
        return

EsLinter.brunchPluginName = 'eslinter-brunch'