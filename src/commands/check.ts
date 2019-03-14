import chalk from 'chalk';

import {Constraints} from '../constraints';
import {getWorkspace, PackageInfo} from '../workspace';

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
          const result = await constraints.process();

          function getPackageInfo(workspaceLocation: string): PackageInfo {
            return Object.values(workspaceInfo)
                .find(packageInfo => packageInfo.location === workspaceLocation)!;
          }

          let hasError = false;

          for (const {workspaceLocation,
                      dependencyIdent,
                      dependencyRange,
                      dependencyType} of result.enforcedDependencyRanges) {
            const workspaceName = getPackageInfo(workspaceLocation).packageName;
            const deps = getPackageInfo(workspaceLocation)[dependencyType];
            const descriptor = deps && deps[dependencyIdent];

            if (dependencyRange !== null) {
              if (!descriptor) {
                hasError = true;
                console.error(`${markPackageIdent(workspaceName)} must depend on ${
                    markPackageIdent(dependencyIdent)} version ${
                    markVersion(dependencyRange)} via ${dependencyType}, but doesn't`);
              } else {
                if (descriptor !== dependencyRange) {
                  hasError = true;
                  console.error(`${markPackageIdent(workspaceName)} must depend on ${
                      markPackageIdent(dependencyIdent)} version ${
                      markVersion(dependencyRange)}, but uses ${markVersion(descriptor)} instead`);
                }
              }
            } else {
              if (descriptor) {
                hasError = true;
                console.error(`${markPackageIdent(workspaceName)} has an extraneous dependency on ${
                    markPackageIdent(dependencyIdent)}`);
              }
            }
          }

          for (const {workspaceLocation,
                      dependencyIdent,
                      dependencyType,
                      reason} of result.invalidDependencies) {
            const workspaceName = getPackageInfo(workspaceLocation).packageName;
            const deps = getPackageInfo(workspaceLocation)[dependencyType];
            const dependencyDescriptor = deps && deps[dependencyIdent];

            if (dependencyDescriptor) {
              hasError = true;
              console.error(`${markPackageIdent(workspaceName)} has an invalid dependency on ${
                  markPackageIdent(
                      dependencyIdent)} (invalid because ${markReason(String(reason))})`);
            }
          }

          return hasError ? 1 : 0;
        });
