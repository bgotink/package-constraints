import {Constraints} from './constraints';
import {getWorkspace} from './workspace';

export async function processConstraints(path: string) {
  const workspaceInfo = await getWorkspace(path).toPromise();

  return new Constraints(path, workspaceInfo).process();
}
