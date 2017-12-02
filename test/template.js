'use strict';

var fs = require("fs");
const sysPath = require("path");
const _ = global._ = require("lodash");
const lodashPath = require.resolve("lodash");
let dirname = lodashPath;
while (!global.QUnit && dirname !== sysPath.dirname(dirname)) {
    dirname = sysPath.dirname(dirname);
    try {
        global.QUnit = require(dirname + "/node_modules/qunitjs/qunit/qunit.js");
    } catch(e) {

    }
}
const QUnit = global.QUnit;

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

require(sysPath.dirname(lodashPath) + '/test/test');