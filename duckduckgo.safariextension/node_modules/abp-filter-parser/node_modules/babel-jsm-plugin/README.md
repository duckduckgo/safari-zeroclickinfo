# babel-jsm-plugin

Babel plugin for converting ES6 modules into JavaScript code modules (JSM).

This is a Babel plugin and it supersedes the olds way of doing module formatters.  This plugin allows you to write ES6 code and export a JSM module which can be used for Gecko development or for add-on authors.

## Usage

Install:

```
npm install babel babel-core babel-jsm-plugin --save-dev
```

Comamnd line:

```
babel --modules ignore --plugins babel-jsm-plugin myfile.js --out-file myfile.jsm
```

From node, or node based task runner:

```
require("babel").transform("code", { plugins: ["babel-jsm-plugin"] });
```

From browserify:

```
var b = browserify({
  // browserifyoptions
}).transform(
  babelify.configure({
    plugins: ["babel-jsm-plugin"]
  })
);
```
