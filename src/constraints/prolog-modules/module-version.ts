import * as semver from 'semver';
import * as pl from 'tau-prolog';

import {replaceGoal, termEquals} from './prolog-util';

let registeredModule: pl.type.Module|null = null;

export const MODULE_NAME = 'version';

export function registerModule() {
  if (registeredModule != null) {
    return;
  }

  const {is_atom} = pl.type;

  const predicates: Record<string, pl.type.Predicate> = {
    'version_matches/2': (thread, point, atom) => {
      const [range, version] = atom.args;

      if (!is_atom(range) || !is_atom(version)) {
        thread.throw_error(pl.error.instantiation(atom.indicator));
        return;
      }

      if (semver.satisfies(version.id, range.id)) {
        thread.success(point);
      }
    },

    'version_minimum/2': (thread, point, atom) => {
      const [range, version] = atom.args;

      if (!is_atom(range)) {
        thread.throw_error(pl.error.instantiation(atom.indicator));
        return;
      }

      const minVersion = semver.minVersion(range.id);
      thread.prepend([
        replaceGoal(point, termEquals(version, minVersion.raw)),
      ]);
    },
  };

  const moduleExports = [
    'version_matches/2',
    'version_minimum/2',
  ];

  registeredModule = new pl.type.Module(MODULE_NAME, predicates, moduleExports);
}
