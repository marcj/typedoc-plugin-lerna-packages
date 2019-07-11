"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const glob = require("glob");
const path_1 = require("path");
const typedoc_1 = require("typedoc");
const components_1 = require("typedoc/dist/lib/converter/components");
const converter_1 = require("typedoc/dist/lib/converter/converter");
const comments_1 = require("typedoc/dist/lib/models/comments");
const abstract_1 = require("typedoc/dist/lib/models/reflections/abstract");
const component_1 = require("typedoc/dist/lib/utils/component");
const declaration_1 = require("typedoc/dist/lib/utils/options/declaration");
let LernaPackagesPlugin = class LernaPackagesPlugin extends components_1.ConverterComponent {
    constructor(owner) {
        super(owner);
        this.lernaPackages = {};
        const lernaConfig = JSON.parse(fs.readFileSync('lerna.json', 'utf8'));
        let packages = [];
        if (lernaConfig.packages) {
            packages = lernaConfig.packages;
        }
        else if (lernaConfig.useWorkspaces) {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            packages = packageJson.workspaces;
        }
        if (!packages || packages.length === 0) {
            throw new Error('No lerna.json found or packages defined.');
        }
        for (const packageGlob of packages) {
            const thisPkgs = glob.sync(packageGlob, {
                ignore: ['node_modules']
            });
            for (const pkg of thisPkgs) {
                const pkgConfig = JSON.parse(fs.readFileSync(path_1.join(pkg, 'package.json'), 'utf8'));
                this.lernaPackages[pkgConfig['name']] = pkg;
            }
        }
        this.listenTo(this.owner, {
            [converter_1.Converter.EVENT_RESOLVE_BEGIN]: this.onBeginResolve.bind(this)
        });
    }
    /**
     * Triggered when the converter begins resolving a project.
     *
     * @param context  The context object describing the current state the converter is in.
     */
    onBeginResolve(context) {
        console.log('Lerna packages found', this.lernaPackages);
        const lernaPackageModules = {};
        const copyChildren = context.project.children.slice(0);
        const cwd = process.cwd();
        const findLernaPackageForChildOriginalName = (path) => {
            let fit = '';
            for (const i in this.lernaPackages) {
                if (!this.lernaPackages.hasOwnProperty(i))
                    continue;
                const packagePath = path_1.join(cwd, this.lernaPackages[i]) + '/';
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
            const fullPath = path_1.join(cwd, this.lernaPackages[i]);
            const reflection = new typedoc_1.DeclarationReflection(i, abstract_1.ReflectionKind.Module, context.project);
            lernaPackageModules[i] = reflection;
            reflection.originalName = fullPath;
            reflection.flags.setFlag(abstract_1.ReflectionFlag.Exported, true);
            reflection.sources = [{
                    character: 0,
                    fileName: fullPath,
                    line: 0,
                }];
            reflection.children = [];
            const readMePath = path_1.join(fullPath, 'README.md');
            if (fs.existsSync(readMePath)) {
                let readme = fs.readFileSync(readMePath);
                reflection.comment = new comments_1.Comment("", readme.toString());
            }
        }
        for (const child of copyChildren) {
            const lernaPackageName = findLernaPackageForChildOriginalName(child.originalName);
            if (!lernaPackageModules[lernaPackageName]) {
                throw new Error(`lerna package module for ${lernaPackageName} not found.`);
            }
            // console.log('lernaPackageModules[lernaPackageName]', lernaPackageModules[lernaPackageName]);
            if (child.kindOf(abstract_1.ReflectionKind.ExternalModule) || child.kindOf(abstract_1.ReflectionKind.Module)) {
                console.log(`put ${child.name} stuff into ${lernaPackageName}`);
                if (child.children) {
                    for (const cc of child.children) {
                        lernaPackageModules[lernaPackageName].children.push(cc);
                        cc.parent = lernaPackageModules[lernaPackageName];
                    }
                }
            }
            else {
                lernaPackageModules[lernaPackageName].children.push(child);
                child.parent = lernaPackageModules[lernaPackageName];
            }
        }
        for (const i in lernaPackageModules) {
            if (-1 !== this.exclude.indexOf(i)) {
                continue;
            }
            if (lernaPackageModules[i].children && lernaPackageModules[i].children.length > 0) {
                context.project.children.push(lernaPackageModules[i]);
                context.registerReflection(lernaPackageModules[i]);
            }
        }
    }
};
__decorate([
    component_1.Option({
        name: 'lernaExclude',
        help: 'List of package names that should be excluded.',
        type: declaration_1.ParameterType.Array,
        defaultValue: []
    })
], LernaPackagesPlugin.prototype, "exclude", void 0);
LernaPackagesPlugin = __decorate([
    components_1.Component({ name: 'lerna-packages' })
], LernaPackagesPlugin);
exports.LernaPackagesPlugin = LernaPackagesPlugin;
//# sourceMappingURL=plugin.js.map