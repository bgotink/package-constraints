import {DependencyType} from '../constraints';

export interface Formatter {
  markInvalidDependencyVersion(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string,
      actualVersion: string): void;

  markMissingDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string): void;

  markExtraneousDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      actualVersion: string): void;

  markInvalidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, reason: string):
      void;

  complete(): void;
}
