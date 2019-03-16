import * as path from 'path';

import {readFile} from '../util';
import {PackageInfo, WorkspaceInfo} from '../workspace';

import {DependencyType} from './constants';
import {ConstraintProcessor} from './constraint-processor';

async function loadConstraints(directory: string) {
  for (const filename of ['constraints.pl', 'constraints.pro']) {
    let filepath = path.join(directory, filename);

    try {
      return await readFile(filepath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
  }

  throw new Error(`Couldn't find constraints.pl or constraints.pro to load in ${directory}`);
}

function sortByName(a: PackageInfo, b: PackageInfo): number {
  const aName = a.packageName;
  const bName = b.packageName;

  if (aName === bName) {
    return 0;
  }
  return aName < bName ? -1 : 1;
}

export class Constraints {
  public readonly source: Promise<string>;

  constructor(project: string, private readonly workspace: WorkspaceInfo) {
    this.source = loadConstraints(project);
  }

  getProjectDatabase() {
    const database: string[] = [];

    function consult(tpl: TemplateStringsArray, ...values: any[]): void {
      database.push(String.raw(tpl, ...values).trim());
    }

    consult`dependency_type(${DependencyType.Dependencies}).`;
    consult`dependency_type(${DependencyType.DevDependencies}).`;
    consult`dependency_type(${DependencyType.PeerDependencies}).`;

    for (const workspace of Object.values(this.workspace).sort(sortByName)) {
      consult`package(${escape(workspace.packageName)}).`;
      consult`package_location(${escape(workspace.packageName)}, ${escape(workspace.location)}).`;
      consult`package_version(${escape(workspace.packageName)}, ${escape(workspace.version)}).`;

      for (const type of
               [DependencyType.Dependencies,
                DependencyType.PeerDependencies,
                DependencyType.DevDependencies]) {
        for (const [dependency, dependencyVersion] of Object.entries(workspace[type] || {})) {
          consult`package_has_dependency(${escape(workspace.packageName)}, ${escape(dependency)}, ${
              escape(dependencyVersion)}, ${type}).`;
        }
      }
    }

    return database.join('\n');
  }

  getDeclarations(): string {
    const declarations: string[] = [];

    function consult(tpl: TemplateStringsArray, ...values: any[]): void {
      declarations.push(String.raw(tpl, ...values).trim());
    }

    // (Cwd, DependencyIdent, DependencyRange, DependencyType)
    consult`gen_enforced_dependency_range(_, _, _, _) :- false.`;

    // (Cwd, DependencyIdent, DependencyType, Reason)
    consult`gen_invalid_dependency(_, _, _, _) :- false.`;

    return declarations.join('\n');
  }

  async getFullSource(): Promise<string> {
    return this.getProjectDatabase() + `\n` + await this.source + `\n` + this.getDeclarations() +
        '\n';
  }

  async process() {
    return new ConstraintProcessor(await this.getFullSource());
  }
}

function escape(what: string|null) {
  if (typeof what === `string`) {
    return `'${what}'`;
  } else {
    return `[]`;
  }
}
