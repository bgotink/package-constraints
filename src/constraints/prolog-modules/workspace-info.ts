import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../../workspace';

const workspaces = new WeakMap<pl.type.Session, WorkspaceInfo>();

export function getWorkspaceInfo(thread: pl.type.Thread): WorkspaceInfo {
  return workspaces.get(thread.session)!;
}

export function setWorkspaceInfo(session: pl.type.Session, workspaceInfo: WorkspaceInfo): void {
  workspaces.set(session, workspaceInfo);
}
