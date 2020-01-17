"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("./plugin");
const typedoc_1 = require("typedoc");
function load(PluginHost) {
    const app = PluginHost.owner;
    app.options.addDeclaration({
        name: 'lernaExclude',
        help: 'List of package names that should be excluded.',
        type: typedoc_1.ParameterType.Array
    });
    app.options.addDeclaration({
        name: 'pathExclude',
        help: 'List of paths to entirely ignore',
        type: typedoc_1.ParameterType.Array,
        defaultValue: []
    });
    app.converter.addComponent('lerna-packages', plugin_1.LernaPackagesPlugin);
}
exports.load = load;
//# sourceMappingURL=index.js.map