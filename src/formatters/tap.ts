import {Writable} from 'stream';

import {DependencyType} from '../constraints';

import {Formatter} from './formatter';

export class TapFormatter implements Formatter {
  private _count = 0;

  public constructor(private readonly _sink: Writable) {}

  private _logError(strings: TemplateStringsArray, ...values: string[]): void {
    this._sink.write(`not ok ${++this._count} - ${String.raw(strings, ...values)}\n`);
  }

  public markInvalidDependencyVersion(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string,
      actualVersion: string): void {
    this._logError`${packageName} must depend on ${dependencyName} version ${requiredVersion} via ${
        dependencyType}, but depends on version ${actualVersion} instead`;
  }

  public markMissingDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string): void {
    this._logError`${packageName} must depend on ${dependencyName} version ${requiredVersion} via ${
        dependencyType}, but doesn't`;
  }

  public markExtraneousDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      actualVersion: string): void {
    this._logError`${packageName} has an extraneous dependency on ${dependencyName} version ${
        actualVersion} via ${dependencyType}`;
  }

  public markInvalidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, reason: string):
      void {
    this._logError`${packageName} has an invalid dependency on ${dependencyName} via ${
        dependencyType} (invalid because ${String(reason)})`;
  }

  public markValidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, version: string):
      void {
    this._sink.write(`ok ${++this._count} - ${packageName} has a valid dependency on ${
        dependencyName} version ${version} via ${dependencyType}\n`);
  }

  public complete(): void {
    this._sink.write(`1..${this._count}\n`);
  }
}
