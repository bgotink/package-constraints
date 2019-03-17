import * as execa from 'execa';
import * as findUp from 'find-up';
import * as JSON from 'json5';
import * as path from 'path';
import {defer, forkJoin, from, Observable} from 'rxjs';
import {flatMap, map, mapTo, mergeMap, tap} from 'rxjs/operators';

import {readFile} from './util';

export interface YarnPackageInfo {
  location: string;

  workspaceDependencies: string[];

  mismatchedWorkspaceDependencies: string[];
}

export interface YarnWorkspaceInfo {
  [packageName: string]: YarnPackageInfo;
}

export interface PackageInfo {
  packageName: string;

  version: string;

  location: string;

  workspaceDependencies: string[];

  mismatchedWorkspaceDependencies: string[];

  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  peerDependencies?: Dependencies;
}

export interface WorkspaceInfo {
  rootPackageName: string;
  workspaceDirectory: string;

  packages: Map<string, PackageInfo>;
}

export interface Dependencies {
  [packageName: string]: string;
}

interface PackageJson {
  name: string;
  version: string;

  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  peerDependencies?: Dependencies;

  workspaces?: string[];
}

function execYarn(args: string[], cwd: string): Observable<string> {
  return defer(
             () =>
                 execa('yarn', ['--silent', ...args], {cwd, stdio: ['ignore', 'pipe', 'inherit']}))
      .pipe(map(result => result.stdout));
}

async function readJson(filepath: string): Promise<PackageJson> {
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
            .pipe(map(({name, version, dependencies, devDependencies, peerDependencies}) => {
              const rootPackageName = name || `<workspace root>`;

              return {
                workspaceDirectory: workspaceRoot,
                rootPackageName,
                packages: (new Map<string, PackageInfo>()).set(rootPackageName, {
                  packageName: rootPackageName,
                  version,

                  location: '.',

                  workspaceDependencies: [],
                  mismatchedWorkspaceDependencies: [],

                  peerDependencies,
                  dependencies,
                  devDependencies,
                }),
              } as WorkspaceInfo;
            }));

    if (!isWorkspace) {
      return workspaceInfo;
    }

    return forkJoin(
               workspaceInfo,
               execYarn(['workspaces', 'info'], workspaceRoot)
                   .pipe(map(result => JSON.parse(result) as YarnWorkspaceInfo)),
               )
        .pipe(mergeMap(([workspaceInfo, yarnWorkspaceInfo]) => {
          return forkJoin(
                     ...Object.keys(yarnWorkspaceInfo).map(packageName => {
                       const yarnPackageInfo = yarnWorkspaceInfo[packageName];

                       return from(readJson(path.resolve(
                                       workspaceRoot, yarnPackageInfo.location, 'package.json')))
                           .pipe(tap(packageJson => {
                             const packageInfo: PackageInfo = {
                               packageName,
                               version: packageJson.version,

                               location: yarnPackageInfo.location,
                               workspaceDependencies: yarnPackageInfo.workspaceDependencies,
                               mismatchedWorkspaceDependencies:
                                   yarnPackageInfo.mismatchedWorkspaceDependencies,

                               peerDependencies: packageJson.peerDependencies,
                               dependencies: packageJson.dependencies,
                               devDependencies: packageJson.devDependencies,
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
