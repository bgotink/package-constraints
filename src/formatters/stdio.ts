import * as chalk from 'chalk';
import {Writable} from 'stream';
import {WriteStream} from 'tty';

import {DependencyType} from '../constraints';

import {Formatter} from './formatter';

class Prettier {
  private readonly _packageName: chalk.Chalk;
  private readonly _packageScope: chalk.Chalk;

  public readonly version: chalk.Chalk;
  public readonly type: chalk.Chalk;
  public readonly reason: chalk.Chalk;
  public readonly error: chalk.Chalk;

  public constructor(chalk: chalk.Chalk) {
    this._packageName = chalk.hex('#ee7105');
    this._packageScope = chalk.hex('#ffa726');
    this.version = chalk.bold.hex('#009985');
    this.type = chalk.hex('#009985');
    this.reason = chalk.bold;
    this.error = chalk.bold.hex('#d64040')
  }

  public packageName(packageIdent: string): string {
    const scopeMatch = packageIdent.match(/^(@[^/]+)\/(.*)$/);
    if (scopeMatch != null) {
      return this._packageScope(`${scopeMatch[1]}/`) + this._packageName(scopeMatch[2]);
    } else {
      return this._packageName(packageIdent);
    }
  }
}

export class StdioFormatter implements Formatter {
  private _errorCount = 0;

  private _prettier: Prettier;

  public constructor(private readonly _sink: Writable) {
    this._prettier = new Prettier(
        (_sink as WriteStream).isTTY ? chalk : new chalk.Instance({level: 0}));
  }

  private _logError(strings: TemplateStringsArray, ...values: string[]): void {
    this._errorCount++;
    this._sink.write(String.raw(strings, ...values) + '\n');
  }

  public markInvalidDependencyVersion(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string,
      actualVersion: string): void {
    this._logError`${this._prettier.packageName(packageName)} must depend on ${
        this._prettier.packageName(
            dependencyName)} version ${this._prettier.version(requiredVersion)} via ${
        this._prettier.type(dependencyType)}, but depends on version ${
        this._prettier.version(actualVersion)} instead`;
  }

  public markMissingDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      requiredVersion: string): void {
    this._logError`${this._prettier.packageName(packageName)} must depend on ${
        this._prettier.packageName(
            dependencyName)} version ${this._prettier.version(requiredVersion)} via ${
        this._prettier.type(dependencyType)}, but doesn't`;
  }

  public markExtraneousDependency(
      packageName: string,
      dependencyType: DependencyType,
      dependencyName: string,
      actualVersion: string): void {
    this._logError`${this._prettier.packageName(packageName)} has an extraneous dependency on ${
        this._prettier.packageName(dependencyName)} version ${
        this._prettier.version(actualVersion)} via ${this._prettier.type(dependencyType)}`;
  }

  public markInvalidDependency(
      packageName: string, dependencyType: DependencyType, dependencyName: string, reason: string):
      void {
    this._logError`${this._prettier.packageName(packageName)} has an invalid dependency on ${
        this._prettier.packageName(
            dependencyName)} via ${this._prettier.type(dependencyType)} (invalid because ${
        this._prettier.reason(String(reason))})`;
  }

  public markValidDependency(): void {
    // Logging this would introduce too much logging
  }

  public complete(): void {
    if (this._errorCount > 0) {
      this._sink.write(`Found ${this._prettier.error(`${this._errorCount} errors`)}\n`);
    } else {
      this._sink.write(`No errors found\n`);
    }
  }
}
