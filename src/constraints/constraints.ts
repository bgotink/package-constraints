import * as path from 'path';

import {readFile} from '../util';
import {WorkspaceInfo} from '../workspace';

import {ConstraintProcessor} from './constraint-processor';

async function loadConstraints(directory: string) {
  for (const filename of ['constraints.pl', 'constraints.pro']) {
    let filepath = path.join(directory, filename);

    try {
      return await readFile(filepath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
  }

  throw new Error(`Couldn't find constraints.pl or constraints.pro to load in ${directory}`);
}

export class Constraints {
  public readonly source: Promise<string>;

  constructor(project: string, private readonly workspace: WorkspaceInfo) {
    this.source = loadConstraints(project);
  }

  getDeclarations(): string {
    const declarations: string[] = [];

    function consult(tpl: TemplateStringsArray, ...values: any[]): void {
      declarations.push(String.raw(tpl, ...values).trim());
    }

    // (Cwd, DependencyIdent, DependencyRange, DependencyType)
    consult`gen_enforced_dependency_range(_, _, _, _) :- false.`;

    // (Cwd, DependencyIdent, DependencyType, Reason)
    consult`gen_invalid_dependency(_, _, _, _) :- false.`;

    return declarations.join('\n');
  }

  async getFullSource(): Promise<string> {
    return await this.source + `\n` + this.getDeclarations() + '\n';
  }

  async process() {
    return new ConstraintProcessor(this.workspace, await this.getFullSource());
  }
}
