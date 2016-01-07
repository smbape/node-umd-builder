_ = require 'lodash'

describe 'method-parser', ->
    parse = require('../../utils/method-parser').parse
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
        parsed = parse(str)
        assert.strictEqual parsed[0], undefined
        assert.strictEqual parsed[1], undefined
        assert.strictEqual parsed[2], undefined
        return

    it 'should parse locals', ->
        str = '/* locals = a, b, c */'
        parsed = parse(str)
        assert.strictEqual parsed[0], 'a, b, c'
        assert.strictEqual parsed[1], undefined
        assert.strictEqual parsed[2], undefined
        return

    it 'should parse hoisted function', ->
        for fn in ALL_FNS
            str = "function #{fn}() {}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [])
        return

    it 'should parse hoisted function with args', ->
        for fn in ALL_FNS
            str = "function #{fn}(a, b, c) {}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'a'
                'b'
                'c'
            ])
        return

    it 'should parse variable function', ->
        for fn in ALL_FNS
            str = "#{fn} = function() {}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [])
        return

    it 'should parse variable function with args', ->
        for fn in ALL_FNS
            str = "#{fn} = function (a, b, c) {}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'a'
                'b'
                'c'
            ])
        return

    it 'should avoid scoped', ->
        str = '{/* locals = a, b, c */}'
        parsed = parse(str)
        assert.strictEqual parsed[0], undefined
        assert.strictEqual parsed[1], undefined
        assert.strictEqual parsed[2], undefined

        str = '{/* locals = a, b, c */}/* locals = c, d, b */'
        parsed = parse(str)
        assert.strictEqual parsed[0], 'c, d, b'
        assert.strictEqual parsed[1], undefined
        assert.strictEqual parsed[2], undefined

        for fn in ALL_FNS
            str = "{function factory(a, b, c) {}} function #{fn}(c, d, b){}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])
        return

    it 'should take first declared function', ->
        for fn in ALL_FNS
            str = "function #{fn}(c, d, b){} {function factory(a, b, c) {}} function ngmodule(c, d, b){}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])
        return

    it 'should skip comments', ->
        for fn in ALL_FNS

            str = "//function ngfactory(c, d, b){} {function factory(a, b, c) {}} \nfunction #{fn}(c, d, b){}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

            str = "/* function ngfactory(c, d, b){} {function factory(a, b, c) {}} */function #{fn}(c, d, b){}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

            str = "/* function ngfactory(c, d, b){} {function factory(a, b, c) {}} */function #{fn}(c/* fido */, d, b){}"
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

        return

    it 'should not parse locals after declaration', ->
        for fn in ALL_FNS

            str = """
            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

        return

    it 'should omit esacpe char', ->
        for fn in ALL_FNS

            str = """
            "fdff\\"";
            "fdff\\'";
            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

    it 'should omit quote', ->
        for fn in ALL_FNS

            str = """
            ; //we're done!
            /'|\\\\/g;
            '/* locals = a, b, c */';
            /'|\\\\/g;
            "/* locals = a, b, c */";
            /function ngmodule(){}/;

            function #{fn}(c, d, b) {
                // some thing
            }
            /* locals = a, b, c */

            """
            parsed = parse(str)
            assert.strictEqual parsed[0], undefined
            assert.strictEqual parsed[1], fn
            assert.ok _.isEqual(parsed[2], [
                'c'
                'd'
                'b'
            ])

        fs = require 'fs'
        parse fs.readFileSync(__dirname + '/../angular-sanitize.js').toString()
        parse fs.readFileSync(__dirname + '/../angular-sanitize.js').toString()
        parse fs.readFileSync(__dirname + '/../jquery.js').toString()
        return

    it 'should parse not function', ->
        str = """
        deps = ['lib/AbstractController'];
        
        /* locals = AbstractController */

        ngcontroller = HomeController = (function(superClass) {
          extend(HomeController, superClass);

          function HomeController() {
            return HomeController.__super__.constructor.apply(this, arguments);
          }

          HomeController.prototype.indexAction = AbstractController.prototype.inject(['$routeParams'], function($routeParams) {
            this.innerTemplate = this.resolvePath('../templates/home/' + $routeParams.language + '/index.html');
            this.$templateUrl = this.resolvePath('../templates/home/index.html');
          });

          HomeController.prototype.aboutAction = function() {
            this.$template = 'ABOUT';
          };

          return HomeController;

        })(AbstractController);
        """
        parsed = parse(str)
        assert.strictEqual parsed[0], 'AbstractController'
        assert.strictEqual parsed[1], 'ngcontroller'
        assert.ok _.isEqual(parsed[2], [])
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
        parsed = parse(str)
        assert.strictEqual parsed[0], undefined
        assert.strictEqual parsed[1], 'freact'
        assert.ok _.isEqual(parsed[2], [])
        return

    it 'should have not method', ->
        str = """
        (function(global, factory) {
            var depsLoader;
            if (typeof exports !== 'undefined') {

                /* globals angular: false */
                depsLoader = require('umd-core/depsLoader');
                module.exports = factory(global, depsLoader, angular);
            } else if (typeof define === 'function' && define.amd) {
                define(['umd-core/depsLoader', 'angular'], function(depsLoader, angular) {
                    factory(global, depsLoader, angular);
                });
            }
        })(window, function(global, depsLoader, angular) {
            var start;
            start = function(application) {
                application.start(document.getElementsByTagName('html')[0]);
            };
            global.depsLoader = depsLoader;
            if (typeof exports !== 'undefined') {
                return start(require('application'));
            } else if (typeof define === 'function' && define.amd) {
                return require(['application'], function(application) {
                    start(application);
                });
            }
        });
        """
        parsed = parse(str)
        assert.strictEqual parsed[0], undefined
        assert.strictEqual parsed[1], undefined
        assert.ok _.isEqual(parsed[2], undefined)
        return