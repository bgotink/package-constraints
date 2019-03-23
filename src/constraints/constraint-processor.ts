import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {WorkspaceInfo} from '../workspace';

import {DependencyType} from './constants';
import {Engine} from './engine';

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

export class ConstraintProcessor {
  private readonly _engine: Engine;

  constructor(workspacesInfo: WorkspaceInfo, source: string) {
    this._engine = new Engine(workspacesInfo);
    this._engine.consult(source);
  }

  public get enforcedDependencyRanges(): Observable<EnforcedDependencyRange> {
    return this._engine
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
        );
  }

  public get invalidDependencies(): Observable<InvalidDependency> {
    return this._engine
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
        );
  }
}
