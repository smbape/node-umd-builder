_ = require 'lodash'

util = require 'util'
_.template = require('../../src/compilers/jst/template')
fs = require 'fs'
methodParser = require('../../utils/method-parser')
parse = methodParser.parse
_.template fs.readFileSync(__dirname + '/../stuff/step4.html').toString(),
    ignore: /\{\{--([\s\S]+?)--\}\}/g
    escape: /\{\{-([\s\S]+?)\}\}/g
    interpolate: /\{\{=([\s\S]+?)\}\}/g
    evaluate: /\{\{([\s\S]+?)\}\}/g

assert.equals = (actual, expected)->
    assert _.isEqual(actual, expected), "expected #{util.inspect actual} to equal #{util.inspect expected}"
    return

describe 'method-parser', ->
    NG_FNS = [
        'usable'
        'run'
        'config'
        'module'
        'factory'
        'filter'
        'directive'
        'controller'
        'service'
        'value'
        'constant'
        'decorator'
        'provider'
    ].map((element) ->
        'ng' + element
    )
    OTHER_FNS = [
        'factory'
        'freact'
    ]

    ALL_FNS = OTHER_FNS.concat(NG_FNS)

    it 'should parse empty', ->
        str = ''
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined
        return

    it 'should parse locals', ->
        str = '/* locals = a, b, c */'
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, 'a, b, c'
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined
        return

    it 'should parse hoisted function', ->
        for fn in ALL_FNS
            str = "function #{fn}() {}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, []
        return

    it 'should parse hoisted function with args', ->
        for fn in ALL_FNS
            str = "function #{fn}(a, b, c) {}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['a', 'b', 'c']
        return

    it 'should parse variable function', ->
        for fn in ALL_FNS
            str = "#{fn} = function() {}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, []
        return

    it 'should parse variable function with args', ->
        for fn in ALL_FNS
            str = "#{fn} = function (a, b, c) {}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['a', 'b', 'c']
        return

    it 'should avoid scoped', ->
        str = '{/* locals = a, b, c */}'
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        str = "(a, function factory{/&/g,\n'&amp;'};)"
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        str = '{/* locals = a, b, c */}/* locals = c, d, b */'
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, 'c, d, b'
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        for fn in ALL_FNS
            str = "{function factory(a, b, c) {}} function #{fn}(c, d, b){}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']
        return

    it 'should take first declared function', ->
        for fn in ALL_FNS
            str = "function #{fn}(c, d, b){} {function factory(a, b, c) {}} function ngmodule(c, d, b){}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']
        return

    it 'should skip comments', ->
        for fn in ALL_FNS

            str = "//function ngfactory(c, d, b){} {function factory(a, b, c) {}} \nfunction #{fn}(c, d, b){}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

            str = "/* function ngfactory(c, d, b){} {function factory(a, b, c) {}} */function #{fn}(c, d, b){}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

            str = "/* function ngfactory(c, d, b){} {function factory(a, b, c) {}} */function #{fn}(c/* fido */, d, b){}"
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

        return

    it 'should not parse locals after declaration', ->
        for fn in ALL_FNS

            str = """
            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

        return

    it 'should omit esacpe char', ->
        for fn in ALL_FNS

            str = """
            "fdff\\"";
            'fdff\\'';
            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

    it 'should omit quote', ->
        for fn in ALL_FNS

            str = """
            ; // we're done!
            /'|\\\\/g;
            '/* locals = a, b, c */'
            /'|\\\\/g;
            "/* locals = a, b, c */";
            /function ngmodule(){}/;

            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            [locals, name, args, head, declaration, body] = parse(str)
            assert.strictEqual locals, undefined
            assert.strictEqual name, fn
            assert.equals args, ['c', 'd', 'b']

        return

    it 'should parse various files', ->
        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/angular-sanitize.js').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/jquery.js').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/lodash.core.js').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/lodash.core.min.js').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/respond.src.js').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/step4.html').toString()
        assert.strictEqual locals, undefined
        assert.strictEqual name, undefined
        assert.strictEqual args, undefined

        [locals, name, args, head, declaration, body] = parse fs.readFileSync(__dirname + '/../stuff/HomeController.js').toString()
        assert.strictEqual locals, 'AbstractController'
        assert.strictEqual name, 'ngcontroller'
        assert.equals args, []
        return

    it 'should parse freact', ->
        str = """
        function freact() {
            var CommentBox = React.createClass({
                displayName: "CommentBox",

                render: function () {
                    return React.createElement(
                        "div",
                        { className: "commentBox" },
                        "Hello, world!I am a CommentBox. "
                    );
                }
            });
            ReactDOM.render(React.createElement(CommentBox, null), document.getElementById('content'));
        }
        """
        [locals, name, args, head, declaration, body] = parse(str)
        assert.strictEqual locals, undefined
        assert.strictEqual name, 'freact'
        assert.equals args, []
        return

    it 'should add arguments', ->
        str = """
        var deps, factory,
          hasProp = {}.hasOwnProperty;

        deps = ['umd-core/src/views/BackboneView'];

        factory = function (BackboneView) {
            return Tutorial1View;

          })(BackboneView);
        };
        """
        [locals, name, args, head, declaration, body] = parse(str)
        args.unshift 'require'
        actual = "#{head}#{declaration}#{args.join(', ')}#{body}"

        expected = """
        var deps, factory,
          hasProp = {}.hasOwnProperty;

        deps = ['umd-core/src/views/BackboneView'];

        factory = function (require, BackboneView) {
            return Tutorial1View;

          })(BackboneView);
        };
        """

        assert.strictEqual actual, expected

        return
