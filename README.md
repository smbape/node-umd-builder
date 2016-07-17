# umd-builder

What the f*** is that?

This library is part of a bigger project developped for the following reasons:
* Test how much [Asynchronous module definition (AMD)](http://en.wikipedia.org/wiki/Asynchronous_module_definition) is slower than [CommonJS module definition](http://requirejs.org/docs/commonjs.html) and up to which file size
* To have both module definitions without duplicating code and serve AMD files if the single page application file becomes too big
* To make debugging easier. A big javascript file is harder to debug that a small one even with source map
* To be able to reuse the same code with a [nodejs](https://nodejs.org) server
* Because I have the feeling that as the project grows, a big javascript file may become a nuisance

Even though this library can be used as a replacement of [brunch], actually it can be seen as a customized version of brunch, I am unable to write a README that shows all its features.

I should actually do some pull requests to brunch, but github is new to me. I don't know how to do a pull request. Even if I knew, I am still too shy/lazy to do it (that is not a joke).

This library build a mix of CommonJS files and AMD files.

## Project example

There is a project example in [readme/project](https://github.com/smbape/node-umd-builder/tree/master/readme/project)

Here is the project's structure

```cpp
app/
    assets/             // Files inside `assets` would be simply copied to `public` dir.
        index.jst       // Will be used to generate index.classic.html and index.single.html.
    node_modules/
        examples/       // Some files used by the application.
        initialize.js   // Application entry point.

server/
    HttpServer.js       // An http server that will
                        // serve index.classic.html when requesting /web.
                        // and serve index.single.html when requesting /app.

vendor/                 // third party libraries needed.

.babelrc                // babel configuration. Allows to parse jsx code.
.jshintrc               // Some jshint rules.

bower.json              // Describes which dependencies your client app uses.
brunch-config.coffee    // Basic assumptions about the project, like paths & outputs.
build.js                // cli for building. Usage is the same as brunch
package.json            // Describes which dependencies and Brunch plugins your app uses.
test.js                 // Example of how to use generated files in nodejs
```

From project, issue

```bash
npm install
```

Build and start the server by issueing

```bash
node build.js w -s
```

In your favourite browser, navigate to
  - [http://127.0.0.1:3330/app](http://127.0.0.1:3330/app) to see the single page version
  - [http://127.0.0.1:3330/web](http://127.0.0.1:3330/web) to see the amd version

Application can also be viewed without starting a server by opening
  - `public/index.single.html` single page version
  - `public/index.classic.html` amd version

## Universal module definition (UMD) module file

A file is considered as an UMD module file if it has a top level function name `factory` or `freact`.  
`freact` will make `React` and `ReactDOM` variables available.  
Depencies of the module must be defined in a `deps` variable.  
UMD builder will look into all files that transformed in a javascript to check if they are UMD files

```javascript
// this is app/node_modules/some/path/module.js

deps = [
    './relative',       // look for module defined in app/node_modules/some/path/relative.js
    'for-all',          // look for module defined in app/node_modules/for-all.js. In nodejs, will use the classic require
    '!global-for-all',  // look for global variable global-for-all
    {
        common: 'use-this-in-single-page-mode', // in single page, look for module defined in app/node_modules/use-this-in-single-page-mode.js
        amd: 'use-this-in-amd-mode',            // in amd mode, look for module defined in app/node_modules/use-this-in-amd-mode.js
        node: 'use-this-in-nodejs'              // same as require('use-this-in-nodejs') in nodejs
    },
    {
        common: '!use-this-global-in-single-page-mode' // in single page, look for global variable global-for-all
        // ignore other environments
    }
]

function factory(forAll, globalForAll, specificPerEnv, onlyDefinedInSinglePage) {

}
```

```javascript
function freact() {
    // React and ReactDOM variables can be used
}
```

`require` can be used within module declaration (factory or freact) and will also work with relative path

```javascript
// this is app/node_modules/some/path/module.js

function factory() {
    // not safe way of using require
    // it will always work in single page mode and in nodejs
    // but will work in amd mode only if required has already been loaded
    // here we look for module defined in app/node_modules/someModule.js. In nodejs, will use the classic require
    var someModule = require('someModule');

    // safe way of using require
    // work for every environments
    require([
        'someModule', // look for module defined in app/node_modules/someModule.js. In nodejs, will use the classic require
        './relative', // look for module defined in app/node_modules/some/path/relative.js
        {
            common: 'use-this-in-single-page-mode',
            amd: 'use-this-in-amd-mode',
            node: 'use-this-in-nodejs'
        }
    ], function(someModule, relative, specificPerEnv) {

    });
}
```

## Wild cards in bower.json file

When defining main, scripts or styles files in bower.json, you can use [anymatch](https://github.com/es128/anymatch) pattern

```json
{
    "jquery-ui": {
        "main": [
            "jquery-ui.js"
        ],
        "styles": [
            "themes/redmond/**"
        ],
        "scripts": [
            "ui/version.js",
            "ui/keycode.js",
            "ui/widgets/datepicker.js",
            "ui/i18n/datepicker-ar.js",
            "ui/i18n/datepicker-fr.js",
            "ui/i18n/datepicker-he.js",
            "ui/i18n/datepicker-zh-TW.js"
        ]
    }
}
```

## Deal with traditional "browser globals" scripts

From [requirejs config shim](http://requirejs.org/docs/api.html#config-shim)

`Configure the dependencies, exports, and custom initialization for older, traditional "browser globals" scripts that do not use define() to declare the dependencies and set a module value.`

```json
{
    "bootstrap": {
      "main": [
        "dist/css/bootstrap.css",
        "dist/js/bootstrap.js",
        "dist/fonts/**"
      ],
      "dependencies": {
        "jquery": "*"
      },
      "exports": "jQuery.fn.emulateTransitionEnd"
  }
}
```

## Compilers

With the classic brunch, the only way to add a compiler is to delacre it in package.json.  
That is too restrictive for me for 3 reasons:
  - First, I am too lazy to always create npm package when I am testing stuff
  - Second, I am also too lazy to spend time to find a way to try completely separate my custom compilers from umd-builder package
  - Third, the benefits of being lazy seem to me far greater than the benefit of having a package

For those reasons, I added a way to add compilers directly in brunch-config file

Nevertheless, if I am aware of better benefits than being lazy, I will spend time to try to make things cleaner.

### AmdCompiler

Depends on umd-builder

Mandatory. Transform files with a top level factory or freact function in umd module

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/amd')
    ]

    plugins:
        amd:
            strict: true # add 'use strict' in module definition (factory or freact)
            jshint: true # lint generated javascript using jshint

        jshint:
            warnOnly: true # if false, failed linted will be considered as error
            # ignore: ignore    # function(path) called to determined if file should be linted.
                                # Usually, third party libraries should be ignored
            # options: {} # if defined, ignore rules defined in .jshintrc
```

### CopyCompiler

Depends on umd-builder

Recommended. copy all watched files that do not match a javascript or stylesheet compiler.  
Usefull for images, fonts required in stylesheets

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/copy')
    ]
```

### RelativeCSS

Depends on umd-builder

Recommended. keep correct path in css. ex: bootstrap.  
Usefull for images, fonts required in stylesheets

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/relativecss')
    ]
```

### BabelCompiler

Transform every javascript code using [babel](https://babeljs.io/).

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/babel')
    ]

    plugins:
        babel:
            # optional transformations
            pretransform: [
                [
                    # add spModel, spClick, spShow, ... more details later
                    require('umd-builder/lib/spTransform'), {transformations: mdl: false}
                ]
            ]

            # ignore: ignore    # function(path) called to determined if file should be transform with babel.
                                # Usually, third party libraries should be ignored
            # if no other option is setted, use rules defined rules in .babelrc
```

### HandlebarsCompiler

Transform handlebars files into UMD modules

Similar to [handlebars-brunch](https://github.com/brunch/handlebars-brunch).

At the time I started this library, [handlebars-brunch](https://github.com/brunch/handlebars-brunch) was not using the latest version of handlebars and I was using the new features.

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/handlebars')
    ]
```

### HtmlCompiler

Transform html and htm files into UMD modules.

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/html')
    ]
```

### JstCompiler

Transform jst files into UMD modules that expose a [lodash template](https://lodash.com/docs#template).

I added an ignore option which allow to use comment in files.

`<%` is to be able to use Java Server Page (JSP) syntax highlight in sublime text and notepad++ since Java is not far from Javscript.


```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/jst/jst')
    ]
    plugins:
        jst:
            # _.template uses with when no variable is given. Since with is not recommended on MDN, I prefer not to use it
            # https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with
            variable: 'root'
            ignore: /<%--([\s\S]+?)--%>/g # added for comments within templates
            escape: /<%-([\s\S]+?)%>/g # default value
            interpolate: /<%=([\s\S]+?)%>/g # default value
            evaluate: /<%([\s\S]+?)%>/g # default value
            strict: true
```

### MarkdownCompiler

Transform markdown files into UMD modules

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/markdown')
    ]
    plugins:
        # https://github.com/chjj/marked
        # defined maked options
        markdown:
            jst: false  # Allow interpertation of javascript code within jst brackets. Look at JstCompiler for more details
                        # example: You can follow the [tutorial](<%= app.router.engine('default').getUrl({module: 'tutorial', controller: 'home', action: 'step0'}) %>)
```

### StylusCompiler

Transform stylus files into stylesheet files.

I don't remember why I created that since there is [stylus-brunch](https://github.com/brunch/stylus-brunch) that does the same job.

```coffeescript
exports.config =
    compilers: [
        require('umd-builder/lib/compilers/stylus')
    ]
```

## Known issues

### Partial build for large projects

It is hard to define large projet, let's say a project on which copy all files (app, bower_components, vendor) will take more than 60 second.

With those kind of projects, sometimes, build does not start correctly.

Re-run the build in those cases.

Because there is a workaround and not easy to reproduce, I don't want to spend time trying to fix.

### Source maps

With all those transformations, I have difficulties keeping the source map correct. The truth is, I don't understand a thing about source maps.
