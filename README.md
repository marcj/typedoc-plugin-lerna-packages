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
npm i typedoc-plugin-lerna-packages

typedoc
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
