import {Constraints, EnforcedDependencyRange, InvalidDependency} from '../constraints';
import {StdioFormatter} from '../formatters/stdio';
import {createSort, groupByPackage} from '../util';
import {getWorkspace} from '../workspace';

const sortEnforcedDependencyRanges = createSort<EnforcedDependencyRange>(
    ({dependencyRange}) => dependencyRange != null ? 0 : 1,
    ({dependencyName}) => dependencyName,
);
const sortInvalidDependencies = createSort<InvalidDependency>(
    ({dependencyName}) => dependencyName,
);

interface Options {
  withExitCode: boolean;
}

export default (concierge: any) =>
    concierge
        .command(`check [--without-exit-code]`)

        .describe(`check that the constraints are met`)

        .detail(`
  This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

  For more information as to how to write constraints, please consult our manual: TODO.
`)

        .example(
            `Checks that all constraints are satisfied`,
            `yarn constraints check`,
            )

        .action(async (options: Options) => {
          const cwd = process.cwd();

          const workspaceInfo = await getWorkspace(cwd).toPromise();
          const constraints = new Constraints(cwd, workspaceInfo);
          const processor = await constraints.process();

          let hasError = false;
          const formatter = new StdioFormatter();

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
                        hasError = true;
                        formatter.markInvalidDependencyVersion(
                            packageName,
                            dependencyType,
                            dependencyName,
                            enforcedDependencyRange,
                            actualDependencyRange);
                      } else {
                        hasError = true;
                        formatter.markMissingDependency(
                            packageName, dependencyType, dependencyName, enforcedDependencyRange);
                      }
                    }
                  } else {
                    if (actualDependencyRange != null) {
                      hasError = true;
                      formatter.markExtraneousDependency(
                          packageName, dependencyType, dependencyName, actualDependencyRange);
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
                    hasError = true;
                    formatter.markInvalidDependency(
                        packageName, dependencyType, dependencyName, String(reason));
                  }
                }
              });

          if (options.withExitCode && hasError) {
            return 1;
          } else {
            return 0;
          }
        });
