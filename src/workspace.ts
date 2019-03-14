import * as execa from 'execa';
import * as findUp from 'find-up';
import * as fs from 'fs';
import * as JSON from 'json5';
import * as path from 'path';
import {defer, forkJoin, from, Observable} from 'rxjs';
import {map, mapTo, mergeMap, tap} from 'rxjs/operators';

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
  [packageName: string]: PackageInfo;
}

export interface Dependencies {
  [packageName: string]: string;
}

interface PackageJson {
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

function readJson(filepath: string): Promise<PackageJson> {
  return new Promise<PackageJson>((resolve, reject) => {
    fs.readFile(filepath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(String(result)));
      }
    });
  });
}

async function getWorkspaceRoot(cwd: string): Promise<string> {
  let currentDirectory = cwd;

  while (true) {
    const packageJsonPath = await findUp('package.json', {cwd: currentDirectory});

    if (packageJsonPath == null) {
      throw new Error(`Unable to find workspace root`);
    }

    const packageJsonDir = path.dirname(packageJsonPath);
    const packageJson = await readJson(packageJsonPath);

    if (packageJson.workspaces) {
      return packageJsonDir;
    } else {
      currentDirectory = path.dirname(packageJsonDir);
    }
  }
}

export function getWorkspace(cwd: string): Observable<WorkspaceInfo> {
  return forkJoin(
             execYarn(['workspaces', 'info'], cwd)
                 .pipe(map(result => JSON.parse(result) as WorkspaceInfo), tap(result => {
                         for (const packageName of Object.keys(result)) {
                           result[packageName].packageName = packageName;
                         }
                       })),
             from(getWorkspaceRoot(cwd)),
             )
      .pipe(
          mergeMap(
              ([result, workspaceRoot]) =>
                  forkJoin(
                      ...Object.keys(result).map(
                          packageName =>
                              from(
                                  readJson(path.resolve(
                                      workspaceRoot, result[packageName].location, 'package.json')))
                                  .pipe(tap(packageJson => {
                                    result[packageName].version = packageJson.version;
                                    result[packageName].dependencies = packageJson.dependencies;
                                    result[packageName].peerDependencies =
                                        packageJson.peerDependencies;
                                    result[packageName].devDependencies =
                                        packageJson.devDependencies;
                                  })),
                          ),
                      )
                      .pipe(mapTo(result))),
      );
}
