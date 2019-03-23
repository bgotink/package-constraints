import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../workspace';

let registeredModule: pl.type.Module|null = null;

const workspaces = new WeakMap<pl.type.Session, WorkspaceInfo>();

export function getWorkspaceInfo(thread: pl.type.Thread): WorkspaceInfo {
  return workspaces.get(thread.session)!;
}

export function registerModule(session: pl.type.Session) {
  if (registeredModule == null) {
    const {is_atom} = pl.type;

    const predicates: Record<string, pl.type.Predicate> = {
      'package_field/3': (thread, point, atom) => {
        const [packageName, fieldName, fieldValue] = atom.args;

        if (!is_atom(packageName) || !is_atom(fieldName)) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
          return;
        }

        const workspace = getWorkspaceInfo(thread).packages.get(packageName.id);

        if (workspace == null) {
          // Workspace not found => this predicate can never match
          // We might want to throw here? We can be pretty sure the user did something wrong at this
          // point
          return;
        }

        const manifestValue = (workspace.manifest as any)[fieldName.id];

        const goal = new pl.type.Term('=', [fieldValue, new pl.type.Term(manifestValue)]);
        thread.prepend([new pl.type.State(point.goal.replace(goal), point.substitution, point)]);
      },
    };

    const exports = [
      'package_field/3',
    ];

    registeredModule = new pl.type.Module('constraints', predicates, exports);
  }

  session.consult(':- use_module(library(constraints)).');
}

export function setWorkspacesInfo(session: pl.type.Session, workspaceInfo: WorkspaceInfo): void {
  workspaces.set(session, workspaceInfo);
}
