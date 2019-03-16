import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import {Constraints} from '../constraints';
import {getWorkspace} from '../workspace';

function writeFile(filepath: string, content: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filepath, content, err => err ? reject(err) : resolve());
  });
}

export default (concierge: any) =>
    concierge
        .command(`generate [-o,--out-file FILE]`)

        .describe(`generate the full constraints file`)

        .detail(`
  This command will generate the full constraints prolog file for the workspace.

  This allows for easy debugging by inspecting the file or by querying it.

  For more information as to how to write constraints, please consult our manual: TODO.
`)

        .example(
            `Generate the full constraints file`,
            `yarn constraints generate full-constraints.pl`,
            )

        .action(async ({outFile}: {outFile?: string}) => {
          const cwd = process.cwd();

          const workspaceInfo = await getWorkspace(cwd).toPromise();
          const constraints = new Constraints(cwd, workspaceInfo);

          const fullSource = await constraints.getFullSource();

          if (!outFile) {
            console.log(fullSource);
          } else {
            await writeFile(path.resolve(outFile), fullSource);

            console.error(`Generated full source at ${chalk.bold.hex('#00afaf')(outFile)}`);
          }
        });
