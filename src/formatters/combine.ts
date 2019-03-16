import {DependencyType} from '../constraints';

import {Formatter} from './formatter';

export class CombineFormatter implements Formatter {
  public constructor(private readonly _formatters: Formatter[]) {}

  public markInvalidDependencyVersion(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string,
      actualVersion: string): void {
    for (const formatter of this._formatters) {
      formatter.markInvalidDependencyVersion(
          packageName, dependencyType, dependencyName, requiredVersion, actualVersion);
    }
  }

  public markMissingDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string): void {
    for (const formatter of this._formatters) {
      formatter.markMissingDependency(packageName, dependencyType, dependencyName, requiredVersion);
    }
  }

  public markExtraneousDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      actualVersion: string): void {
    for (const formatter of this._formatters) {
      formatter.markExtraneousDependency(
          packageName, dependencyType, dependencyName, actualVersion);
    }
  }

  public markInvalidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, reason: string):
      void {
    for (const formatter of this._formatters) {
      formatter.markInvalidDependency(packageName, dependencyType, dependencyName, reason);
    }
  }

  public markValidDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      version: string|null): void {
    for (const formatter of this._formatters) {
      formatter.markValidDependency(packageName, dependencyType, dependencyName, version);
    }
  }

  public complete(): void {
    for (const formatter of this._formatters) {
      formatter.complete();
    }
  }
}
