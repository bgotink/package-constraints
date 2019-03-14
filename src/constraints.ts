import * as fs from 'fs';
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
  workspaceLocation: string;
  dependencyIdent: string;
  dependencyRange: string|null;
  dependencyType: DependencyType;
}

export interface InvalidDependency {
  workspaceLocation: string;
  dependencyIdent: string;
  dependencyType: DependencyType;
  reason: string|null;
}

export class Constraints {
  public readonly source: string = ``;

  constructor(project: string, private readonly workspace: WorkspaceInfo) {
    if (fs.existsSync(`${project}/constraints.pro`)) {
      this.source = fs.readFileSync(`${project}/constraints.pro`, `utf8`);
    }
  }

  getProjectDatabase() {
    let database = ``;

    database += `dependencyType(${DependencyType.Dependencies}).\n`;
    database += `dependencyType(${DependencyType.DevDependencies}).\n`;
    database += `dependencyType(${DependencyType.PeerDependencies}).\n`;

    for (const workspace of Object.values(this.workspace)) {
      database += `workspace(${escape(workspace.location)}).\n`;
      database +=
          `workspace_ident(${escape(workspace.location)}, ${escape(workspace.packageName)}).\n`;
      database +=
          `workspace_version(${escape(workspace.location)}, ${escape(workspace.version)}).\n`;

      for (const type of
               [DependencyType.Dependencies,
                DependencyType.PeerDependencies,
                DependencyType.DevDependencies]) {
        for (const [dependency, dependencyVersion] of Object.entries(workspace[type] || {})) {
          database += `workspace_has_dependency(${escape(workspace.location)}, ${
              escape(dependency)}, ${escape(dependencyVersion)}, ${type}).\n`;
        }
      }
    }

    return database;
  }

  getDeclarations() {
    let declarations = ``;

    // (Cwd, DependencyIdent, DependencyRange, DependencyType)
    declarations += `gen_enforced_dependency_range(_, _, _, _) :- false.\n`;

    // (Cwd, DependencyIdent, DependencyType, Reason)
    declarations += `gen_invalid_dependency(_, _, _, _) :- false.\n`;

    return declarations;
  }

  get fullSource() {
    return this.getProjectDatabase() + `\n` + this.source + `\n` + this.getDeclarations();
  }

  async process() {
    const engine = new Engine();
    await engine.consult(this.fullSource);

    const enforcedDependencyRanges =
        await engine
            .query(
                `workspace(WorkspaceLocation), dependencyType(DependencyType), gen_enforced_dependency_range(WorkspaceLocation, DependencyIdent, DependencyRange, DependencyType).`)
            .pipe(
                map(answer => {
                  const workspaceLocation = answer.WorkspaceLocation;
                  const dependencyIdent = answer.DependencyIdent;
                  const dependencyRange = answer.DependencyRange;
                  const dependencyType = answer.DependencyType;

                  if (workspaceLocation === null || dependencyIdent === null) {
                    throw new Error(`Invalid rule`);
                  }

                  return {workspaceLocation, dependencyIdent, dependencyRange, dependencyType};
                }),
                toArray<EnforcedDependencyRange>(),
                sortMap([
                  ({dependencyRange}) => dependencyRange !== null ? `0` : `1`,
                  ({workspaceLocation}) => workspaceLocation,
                  ({dependencyIdent}) => dependencyIdent,
                ]),
                )
            .toPromise();

    const invalidDependencies =
        await engine
            .query(
                `workspace(WorkspaceLocation), dependencyType(DependencyType), gen_invalid_dependency(WorkspaceLocation, DependencyIdent, DependencyType, Reason).`)
            .pipe(
                map(answer => {
                  const workspaceLocation = answer.WorkspaceLocation;
                  const dependencyIdent = answer.DependencyIdent;
                  const dependencyType = answer.DependencyType;
                  const reason = answer.links.Reason;

                  if (workspaceLocation === null || dependencyIdent === null) {
                    throw new Error(`Invalid rule`);
                  }

                  return {workspaceLocation, dependencyIdent, dependencyType, reason};
                }),
                toArray<InvalidDependency>(),
                sortMap([
                  ({workspaceLocation}) => workspaceLocation,
                  ({dependencyIdent}) => dependencyIdent,
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
