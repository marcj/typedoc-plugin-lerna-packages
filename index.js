var plugin = require("./plugin");

module.exports = function (PluginHost) {
    var app = PluginHost.owner;

    app.options.addDeclaration({name: 'lerna-packages-exclude', short: 'lpe'});

    app.converter.addComponent('lerna-packages', plugin.LernaPackagesPlugin);
};
