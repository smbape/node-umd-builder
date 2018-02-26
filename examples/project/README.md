```sh
npm install
node build.js w -s
```

go to [http://127.0.0.1:3330/web](http://127.0.0.1:3330/web) to see the AMD version page  
go to [http://127.0.0.1:3330/app](http://127.0.0.1:3330/app) to see the Commonjs version page

Alternatively, if you don't want to use the `-s` option,  
open the file `public/index.classic.html` to see the AMD version page  
open the file `public/index.single.html` to see the Commonjs version page

`./test.js` shows an example of how to require a client file from nodejs, as long as depencies are correctly defined.  
In the given example, `./public/node_modules/examples/some-module` will use the server version of `lodash`.
