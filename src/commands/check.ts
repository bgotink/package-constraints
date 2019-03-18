import {createWriteStream} from 'fs-extra';
import {Writable} from 'stream';

import {Constraints, EnforcedDependencyRange, InvalidDependency} from '../constraints';
import {CombineFormatter} from '../formatters/combine';
import {Formatter} from '../formatters/formatter';
import {StdioFormatter} from '../formatters/stdio';
import {TapFormatter} from '../formatters/tap';
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
  cwd?: string;

  withExitCode: boolean;

  outputFile?: string[];

  quiet: boolean;

  stdout: Writable;

  format?: string;

  stderr: Writable;
}

function createFormatterForFormat(
    format: string|null|undefined, pipeableOutfile: () => Writable, outfile: () => Writable):
    Formatter {
  switch (format) {
    case 'tap':
      return new TapFormatter(pipeableOutfile());
    case undefined:
    case null:
      return new StdioFormatter(outfile());
    default:
      throw new Error(`Invalid format "${format}"`);
  }
}

function createFormatter(options: Options): Formatter {
  const formatters: Formatter[] = [];

  if (!options.quiet) {
    formatters.push(
        createFormatterForFormat(options.format, () => options.stdout, () => options.stderr));
  }

  if (options.outputFile != null) {
    for (const outFile of options.outputFile) {
      let format: string|null = null;
      let filename = outFile;

      const match = outFile.match(/^([^:]+):(.*)$/);
      if (match) {
        ([, format, filename] = match);
      }

      const createOutput = () => createWriteStream(filename);

      formatters.push(createFormatterForFormat(format, createOutput, createOutput));
    }
  }

  return new CombineFormatter(formatters);
}

export default (concierge: any) =>
    concierge
        .command(
            `check [--cwd CWD] [--without-exit-code] [-q,--quiet] [-f,--format FORMAT] [-o,--output-file FILE...]`)

        .describe(`check that the constraints are met`)

        .detail(`
  This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

  For more information as to how to write constraints, please consult our manual: TODO.
`)

        .example(`Check all constraints and log errors to stderr`, `yarn constraints check`)
        .example(
            `Check all constraints and output as TAP, then transform that to JUnit results xml`,
            `yarn constraints check --format tap | npx tap-junit`)

        .action(async (options: Options) => {
          const cwd = options.cwd || process.cwd();

          const workspaceInfo = await getWorkspace(cwd).toPromise();
          const constraints = new Constraints(cwd, workspaceInfo);
          const processor = await constraints.process();

          let hasError = false;
          const formatter = createFormatter(options);

          await processor.enforcedDependencyRanges.pipe(groupByPackage())
              .forEach(enforcedDependencyRanges => {
                const {packageName} = enforcedDependencyRanges[0];
                const packageInfo = workspaceInfo.packages.get(packageName)!;

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
                    } else {
                      formatter.markValidDependency(
                          packageName, dependencyType, dependencyName, enforcedDependencyRange);
                    }
                  } else {
                    if (actualDependencyRange != null) {
                      hasError = true;
                      formatter.markExtraneousDependency(
                          packageName, dependencyType, dependencyName, actualDependencyRange);
                    } else {
                      formatter.markValidDependency(
                          packageName, dependencyType, dependencyName, null);
                    }
                  }
                }
              });

          await processor.invalidDependencies.pipe(groupByPackage())
              .forEach(invalidDependencies => {
                const {packageName} = invalidDependencies[0];
                const packageInfo = workspaceInfo.packages.get(packageName)!;

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

          formatter.complete();
          if (options.withExitCode && hasError) {
            return 1;
          } else {
            return 0;
          }
        });
