"use strict";

module.exports = template;

const extendWith = require("lodash/extendWith");
const keys = require("lodash/keys");
const attempt = require("lodash/attempt");
const isError = require("lodash/isError");
const isObject = require("lodash/isObject");
const isArrayLike = require("lodash/isArrayLike");
const templateSettings = require("lodash/templateSettings");

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
const MAX_SAFE_INTEGER = 9007199254740991;

/** Used to match empty string literals in compiled template source. */
const reEmptyStringLeading = /\b__p \+= '';/g;
const reEmptyStringMiddle = /\b(__p \+=) '' \+/g;
const reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

/** Used to match template delimiters. */
const reIgnore = /<%--([\s\S]+?)--%>/g;
// const reEscape = /<%-([\s\S]+?)%>/g;
// const reEvaluate = /<%([\s\S]+?)%>/g;
const reInterpolate = /<%=([\s\S]+?)%>/g;

/** Used to match [ES template delimiters](http://ecma-international.org/ecma-262/6.0/#sec-template-literal-lexical-components). */
const reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

/** Used to detect unsigned integer values. */
const reIsUint = /^\d+$/;

/** Used to ensure capturing order of template delimiters. */
const reNoMatch = /($^)/;

/** Used to match unescaped characters in compiled string literals. */
const reUnescapedString = /['\n\r\u2028\u2029\\]/g;

/** Used to make template sourceURLs easier to identify. */
let templateCounter = -1;

/** Used to escape characters for inclusion in compiled string literals. */
const stringEscapes = {
    "\\": "\\",
    "'": "'",
    "\n": "n",
    "\r": "r",
    "\u2028": "u2028",
    "\u2029": "u2029"
};

/**
 * A specialized version of `_.map` for arrays without support for callback
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
    let index = -1;
    const length = array.length;
    const result = Array(length);

    while (++index < length) {
        result[index] = iteratee(array[index], index, array);
    }
    return result;
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` or `undefined` values.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
    return value == null ? "" : String(value);
}

/**
 * The base implementation of `_.values` and `_.valuesIn` which creates an
 * array of `object` property values corresponding to the property names
 * of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the array of property values.
 */
function baseValues(object, props) {
    return arrayMap(props, function(key) {
        return object[key];
    });
}

/**
 * Used by `_.template` to escape characters for inclusion in compiled string literals.
 *
 * @private
 * @param {string} chr The matched character to escape.
 * @returns {string} Returns the escaped character.
 */
function escapeStringChar(chr) {
    return "\\" + stringEscapes[chr];
}

/**
 * Used by `_.defaults` to customize its `_.assign` use.
 *
 * @private
 * @param {*} objValue The destination object property value.
 * @param {*} srcValue The source object property value.
 * @returns {*} Returns the value to assign to the destination object.
 */
function extendDefaults(objValue, srcValue) {
    return objValue === undefined ? srcValue : objValue;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
    value = typeof value === "number" || reIsUint.test(value) ? Number(value) : -1;
    length = length == null ? MAX_SAFE_INTEGER : length;
    return value > -1 && value % 1 === 0 && value < length;
}

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
    if (!isObject(object)) {
        return false;
    }
    const type = typeof index;
    if (type === "number" ? isArrayLike(object) && isIndex(index, object.length) : type === "string" && index in object) {
        const other = object[index];
        // eslint-disable-next-line no-self-compare
        return value === value ? value === other : other !== other;
    }
    return false;
}

/**
 * Creates a compiled template function that can interpolate data properties
 * in "interpolate" delimiters, HTML-escape interpolated data properties in
 * "escape" delimiters, and execute JavaScript in "evaluate" delimiters. Data
 * properties may be accessed as free variables in the template. If a setting
 * object is provided it takes precedence over `_.templateSettings` values.
 *
 * **Note:** In the development build `_.template` utilizes
 * [sourceURLs](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
 * for easier debugging.
 *
 * For more information on precompiling templates see
 * [lodash's custom builds documentation](https://lodash.com/custom-builds).
 *
 * For more information on Chrome extension sandboxes see
 * [Chrome's extensions documentation](https://developer.chrome.com/extensions/sandboxingEval).
 *
 * @static
 * @memberOf _
 * @category String
 * @param {string} [string=''] The template string.
 * @param {Object} [options] The options object.
 * @param {RegExp} [options.escape] The HTML "escape" delimiter.
 * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
 * @param {Object} [options.imports] An object to import into the template as free variables.
 * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
 * @param {string} [options.sourceURL] The sourceURL of the template's compiled source.
 * @param {string} [options.variable] The data object variable name.
 * @param- {Object} [otherOptions] Enables the legacy `options` param signature.
 * @returns {Function} Returns the compiled template function.
 * @example
 *
 * // using the "interpolate" delimiter to create a compiled template
 * let compiled = _.template('hello <%= user %>!');
 * compiled({ 'user': 'fred' });
 * // => 'hello fred!'
 *
 * // using the HTML "escape" delimiter to escape data property values
 * let compiled = _.template('<b><%- value %></b>');
 * compiled({ 'value': '<script>' });
 * // => '<b>&lt;script&gt;</b>'
 *
 * // using the "evaluate" delimiter to execute JavaScript and generate HTML
 * let compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
 * compiled({ 'users': ['fred', 'barney'] });
 * // => '<li>fred</li><li>barney</li>'
 *
 * // using the internal `print` function in "evaluate" delimiters
 * let compiled = _.template('<% print("hello " + user); %>!');
 * compiled({ 'user': 'barney' });
 * // => 'hello barney!'
 *
 * // using the ES delimiter as an alternative to the default "interpolate" delimiter
 * let compiled = _.template('hello ${ user }!');
 * compiled({ 'user': 'pebbles' });
 * // => 'hello pebbles!'
 *
 * // using custom template delimiters
 * _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
 * let compiled = _.template('hello {{ user }}!');
 * compiled({ 'user': 'mustache' });
 * // => 'hello mustache!'
 *
 * // using backslashes to treat delimiters as plain text
 * let compiled = _.template('<%= "\\<%- value %\\>" %>');
 * compiled({ 'value': 'ignored' });
 * // => '<%- value %>'
 *
 * // using the `imports` option to import `jQuery` as `jq`
 * let text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
 * let compiled = _.template(text, { 'imports': { 'jq': jQuery } });
 * compiled({ 'users': ['fred', 'barney'] });
 * // => '<li>fred</li><li>barney</li>'
 *
 * // using the `sourceURL` option to specify a custom sourceURL for the template
 * let compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
 * compiled(data);
 * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
 *
 * // using the `variable` option to ensure a with-statement isn't used in the compiled template
 * let compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
 * compiled.source;
 * // => function(data) {
 * //   var __t, __p = [];
 * //   __p[__p.length] = 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
 * //   return __p;
 * // }
 *
 * // using the `source` property to inline compiled templates for meaningful
 * // line numbers in error messages and a stack trace
 * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
 *   let JST = {\
 *     "main": ' + _.template(mainText).source + '\
 *   };\
 * ');
 */
function template(string, options, otherOptions) {
    // Based on John Resig's `tmpl` implementation (http://ejohn.org/blog/javascript-micro-templating/)
    // and Laura Doktorova's doT.js (https://github.com/olado/doT).
    const settings = templateSettings;

    if (otherOptions && isIterateeCall(string, options, otherOptions)) {
        options = otherOptions = undefined;
    }
    string = baseToString(string);
    options = extendWith({
        ignore: reIgnore
    }, otherOptions || options, settings, extendDefaults);

    const imports = extendWith({}, options.imports, settings.imports, extendDefaults);
    const importsKeys = keys(imports);
    const importsValues = baseValues(imports, importsKeys);

    let isEscaping, isEvaluating;
    let index = 0;
    const interpolate = options.interpolate || reNoMatch;
    let source = ["__p[__p.length] = '"];

    // Compile the regexp to match each delimiter.
    const reDelimiters = RegExp(
        (options.ignore || reNoMatch).source + "|" +
        (options.escape || reNoMatch).source + "|" +
        interpolate.source + "|" +
        (options.esInterpolate !== false && interpolate.source === reInterpolate.source ? reEsTemplate : reNoMatch).source + "|" +
        (options.evaluate || reNoMatch).source + "|$", "g");

    // Use a sourceURL for easier debugging.
    const sourceURL = "//# sourceURL=" +
        ("sourceURL" in options ? options.sourceURL : "lodash.templateSources[" + ++templateCounter + "]") + "\n";

    string.replace(reDelimiters, function(match, ignoreValue, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        if (!interpolateValue) {
            interpolateValue = esTemplateValue;
        }

        // Escape characters that can't be included in string literals.
        source.push(string.slice(index, offset).replace(reUnescapedString, escapeStringChar));

        if (!ignoreValue) {
            // Replace delimiters with snippets.
            if (escapeValue) {
                isEscaping = true;
                source.push("' +\n__e(" + escapeValue + ") +\n'");
            }
            if (evaluateValue) {
                isEvaluating = true;
                source.push("';\n" + evaluateValue + ";\n__p[__p.length] = '");
            }
            if (interpolateValue) {
                source.push("' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'");
            }
        }

        index = offset + match.length;

        // The JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value.
        return match;
    });

    source.push("';\n");
    source = source.join("");

    // If `variable` is not specified wrap a with-statement around the generated
    // code to add the data object to the top of the scope chain.
    let variable = options.variable;
    if (variable == null) {
        source = "with (obj) {\n" + source + "\n}\n";
        variable = "obj";
    }
    // Cleanup code by stripping empty strings.
    source = isEvaluating ? source.replace(reEmptyStringLeading, "") : source;
    source = source.replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");

    // Frame code as the function body.
    const declaration = options.async ? "async function" : "function";
    source = declaration + "(" + variable + ") {\n" +
        "if (" + variable + " == null) { " + variable + " = {}; }\n" +
        "var __t, __p = []" +
        (isEscaping ? ", __e = _.escape" : "") +
        (isEvaluating ? ", __j = Array.prototype.join;\n" +
        "function print() { __p[__p.length] = __j.call(arguments, '') }\n" : ";\n"
        ) +
        source +
        "return __p.join(\"\")\n};";

    const result = attempt(function() {
        // eslint-disable-next-line no-new-func
        return Function(importsKeys, sourceURL + "return " + source).apply(undefined, importsValues);
    });

    // Provide the compiled function's source by its `toString` method or
    // the `source` property as a convenience for inlining compiled templates.
    result.source = source;
    if (isError(result)) {
        throw result;
    }
    return result;
}