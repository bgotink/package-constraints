import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../workspace';

import {getModuleName} from './prolog-module/module';
import {setWorkspaceInfo} from './prolog-module/workspace-info';

export function registerModule(session: pl.type.Session, workspaceInfo: WorkspaceInfo) {
  session.consult(`:- use_module(library(${getModuleName()})).`);
  setWorkspaceInfo(session, workspaceInfo);
}
