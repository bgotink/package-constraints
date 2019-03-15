import chalk from 'chalk';

import {Constraints} from '../constraints';
import {getWorkspace} from '../workspace';

const markPackageName = chalk.hex('#d7875f');
const markPackageScope = chalk.hex('#d75f00');
function markPackageIdent(packageIdent: string): string {
  const scopeMatch = packageIdent.match(/^(@[^/]+)\/(.*)$/);
  if (scopeMatch != null) {
    return markPackageScope(`${scopeMatch[1]}/`) + markPackageName(scopeMatch[2]);
  } else {
    return markPackageName(packageIdent);
  }
}
const markVersion = chalk.bold.hex('#00afaf');
const markReason = chalk.bold;

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

          let hasError = false;

          await processor.enforcedDependencyRanges.forEach(
              ({packageName, dependencyName, dependencyRange, dependencyType}) => {
                const deps = workspaceInfo[packageName][dependencyType];
                const descriptor = deps && deps[dependencyName];

                if (dependencyRange !== null) {
                  if (!descriptor) {
                    hasError = true;
                    console.error(`${markPackageIdent(packageName)} must depend on ${
                        markPackageIdent(dependencyName)} version ${
                        markVersion(dependencyRange)} via ${dependencyType}, but doesn't`);
                  } else {
                    if (descriptor !== dependencyRange) {
                      hasError = true;
                      console.error(`${markPackageIdent(packageName)} must depend on ${
                          markPackageIdent(
                              dependencyName)} version ${markVersion(dependencyRange)}, but uses ${
                          markVersion(descriptor)} instead`);
                    }
                  }
                } else {
                  if (descriptor) {
                    hasError = true;
                    console.error(
                        `${markPackageIdent(packageName)} has an extraneous dependency on ${
                            markPackageIdent(dependencyName)}`);
                  }
                }
              });

          await processor.invalidDependencies.forEach(
              ({packageName, dependencyName, dependencyType, reason}) => {
                const deps = workspaceInfo[packageName][dependencyType];
                const dependencyDescriptor = deps && deps[dependencyName];

                if (dependencyDescriptor) {
                  hasError = true;
                  console.error(`${markPackageIdent(packageName)} has an invalid dependency on ${
                      markPackageIdent(
                          dependencyName)} (invalid because ${markReason(String(reason))})`);
                }
              });

          return hasError ? 1 : 0;
        });
