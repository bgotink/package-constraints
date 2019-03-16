import chalk from 'chalk';

import {DependencyType} from '../constraints';

import {Formatter} from './formatter';

const _markPackageName = chalk.hex('#ee7105');
const _markPackageScope = chalk.hex('#ffa726');
function markPackageName(packageIdent: string): string {
  const scopeMatch = packageIdent.match(/^(@[^/]+)\/(.*)$/);
  if (scopeMatch != null) {
    return _markPackageScope(`${scopeMatch[1]}/`) + _markPackageName(scopeMatch[2]);
  } else {
    return _markPackageName(packageIdent);
  }
}
const markVersion = chalk.bold.hex('#009985');
const markType = chalk.hex('#009985');
const markReason = chalk.bold;
const markError = chalk.bold.hex('#d64040');

export class StdioFormatter implements Formatter {
  private _errorCount = 0;

  private _logError(strings: TemplateStringsArray, ...values: string[]): void {
    this._errorCount++;
    console.error(String.raw(strings, ...values));
  }

  public markInvalidDependencyVersion(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string,
      actualVersion: string): void {
    this._logError`${markPackageName(packageName)} must depend on ${
        markPackageName(dependencyName)} version ${markVersion(requiredVersion)} via ${
        markType(dependencyType)}, but depends on version ${markVersion(actualVersion)} instead`;
  }

  public markMissingDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string): void {
    this._logError`${markPackageName(packageName)} must depend on ${
        markPackageName(dependencyName)} version ${markVersion(requiredVersion)} via ${
        markType(dependencyType)}, but doesn't`;
  }

  public markExtraneousDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      actualVersion: string): void {
    this._logError`${markPackageName(packageName)} has an extraneous dependency on ${
        markPackageName(
            dependencyName)} version ${markVersion(actualVersion)} via ${markType(dependencyType)}`;
  }

  public markInvalidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, reason: string):
      void {
    this._logError`${markPackageName(packageName)} has an invalid dependency on ${
        markPackageName(dependencyName)} via ${markType(dependencyType)} (invalid because ${
        markReason(String(reason))})`;
  }

  public complete(): void {
    if (this._errorCount > 0) {
      console.error(`Found ${markError(`${this._errorCount} errors`)}`);
    } else {
      console.error(`No errors found`);
    }
  }
}
