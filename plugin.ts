import {join} from "path";
import * as fs from "fs";
import * as marked from "marked";
import * as ts from 'typescript';

import {Reflection, ReflectionKind, ReflectionFlag} from "typedoc/dist/lib/models/reflections/abstract";
import {Component, ConverterComponent} from "typedoc/dist/lib/converter/components";
import {Converter} from "typedoc/dist/lib/converter/converter";
import {Context} from "typedoc/dist/lib/converter/context";
import {Comment} from "typedoc/dist/lib/models/comments";
import * as glob from 'glob';
import {ContainerReflection, DeclarationReflection} from "typedoc";
import {createDeclaration} from "typedoc/dist/lib/converter/factories";

marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code) {
        return require('highlight.js').highlightAuto(code).value;
    },
    pedantic: false,
    gfm: true,
    tables: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
});

/**
 * This plugin allows you to provide a mapping regexp between your source folder structure, and the module that should be
 * reported in typedoc. It will match the first capture group of your regex and use that as the module name.
 *
 * Based on https://github.com/christopherthielen/typedoc-plugin-external-module-name
 *
 *
 */
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

        console.log('this.lernaPackages', this.lernaPackages);

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
        console.log('onBeginResolve this.lernaPackages', this.lernaPackages);
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

        // context.project.reflections = {};
        context.project.children.length = 0;
        // console.log(context.project.children[0]);
        for (const i in this.lernaPackages) {
            // lernaPackageModules[i] = createDeclaration(context,
            //     {...ts.createNode(ts.SyntaxKind.QualifiedName), _declarationBrand: undefined},
            //     ReflectionKind.Module,
            //     'i'
            // );

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
            // context.project.reflections.push(lernaPackageModules[i]);
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

        // // Process each rename
        // this.moduleRenames.forEach(item => {
        //     let renaming = <ContainerReflection>item.reflection;
        //     // Find an existing module that already has the "rename to" name.  Use it as the merge target.
        //     let mergeTarget = <ContainerReflection>
        //         refsArray.filter(ref => ref.kind === renaming.kind && ref.name === item.renameTo)[0];
        //
        //     // If there wasn't a merge target, just change the name of the current module and exit.
        //     if (!mergeTarget) {
        //         renaming.name = item.renameTo;
        //         return;
        //     }
        //
        //     if (!mergeTarget.children) {
        //         mergeTarget.children = [];
        //     }
        //
        //     // Since there is a merge target, relocate all the renaming module's children to the mergeTarget.
        //     let childrenOfRenamed = refsArray.filter(ref => ref.parent === renaming);
        //     childrenOfRenamed.forEach((ref: Reflection) => {
        //         // update links in both directions
        //
        //         //console.log(' merging ', mergeTarget, ref);
        //         ref.parent = mergeTarget;
        //         mergeTarget.children.push(<any>ref)
        //     });
        //
        //     // Now that all the children have been relocated to the mergeTarget, delete the empty module
        //     // Make sure the module being renamed doesn't have children, or they will be deleted
        //     if (renaming.children)
        //         renaming.children.length = 0;
        //     CommentPlugin.removeReflection(context.project, renaming);
        //
        // });
        //
        // console.log('this.modules', this.modules);
        // this.modules.forEach((name: string) => {
        //     let ref = refsArray.filter(ref => ref.name === name)[0] as ContainerReflection;
        //     let root = ref.originalName.replace(new RegExp(`${name}.*`, 'gi'), name);
        //     try {
        //         // tslint:disable-next-line ban-types
        //         Object.defineProperty(ref, "kindString", {
        //             get() {
        //                 return "Package";
        //             },
        //             set(newValue) {
        //                 return "Package";
        //             },
        //         });
        //         console.log('name', name, path.join(root, 'README.md'));
        //         let readme = fs.readFileSync(path.join(root, 'README.md'));
        //         ref.comment = new Comment("", marked(readme.toString()));
        //     } catch (e) {
        //         console.error(`No README found for module "${name}"`);
        //     }
        // })
    }
}

