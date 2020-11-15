import {existsSync, readFileSync} from 'fs';
import {sync as glob} from 'glob';
import {join, normalize} from 'path';
import {BindOption, ReflectionFlag, ReflectionKind, DeclarationReflection} from 'typedoc';
import {Component, ConverterComponent} from 'typedoc/dist/lib/converter/components';
import {Context} from 'typedoc/dist/lib/converter/context';
import {Converter} from 'typedoc/dist/lib/converter/converter';
import {Comment} from 'typedoc/dist/lib/models/comments';

@Component({name: 'lerna-packages'})
export class LernaPackagesPlugin extends ConverterComponent {
    @BindOption('readme')
    readme!: string;

    @BindOption('lernaExclude')
    lernaExclude!: string[];

    @BindOption('pathExclude')
    pathExclude!: string[];

    private lernaPackages: { [name: string]: string } = {};

    constructor(owner: Converter) {
        super(owner);

        const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        const lernaConfig = packageJson.lerna || JSON.parse(readFileSync('lerna.json', 'utf8'));
        let packages: string[] = [];
        if (lernaConfig.packages) {
            packages = lernaConfig.packages;
        } else if (lernaConfig.useWorkspaces) {
            packages = packageJson.workspaces.packages || packageJson.workspaces;
        }

        if (!packages || packages.length === 0) {
            throw new Error('No lerna.json found or packages defined.');
        }

        for (const packageGlob of packages) {
            const thisPkgs = glob(packageGlob, {
                ignore: ['node_modules']
            });

            for (const pkg of thisPkgs) {
                if (existsSync(join(pkg, 'package.json'))) {
                    const pkgConfig = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
                    this.lernaPackages[pkgConfig['name']] = pkg;
                }
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

        // children could be undefined if there are some TS errors in the files
        if (!context.project.children) return;

        const copyChildren = context.project.children.slice(0);

        const cwd = process.cwd();

        const findLernaPackageForChildOriginalName = (path: string): string => {
            let fit = '';
            for (const i in this.lernaPackages) {
                if (!this.lernaPackages.hasOwnProperty(i)) continue;

                // normalize uses backslashes on Windows.
                const packagePath = normalize(join(cwd, this.lernaPackages[i]) + '/').replace(/\\/g, '/');
                if (normalize(path + '/').replace(/\\/g, '/').includes(packagePath)) {
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
            if (reflection.id === 0) {
                throw new Error('We got the wrong reference of Typedoc. Please install correctly and dedupe if necessary.');
            }

            lernaPackageModules[i] = reflection;
            reflection.originalName = fullPath;
            reflection.flags.setFlag(ReflectionFlag.Exported, true);
            reflection.sources = [{
                character: 0,
                fileName: fullPath,
                line: 0,
            }];
            reflection.children = [];

            const readMePath = join(fullPath, this.readme ?? 'README.md');

            if (this.readme !== 'none' && existsSync(readMePath)) {
                let readme = readFileSync(readMePath);
                reflection.comment = new Comment('', readme.toString());
            }
        }

        for (const child of copyChildren) {
            if (this.pathExclude.some(pkg => child.originalName.includes(pkg))) continue;
            const lernaPackageName = findLernaPackageForChildOriginalName(child.originalName);

            if (!lernaPackageModules[lernaPackageName]) {
                throw new Error(`lerna package module for ${lernaPackageName} not found.`);
            }

            // console.log('lernaPackageModules[lernaPackageName]', lernaPackageModules[lernaPackageName]);
            if (child.kindOf(ReflectionKind.Namespace) || child.kindOf(ReflectionKind.Module)) {
                console.log(`put ${child.name} stuff into ${lernaPackageName}`);
                /* This will search through the project level reflections collection to find an entry with the
                 * same name as the child we are currently working with so that it can be removed.
                 * This prevents it from appearing on the main index page but is still visible within the module
                 */
                const projectFileEntry = Object.entries(context.project.reflections)
                    .find(([key, value]) => value.name === child.name);

                if (projectFileEntry) {
                    delete context.project.reflections[projectFileEntry[0]];
                }

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
            if (this.lernaExclude.includes(i)) {
                continue;
            }

            if (lernaPackageModules[i].hasComment() || lernaPackageModules[i].children && lernaPackageModules[i].children.length > 0) {
                context.project.children.push(lernaPackageModules[i]);
                context.registerReflection(lernaPackageModules[i]);
            }
        }
    }
}
