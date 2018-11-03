{assert} = require('chai');
util = require 'util'
ensureAmdName = require '../../src/ensure-amd-name'

describe 'requirejs definition name', ->

    it 'should add module name of plain define', ->
        actual = ensureAmdName """
        // comment
        define(['dep'], function(){});
        """, 'moduleName'

        expected = """
        // comment
        define('moduleName', ['dep'], function(){});
        """
        assert.strictEqual actual, expected
        return

    it 'should add module name of nested define', ->
        actual = ensureAmdName """
        (function() {
            'use strict';
            define(['dep'], function(){});
        }());
        """, 'moduleName'

        expected = """
        (function() {
            'use strict';
            define('moduleName', ['dep'], function(){});
        }());
        """
        assert.strictEqual actual, expected
        return

    it 'should leave module name of plain define', ->
        actual = ensureAmdName """
        // comment
        define('moduleName', ['dep'], function(){});
        """, 'anotherName'

        expected = """
        // comment
        define('moduleName', ['dep'], function(){});
        """
        assert.strictEqual actual, expected
        return

    it 'should leave module name of nested define', ->
        actual = ensureAmdName """
        (function() {
            'use strict';
            define('moduleName', ['dep'], function(){});
        }());
        """, 'anotherName'

        expected = """
        (function() {
            'use strict';
            define('moduleName', ['dep'], function(){});
        }());
        """

        assert.strictEqual actual, expected
        return

    it 'should support various writing style', ->
        actual = ensureAmdName """
        /*!
         * jQuery UI Autocomplete 1.11.4
         * http://jqueryui.com
         *
         * Copyright jQuery Foundation and other contributors
         * Released under the MIT license.
         * http://jquery.org/license
         *
         * http://api.jqueryui.com/autocomplete/
         */
        (function( factory ) {
            if ( typeof define === "function" && define.amd ) {

                // AMD. Register as an anonymous module.
                define([
                    "jquery",
                    "./core",
                    "./widget",
                    "./position",
                    "./menu"
                ], factory );
            } else {

                // Browser globals
                factory( jQuery );
            }
        }(function() {}));
        """, 'jquery.ui.autocomplete'

        expected = """
        /*!
         * jQuery UI Autocomplete 1.11.4
         * http://jqueryui.com
         *
         * Copyright jQuery Foundation and other contributors
         * Released under the MIT license.
         * http://jquery.org/license
         *
         * http://api.jqueryui.com/autocomplete/
         */
        (function( factory ) {
            if ( typeof define === "function" && define.amd ) {

                // AMD. Register as an anonymous module.
                define('jquery.ui.autocomplete', [
                    "jquery",
                    "./core",
                    "./widget",
                    "./position",
                    "./menu"
                ], factory );
            } else {

                // Browser globals
                factory( jQuery );
            }
        }(function() {}));
        """

        assert.strictEqual actual, expected

    it 'should support depsLoader define', ->
        actual = ensureAmdName """
        (function(require, global) {
            var deps = [];

            function factory() {}

            if (typeof process === 'object' && typeof process.platform !== 'undefined') {
                // NodeJs
                module.exports = depsLoader.common.call(this, require, 'node', deps, factory);
            } else if (typeof define === 'function' && define.amd) {
                // AMD
                depsLoader.amd(deps, factory, global);
            }
        }(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));
        """, 'Controller'

        expected = """
        (function(require, global) {
            var deps = [];

            function factory() {}

            if (typeof process === 'object' && typeof process.platform !== 'undefined') {
                // NodeJs
                module.exports = depsLoader.common.call(this, require, 'node', deps, factory);
            } else if (typeof define === 'function' && define.amd) {
                // AMD
                depsLoader.amd('Controller', deps, factory, global);
            }
        }(require, typeof window !== 'undefined' && window === window.window ? window : typeof global !== 'undefined' ? global : null));
        """

        assert.strictEqual actual, expected
        return

    return
