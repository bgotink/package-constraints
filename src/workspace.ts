import * as execa from 'execa';
import * as findUp from 'find-up';
import * as JSON from 'json5';
import * as path from 'path';
import {defer, forkJoin, from, Observable} from 'rxjs';
import {flatMap, map, mapTo, mergeMap, tap} from 'rxjs/operators';

import {readFile} from './util';

interface YarnWorkspaceInfo {
  location: string;

  workspaceDependencies: string[];

  mismatchedWorkspaceDependencies: string[];
}

interface YarnWorkspacesInfo {
  [packageName: string]: YarnWorkspaceInfo;
}

export interface PackageInfo extends YarnWorkspaceInfo {
  packageName: string;

  manifest: PackageManifest;
}

export interface WorkspaceInfo {
  rootPackageName: string;
  workspaceDirectory: string;

  packages: Map<string, PackageInfo>;
}

export interface Dependencies {
  [packageName: string]: string;
}

export interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;

  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  peerDependencies?: Dependencies;

  workspaces?: string[];
}

function execYarn(args: string[], cwd: string): Observable<string> {
  return defer(() => execa('yarn', ['--silent', ...args], {
                 cwd,
                 stdio: ['ignore', 'pipe', 'inherit'],
                 env: {
                   // Set FORCE_COLOR to 0 to force the spawned yarn's chalk to not use colours. Our
                   // environment might contain FORCE_COLOR=1 (e.g. when in an environment that
                   // chalk doesn't recognize as "supports colour"). We can not have colouring in
                   // the JSON as we need to parse it.
                   FORCE_COLOR: '0',
                 },
               }))
      .pipe(map(result => result.stdout));
}

async function readJson(filepath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(filepath, 'utf8'));
}

async function getWorkspaceRoot(cwd: string) {
  let currentDirectory = cwd;
  let firstPackage: string|null = null;

  while (true) {
    const packageJsonPath = await findUp('package.json', {cwd: currentDirectory});

    if (firstPackage == null) {
      firstPackage = packageJsonPath;
    }

    if (packageJsonPath == null) {
      if (firstPackage != null) {
        // Not in a workspace, just use the first found package.json
        return {workspaceRoot: path.dirname(firstPackage), isWorkspace: false};
      }

      throw new Error(`Unable to find workspace root`);
    }

    const packageJsonDir = path.dirname(packageJsonPath);
    const packageJson = await readJson(packageJsonPath);

    if (packageJson.workspaces) {
      return {workspaceRoot: packageJsonDir, isWorkspace: true};
    } else {
      currentDirectory = path.dirname(packageJsonDir);
    }
  }
}

export function getWorkspace(cwd: string): Observable<WorkspaceInfo> {
  return from(getWorkspaceRoot(cwd)).pipe(flatMap(({workspaceRoot, isWorkspace}) => {
    const workspaceInfo =
        from(readJson(path.resolve(workspaceRoot, 'package.json')))
            .pipe(map((rootPackageManifest) => {
              const rootPackageName = rootPackageManifest.name || `<workspace root>`;

              return {
                workspaceDirectory: workspaceRoot,
                rootPackageName,
                packages: (new Map<string, PackageInfo>()).set(rootPackageName, {
                  packageName: rootPackageName,
                  location: '.',

                  workspaceDependencies: [],
                  mismatchedWorkspaceDependencies: [],

                  manifest: rootPackageManifest,
                }),
              } as WorkspaceInfo;
            }));

    if (!isWorkspace) {
      return workspaceInfo;
    }

    return forkJoin(
               workspaceInfo,
               execYarn(['workspaces', 'info'], workspaceRoot)
                   .pipe(map(result => JSON.parse(result) as YarnWorkspacesInfo)),
               )
        .pipe(mergeMap(([workspaceInfo, yarnWorkspaceInfo]) => {
          return forkJoin(
                     ...Object.keys(yarnWorkspaceInfo).map(packageName => {
                       const yarnPackageInfo = yarnWorkspaceInfo[packageName];

                       return from(readJson(path.resolve(
                                       workspaceRoot, yarnPackageInfo.location, 'package.json')))
                           .pipe(tap(manifest => {
                             const packageInfo: PackageInfo = {
                               ...yarnPackageInfo,

                               packageName,
                               manifest,
                             };

                             workspaceInfo.packages.set(packageName, packageInfo);
                           }));
                     }),
                     )
              .pipe(
                  mapTo(workspaceInfo),
              );
        }));
  }));
}
