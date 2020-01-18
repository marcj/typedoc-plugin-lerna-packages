import { LernaPackagesPlugin } from './plugin';
import { PluginHost } from 'typedoc/dist/lib/utils';
import { ParameterType } from 'typedoc';

export function load(PluginHost: PluginHost) {
    const app = PluginHost.owner;

    app.options.addDeclaration({
        name: 'lernaExclude',
        help: 'List of package names that should be excluded.',
        type: ParameterType.Array
    });

    app.options.addDeclaration({
        name: 'pathExclude',
        help: 'List of paths to entirely ignore',
        type: ParameterType.Array,
        defaultValue: []
    });

    app.converter.addComponent('lerna-packages', LernaPackagesPlugin);
}
