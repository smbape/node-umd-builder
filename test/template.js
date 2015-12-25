'use strict';

var fs = require('fs'),
    sysPath = require('path'),
    _ = global._ = require('lodash'),
    QUnit = global.QUnit = require('lodash/node_modules/qunitjs/qunit/qunit.js');

_.template = require('../lib/compilers/jst/template');
_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g;
delete _._; // Makes last test fails

QUnit.module('lodash.sm-template');
QUnit.test('should ignore', function(assert) {
    assert.expect(1);

    var strings = ['<%-- ignore --%><%= a %>BC', '<%=a%><%-- ignore --%>BC', '<%-- ignore --%><%=\na\n%><%-- ignore --%>B<%-- ignore --%>C<%-- ignore --%>'],
        expected = _.map(strings, _.constant('ABC')),
        data = {
            'a': 'A'
        };

    var actual = _.map(strings, function(string) {
        try {
            return _.template(string)(data);
        } catch (err) {
            console.error(err);
        }
    });

    assert.deepEqual(actual, expected);
});

require('lodash/test/test');