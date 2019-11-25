import * as fs from "fs";
import * as glob from 'glob';
import { join, normalize } from "path";
import { DeclarationReflection } from "typedoc";
import { Component, ConverterComponent } from "typedoc/dist/lib/converter/components";
import { Context } from "typedoc/dist/lib/converter/context";
import { Converter } from "typedoc/dist/lib/converter/converter";
import { Comment } from "typedoc/dist/lib/models/comments";
import { ReflectionFlag, ReflectionKind } from "typedoc/dist/lib/models/reflections/abstract";
import { Option } from "typedoc/dist/lib/utils/component";
import { ParameterType } from "typedoc/dist/lib/utils/options/declaration";


@Component({name: 'lerna-packages'})
export class LernaPackagesPlugin extends ConverterComponent {
    @Option({
        name: 'lernaExclude',
        help: 'List of package names that should be excluded.',
        type: ParameterType.Array,
        defaultValue: []
    })
    lernaExclude!: string[];

    @Option({
      name: 'pathExclude',
      help: 'List of paths to entirely ignore',
      type: ParameterType.Array,
      defaultValue: []
    })
    pathExclude!: string[];

    private lernaPackages: { [name: string]: string } = {};

    constructor(owner: Converter) {
        super(owner);

        const lernaConfig = JSON.parse(fs.readFileSync('lerna.json', 'utf8'));
        let packages: string[] = [];
        if (lernaConfig.packages) {
            packages = lernaConfig.packages;
        } else if (lernaConfig.useWorkspaces) {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            packages = packageJson.workspaces.packages || packageJson.workspaces;
        }

        if (!packages || packages.length === 0) {
            throw new Error('No lerna.json found or packages defined.');
        }

        for (const packageGlob of packages) {
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
        console.log('Lerna packages found', this.lernaPackages);
        const lernaPackageModules: { [lernaPackageName: string]: DeclarationReflection } = {};

        const copyChildren = context.project.children.slice(0);

        const cwd = process.cwd();

        const findLernaPackageForChildOriginalName = (path: string): string => {
            let fit = '';
            for (const i in this.lernaPackages) {
                if (!this.lernaPackages.hasOwnProperty(i)) continue;

                const packagePath = normalize(join(cwd, this.lernaPackages[i]) + '/');
                if (-1 !== normalize(path + '/').indexOf(packagePath)) {
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
            reflection.children = [];

            const readMePath = join(fullPath, 'README.md');

            if (fs.existsSync(readMePath)) {
                let readme = fs.readFileSync(readMePath);
                reflection.comment = new Comment("", readme.toString());
            }
        }

        for (const child of copyChildren) {
            if(this.pathExclude.some(pkg => child.originalName.includes(pkg))) continue;
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

        for (const i in lernaPackageModules) {
            if (-1 !== this.lernaExclude.indexOf(i)) {
                continue;
            }

            if (lernaPackageModules[i].hasComment() || lernaPackageModules[i].children && lernaPackageModules[i].children.length > 0) {
                context.project.children.push(lernaPackageModules[i]);
                context.registerReflection(lernaPackageModules[i]);
            }
        }
    }
}
