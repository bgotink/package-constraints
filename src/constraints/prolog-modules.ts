import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../workspace';

import {
  MODULE_NAME as CONSTRAINTS_MODULE_NAME,
  registerModule as registerConstraintsModule,
} from './prolog-modules/module-constraints';
import {setWorkspaceInfo} from './prolog-modules/workspace-info';

export function registerModules(session: pl.type.Session, workspaceInfo: WorkspaceInfo) {
  registerConstraintsModule();

  session.consult(`:- use_module(library(${CONSTRAINTS_MODULE_NAME})).`);
  setWorkspaceInfo(session, workspaceInfo);
}
