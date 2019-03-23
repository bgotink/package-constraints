import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../workspace';
import {DependencyType} from './constants';

let registeredModule: pl.type.Module|null = null;

const workspaces = new WeakMap<pl.type.Session, WorkspaceInfo>();

export function getWorkspaceInfo(thread: pl.type.Thread): WorkspaceInfo {
  return workspaces.get(thread.session)!;
}

export function registerModule(session: pl.type.Session) {
  if (registeredModule == null) {
    const {is_atom, is_variable} = pl.type;

    const predicates: Record<string, pl.type.Predicate> = {
      'dependency_type/1': [
        new pl.type.Rule(new pl.type.Term('dependency_type', [new pl.type.Term(DependencyType.Dependencies)]), null),
        new pl.type.Rule(new pl.type.Term('dependency_type', [new pl.type.Term(DependencyType.DevDependencies)]), null),
        new pl.type.Rule(new pl.type.Term('dependency_type', [new pl.type.Term(DependencyType.PeerDependencies)]), null),
      ],

      'package/1': (thread, point, atom) => {
        const [packageName] = atom.args;

        if (is_atom(packageName)) {
          if (getWorkspaceInfo(thread).packages.has(packageName.id)) {
            thread.success(point);
          }

          return;
        }

        if (!is_variable) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
          return;
        }

        thread.prepend(
            Array.from(
                getWorkspaceInfo(thread).packages.keys(),
                name => {
                  const goal = termEquals(packageName, name);
                  return replaceGoal(point, goal);
                }),
        );
      },

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

        if (!(fieldName.id in workspace.manifest)) {
          // Field is not present => this predicate can never match
          return;
        }

        const goal = termEquals(fieldValue, String((workspace.manifest as any)[fieldName.id]));
        thread.prepend([replaceGoal(point, goal)]);
      },

      'package_version/2': [
        new pl.type.Rule(
            new pl.type.Term(
                'package_version',
                [new pl.type.Var('PackageName'), new pl.type.Var('PackageVersion')]),
            new pl.type.Term(
                'package_field',
                [
                  new pl.type.Var('PackageName'),
                  new pl.type.Term('version'),
                  new pl.type.Var('PackageVersion')
                ]),
            ),
      ],

      'package_location/2': (thread, point, atom) => {
        const [packageName, packageLocation] = atom.args;

        if (is_variable(packageName)) {
          if (!is_atom(packageLocation)) {
            thread.throw_error(pl.error.instantiation(atom.indicator));
            return;
          }

          const foundByLocation = Array.from(getWorkspaceInfo(thread).packages.values()).find(pkg => pkg.location ===  packageLocation.id);

          if (foundByLocation != null) {
            const goal = termEquals(packageName, foundByLocation.packageName);
            thread.prepend([
              replaceGoal(point, goal),
            ]);
          }

          return;
        }

        if (!is_atom(packageName) || !(is_atom(packageLocation) || is_variable(packageLocation))) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
          return;
        }

        const workspaceInfo = getWorkspaceInfo(thread).packages.get(packageName.id);

        if (workspaceInfo == null) {
          return;
        }

        const goal = termEquals(packageLocation, workspaceInfo.location);
        thread.prepend([
          replaceGoal(point, goal),
        ]);
      },

      'package_has_dependency/4': [
        new pl.type.Rule(
          new pl.type.Term('package_has_dependency', [
            new pl.type.Var('PackageName'),
            new pl.type.Var('DependencyName'),
            new pl.type.Var('DependencyVersion'),
            new pl.type.Var('DependencyType'),
          ]),
          new pl.type.Term(',', [
            new pl.type.Term('package', [new pl.type.Var('PackageName')]),
            new pl.type.Term(',', [
              new pl.type.Term('dependency_type', [new pl.type.Var('DependencyType')]),
              new pl.type.Term('internal_package_has_dependency', [
                new pl.type.Var('PackageName'),
                new pl.type.Var('DependencyName'),
                new pl.type.Var('DependencyVersion'),
                new pl.type.Var('DependencyType'),
              ]),
            ]),
          ]),
        ),
      ],

      'internal_package_has_dependency/4': (thread, point, atom) => {
        const [packageName, dependencyName, dependencyVersion, dependencyType] = atom.args;

        if (!is_atom(packageName) || !is_atom(dependencyType)) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
          return;
        }

        const workspaceInfo = getWorkspaceInfo(thread).packages.get(packageName.id)!;
        const registeredDependencies = workspaceInfo.manifest[dependencyType.id as DependencyType];

        if (registeredDependencies == null) {
          return;
        }

        if (is_atom(dependencyName)) {
          if (dependencyName.id in registeredDependencies) {
            const goal = termEquals(dependencyVersion, registeredDependencies[dependencyName.id]);
            thread.prepend([
              replaceGoal(point, goal),
            ]);
          }

          return;
        }

        if (!is_variable(dependencyName)) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
        }

        thread.prepend(
          Object.entries(registeredDependencies).map(([name, version]) => {
            const goal = new pl.type.Term(',', [
              termEquals(dependencyName, name),
              termEquals(dependencyVersion, version),
            ]);
            return replaceGoal(point, goal);
          }),
        );
      },

      'root_package/1': (thread, point, atom) => {
        const [rootPackageName] = atom.args;

        const goal = termEquals(rootPackageName, getWorkspaceInfo(thread).rootPackageName);
        thread.prepend([
          replaceGoal(point, goal),
        ]);
      },
    };

    const exports = [
      'dependency_type/1',
      'package/1',
      'package_field/3',
      'package_version/2',
      'package_location/2',
      'package_has_dependency/4',
      'root_package/1',
    ];

    registeredModule = new pl.type.Module('constraints', predicates, exports);
  }

  session.consult(':- use_module(library(constraints)).');
}

export function setWorkspacesInfo(session: pl.type.Session, workspaceInfo: WorkspaceInfo): void {
  workspaces.set(session, workspaceInfo);
}

// helpers

function termEquals(lhs: pl.type.Value, rhs: pl.type.Value|string): pl.type.Term<2, '=/2'> {
  if (typeof rhs === 'string') {
    rhs = new pl.type.Term(rhs);
  }

  return new pl.type.Term('=', [lhs, rhs]);
}

function replaceGoal(state: pl.type.State, goal: pl.type.Term<number, string>): pl.type.State {
  return new pl.type.State(state.goal.replace(goal), state.substitution, state);
}
