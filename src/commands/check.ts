import chalk from 'chalk';

import {EnforcedDependencyRange, InvalidDependency} from '../constraint-processor';
import {Constraints} from '../constraints';
import {createSort, groupByPackage} from '../util';
import {getWorkspace} from '../workspace';

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

const sortEnforcedDependencyRanges = createSort<EnforcedDependencyRange>(
    ({dependencyRange}) => dependencyRange != null ? 0 : 1,
    ({dependencyName}) => dependencyName,
);
const sortInvalidDependencies = createSort<InvalidDependency>(
    ({dependencyName}) => dependencyName,
);

export default (concierge: any) =>
    concierge
        .command(`check`)

        .describe(`check that the constraints are met`)

        .detail(`
  This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

  For more information as to how to write constraints, please consult our manual: TODO.
`)

        .example(
            `Checks that all constraints are satisfied`,
            `yarn constraints check`,
            )

        .action(async () => {
          const cwd = process.cwd();

          const workspaceInfo = await getWorkspace(cwd).toPromise();
          const constraints = new Constraints(cwd, workspaceInfo);
          const processor = await constraints.process();

          let errorCount = 0;

          function logError(strings: TemplateStringsArray, ...values: string[]): void {
            errorCount++;
            console.error(String.raw(strings, ...values));
          }

          await processor.enforcedDependencyRanges.pipe(groupByPackage())
              .forEach(enforcedDependencyRanges => {
                const {packageName} = enforcedDependencyRanges[0];
                const packageInfo = workspaceInfo[packageName];

                for (const {
                       dependencyName,
                       dependencyRange: enforcedDependencyRange,
                       dependencyType
                     } of sortEnforcedDependencyRanges(enforcedDependencyRanges)) {
                  const deps = packageInfo[dependencyType];
                  const actualDependencyRange = deps && deps[dependencyName];

                  if (enforcedDependencyRange !== null) {
                    if (actualDependencyRange !== enforcedDependencyRange) {
                      if (actualDependencyRange != null) {
                        logError`${markPackageName(packageName)} must depend on ${
                            markPackageName(dependencyName)} version ${
                            markVersion(enforcedDependencyRange)} via ${
                            markType(dependencyType)}, but depends on version ${
                            markVersion(actualDependencyRange)} instead`;
                      } else {
                        logError`${markPackageName(packageName)} must depend on ${
                            markPackageName(dependencyName)} version ${
                            markVersion(enforcedDependencyRange)} via ${
                            markType(dependencyType)}, but doesn't`;
                      }
                    }
                  } else {
                    if (actualDependencyRange != null) {
                      logError`${markPackageName(packageName)} has an extraneous dependency on ${
                          markPackageName(dependencyName)} via ${markType(dependencyType)}`;
                    }
                  }
                }
              });

          await processor.invalidDependencies.pipe(groupByPackage())
              .forEach(invalidDependencies => {
                const {packageName} = invalidDependencies[0];
                const packageInfo = workspaceInfo[packageName];

                for (const {dependencyName, dependencyType, reason} of sortInvalidDependencies(
                         invalidDependencies)) {
                  const deps = packageInfo[dependencyType];
                  const dependencyDescriptor = deps && deps[dependencyName];

                  if (dependencyDescriptor) {
                    logError`${markPackageName(packageName)} has an invalid dependency on ${
                        markPackageName(dependencyName)} via ${
                        markType(dependencyType)} (invalid because ${markReason(String(reason))})`;
                  }
                }
              });

          if (errorCount > 0) {
            console.error(`Found ${markError(`${errorCount} errors`)}`);
            return 1;
          } else {
            console.error(`No errors found`);
            return 0;
          }
        });
