import chalk from 'chalk';
import * as path from 'path';

import {Constraints} from '../constraints';
import {writeFile} from '../util';
import {getWorkspace} from '../workspace';

export default (concierge: any) =>
    concierge
        .command(`generate [output-file]`)

        .describe(`generate the full constraints file`)

        .detail(`
  This command will generate the full constraints prolog file for the workspace.

  This allows for easy debugging by inspecting the file or by querying it.

  For more information as to how to write constraints, please consult our manual: TODO.
`)

        .example(`Generate the full constraints`, `yarn constraints generate`)
        .example(
            `Generate the full constraints and store to the file called "full-constraints.pl"`,
            `yarn constraints generate full-constraints.pl`)

        .action(async ({outputFile}: {outputFile?: string}) => {
          const cwd = process.cwd();

          const workspaceInfo = await getWorkspace(cwd).toPromise();
          const constraints = new Constraints(cwd, workspaceInfo);

          const fullSource = await constraints.getFullSource();

          if (!outputFile) {
            console.log(fullSource);
          } else {
            await writeFile(path.resolve(outputFile), fullSource);

            console.error(`Generated full source at ${chalk.bold.hex('#009985')(outputFile)}`);
          }
        });
