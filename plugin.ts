import {join} from "path";
import * as fs from "fs";

import {ReflectionKind, ReflectionFlag} from "typedoc/dist/lib/models/reflections/abstract";
import {Component, ConverterComponent} from "typedoc/dist/lib/converter/components";
import {Converter} from "typedoc/dist/lib/converter/converter";
import {Context} from "typedoc/dist/lib/converter/context";
import {Comment} from "typedoc/dist/lib/models/comments";
import * as glob from 'glob';
import {DeclarationReflection} from "typedoc";

@Component({name: 'lerna-packages'})
export class LernaPackagesPlugin extends ConverterComponent {
    private lernaPackages: { [name: string]: string } = {};

    constructor(owner: Converter) {
        super(owner);

        const lernaConfig = JSON.parse(fs.readFileSync('lerna.json', 'utf8'));
        if (!lernaConfig.packages) {
            throw new Error('No lerna.json found or packages defined.');
        }

        for (const packageGlob of lernaConfig['packages']) {
            const thisPkgs = glob.sync(packageGlob, {
                ignore: ['node_modules']
            });

            for (const pkg of thisPkgs) {
                const pkgConfig = JSON.parse(fs.readFileSync(join(pkg, 'package.json'), 'utf8'));
                this.lernaPackages[pkgConfig['name']] = pkg;
            }
        }

        this.listenTo(this.owner, {
            [Converter.EVENT_RESOLVE_BEGIN]: this.onBeginResolve.bind(this)
        });
    }

    /**
     * Triggered when the converter begins resolving a project.
     *
     * @param context  The context object describing the current state the converter is in.
     */
    private onBeginResolve(context: Context) {
        console.log('Lerne packages found', this.lernaPackages);
        const lernaPackageModules: { [lernaPackageName: string]: DeclarationReflection } = {};

        const copyChildren = context.project.children.slice(0);

        const cwd = process.cwd();

        const findLernaPackageForChildOriginalName = (path: string): string => {
            let fit = '';
            for (const i in this.lernaPackages) {
                if (!this.lernaPackages.hasOwnProperty(i)) continue;

                const packagePath = join(cwd, this.lernaPackages[i]) + '/';
                if (-1 !== (path + '/').indexOf(packagePath)) {
                    if (i.length > fit.length) {
                        fit = i;
                    }
                }
            }

            if (!fit) {
                throw new Error(`No lerna package found for ${path}`);
            }

            return fit;
        };

        context.project.children.length = 0;
        for (const i in this.lernaPackages) {

            const fullPath = join(cwd, this.lernaPackages[i]);
            const reflection = new DeclarationReflection(i, ReflectionKind.Module, context.project);
            lernaPackageModules[i] = reflection;
            reflection.originalName = fullPath;
            reflection.flags.setFlag(ReflectionFlag.Exported, true);
            reflection.sources = [{
                character: 0,
                fileName: fullPath,
                line: 0,
            }];
            context.registerReflection(reflection);
            reflection.children = [];
            context.project.children.push(reflection);

            const readMePath = join(fullPath, 'README.md');

            if (fs.existsSync(readMePath)) {
                let readme = fs.readFileSync(readMePath);
                reflection.comment = new Comment("", readme.toString());
            }
        }

        for (const child of copyChildren) {
            const lernaPackageName = findLernaPackageForChildOriginalName(child.originalName);
            if (!lernaPackageModules[lernaPackageName]) {
                throw new Error(`lerna package module for ${lernaPackageName} not found.`);
            }

            // console.log('lernaPackageModules[lernaPackageName]', lernaPackageModules[lernaPackageName]);
            if (child.kindOf(ReflectionKind.ExternalModule) || child.kindOf(ReflectionKind.Module)) {
                console.log(`put ${child.name} stuff into ${lernaPackageName}`);
                if (child.children) {
                    for (const cc of child.children) {
                        lernaPackageModules[lernaPackageName].children.push(cc);
                        cc.parent = lernaPackageModules[lernaPackageName];
                    }
                }
            } else {
                lernaPackageModules[lernaPackageName].children.push(child);
                child.parent = lernaPackageModules[lernaPackageName];
            }
        }
    }
}

