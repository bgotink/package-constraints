import * as fs from 'fs';
import * as path from 'path';
import {map, toArray} from 'rxjs/operators';

import {Engine} from './engine';
import {sortMap} from './util';
import {WorkspaceInfo} from './workspace';

export const enum DependencyType {
  Dependencies = 'dependencies',
  PeerDependencies = 'peerDependencies',
  DevDependencies = 'devDependencies',
}

export interface EnforcedDependencyRange {
  packageName: string;
  dependencyName: string;
  dependencyRange: string|null;
  dependencyType: DependencyType;
}

export interface InvalidDependency {
  packageName: string;
  dependencyName: string;
  dependencyType: DependencyType;
  reason: string|null;
}

function exists(filepath: string): Promise<boolean> {
  return new Promise(resolve => fs.exists(filepath, resolve));
}

function readFile(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, contents) => {
      if (err) {
        reject(err);
      } else {
        resolve(String(contents));
      }
    });
  });
}

async function loadConstraints(directory: string) {
  for (const filename of ['constraints.pl', 'constraints.pro']) {
    let filepath = path.join(directory, filename);

    if (await exists(filepath)) {
      return readFile(filepath);
    }
  }

  throw new Error(`Couldn't find constraints.pl or constraints.pro to load in ${directory}`);
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

    for (const workspace of Object.values(this.workspace)) {
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
    return this.getProjectDatabase() + `\n` + await this.source + `\n` + this.getDeclarations() + '\n';
  }

  async process() {
    const engine = new Engine();
    engine.consult(await this.getFullSource());

    const enforcedDependencyRanges =
        await engine
            .query(
                `package(PackageName), dependency_type(DependencyType), gen_enforced_dependency_range(PackageName, DependencyName, DependencyRange, DependencyType).`)
            .pipe(
                map(answer => {
                  const packageName = answer.PackageName;
                  const dependencyName = answer.DependencyName;
                  const dependencyRange = answer.DependencyRange;
                  const dependencyType = answer.DependencyType;

                  if (packageName === null || dependencyName === null) {
                    throw new Error(`Invalid rule`);
                  }

                  return {packageName, dependencyName, dependencyRange, dependencyType};
                }),
                toArray<EnforcedDependencyRange>(),
                sortMap([
                  ({dependencyRange}) => dependencyRange !== null ? `0` : `1`,
                  ({packageName}) => packageName,
                  ({dependencyName: dependencyIdent}) => dependencyIdent,
                ]),
                )
            .toPromise();

    const invalidDependencies =
        await engine
            .query(
                `package(PackageName), dependency_type(DependencyType), gen_invalid_dependency(PackageName, DependencyName, DependencyType, Reason).`)
            .pipe(
                map(answer => {
                  const packageName = answer.PackageName;
                  const dependencyName = answer.DependencyName;
                  const dependencyType = answer.DependencyType;
                  const reason = answer.links.Reason;

                  if (packageName === null || dependencyName === null) {
                    throw new Error(`Invalid rule`);
                  }

                  return {packageName, dependencyName, dependencyType, reason};
                }),
                toArray<InvalidDependency>(),
                sortMap([
                  ({packageName}) => packageName,
                  ({dependencyName: dependencyIdent}) => dependencyIdent,
                ]),
                )
            .toPromise();

    return {enforcedDependencyRanges, invalidDependencies};
  }
}

function escape(what: string|null) {
  if (typeof what === `string`) {
    return `'${what}'`;
  } else {
    return `[]`;
  }
}
