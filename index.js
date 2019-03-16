var plugin = require("./plugin");

module.exports = function (PluginHost) {
    var app = PluginHost.owner;

    app.options.addDeclaration({name: 'lerna-packages', short: 'lp'});

    app.converter.addComponent('lerna-packages', plugin.LernaPackagesPlugin);
};

=
