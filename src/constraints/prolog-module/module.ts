import * as pl from 'tau-prolog';

import {DependencyType} from '../constants';
import {and, replaceGoal, rule, term, termEquals, variable} from './util';
import {getWorkspaceInfo} from './workspace-info';

let registeredModule: pl.type.Module|null = null;

export function getModuleName(): string {
  if (registeredModule == null) {
    registerModule();
  }

  return registeredModule!.id;
}

function registerModule() {
  const {is_atom, is_variable} = pl.type;

  const predicates: Record<string, pl.type.Predicate> = {
    'dependency_type/1': [
      rule(term('dependency_type', [term(DependencyType.Dependencies)])),
      rule(term('dependency_type', [term(DependencyType.DevDependencies)])),
      rule(term('dependency_type', [term(DependencyType.PeerDependencies)])),
    ],

    'package/1': (thread, point, atom) => {
      const [packageName] = atom.args;

      if (is_atom(packageName)) {
        if (getWorkspaceInfo(thread).packages.has(packageName.id)) {
          thread.success(point);
        }

        return;
      }

      if (!is_variable(packageName)) {
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
      rule(
          term('package_version', [variable('PackageName'), variable('PackageVersion')]),
          term(
              'package_field',
              [variable('PackageName'), term('version'), variable('PackageVersion')]),
          ),
    ],

    'package_location/2': (thread, point, atom) => {
      const [packageName, packageLocation] = atom.args;

      if (is_variable(packageName)) {
        if (!is_atom(packageLocation)) {
          thread.throw_error(pl.error.instantiation(atom.indicator));
          return;
        }

        const foundByLocation = Array.from(getWorkspaceInfo(thread).packages.values())
                                    .find(pkg => pkg.location === packageLocation.id);

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
      rule(
          term(
              'package_has_dependency',
              [
                variable('PackageName'),
                variable('DependencyName'),
                variable('DependencyVersion'),
                variable('DependencyType'),
              ]),
          and(
              term('package', [variable('PackageName')]),
              term('dependency_type', [variable('DependencyType')]),
              term(
                  'internal_package_has_dependency',
                  [
                    variable('PackageName'),
                    variable('DependencyName'),
                    variable('DependencyVersion'),
                    variable('DependencyType'),
                  ]),
              ),
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
            const goal = term(',', [
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
