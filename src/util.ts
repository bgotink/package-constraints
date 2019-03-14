import {MonoTypeOperatorFunction} from 'rxjs';
import {map} from 'rxjs/operators';

// Source: berry, miscUtils.ts, &copy; Yarn contributors, BSD 2-Clause License

// This function transforms an iterable into an array and sorts it according to
// the mapper functions provided as parameter. The mappers are expected to take
// each element from the iterable and generate a string from it, that will then
// be used to compare the entries.
//
// Using sortMap is more efficient than kinda reimplementing the logic in a sort
// predicate because sortMap caches the result of the mappers in such a way that
// they are guaranteed to be executed exactly once for each element.

export function sortMap<T>(mappers: ((value: T) => string)|
                           Array<(value: T) => string>): MonoTypeOperatorFunction<Array<T>> {
  return map(values => {
    if (!Array.isArray(mappers)) {
      mappers = [mappers];
    }

    const stringified: Array<Array<string>> = [];

    for (const mapper of mappers) {
      stringified.push(values.map(value => mapper(value)));
    }

    const indices = values.map((_, index) => index);

    indices.sort((a, b) => {
      for (const layer of stringified) {
        const comparison = layer[a] < layer[b] ? -1 : layer[a] > layer[b] ? +1 : 0;

        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    });

    return indices.map(index => {
      return values[index];
    });
  });
}
