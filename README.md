## typedoc-plugin-lerna-packages

A plugin for [Typedoc](http://typedoc.org) that groups all Lerna packages
into own TS module. Normally Typedoc handles each file as a module, this
isn't correct for lerna packages, as each package should be treated as
a module. This plugins handles that. Also if you have a README.md in your
package folder, it will be used as comment for that module.

Example Demo: https://estdlib.dev/

Example source code: https://github.com/marcj/estdlib.ts

Just install it and type `typedoc`:

```
npm i -D typedoc-plugin-lerna-packages typedoc@^0.14.2

./node_modules/.bin/typedoc
```


Example `typedoc.js` in your root folder

```
module.exports = {
    "mode": "modules",
    "out": "docs",
    exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
    ],
    name: 'MY NAME',
    excludePrivate: true,
    skipInternal: true
};
```

## Options

In `typedoc.js` you can add following extra config values to change the behavior of this plugin.

```
module.exports = {
    //...
    
    //exclude packages from being generated
    lernaExclude: ['@vendor/integration-tests', '@vendor/examples'],
};

```

### Development

When you work on this package you should link to it in a other lerna repo,
and then execute following command to make generation working:

```
rm -rf docs && NODE_PRESERVE_SYMLINKS=1 ./node_modules/.bin/typedoc
```
