import {Observable, OperatorFunction} from 'rxjs';

export {readFile, writeFile} from 'fs-extra';

export function groupByPackage<T extends {packageName: string}>():
    OperatorFunction<T, [T, ...T[]]> {
  return source => new Observable(observer => {
           let values: T[] = [];
           let packageName: string|null = null;

           function emit() {
             if (values.length > 0) {
               observer.next(values as [T, ...T[]]);
             }

             values = [];
           }

           return source.subscribe({
             next: value => {
               if (value.packageName !== packageName) {
                 emit();
                 packageName = value.packageName;
               }

               values.push(value);
             },
             error: e => observer.error(e),
             complete: () => {
               emit();
               observer.complete();
             }
           });
         });
}

export type Primitive = number|string|boolean;

export function createSort<T>(...mappers: ((value: T) => Primitive)[]) {
  return (values: Iterable<T>|ArrayLike<T>): T[] => {
    const clone = Array.from(values);
    const primitives = mappers.map(mapper => clone.map(value => mapper(value)));

    return clone.map((_, index) => index)
        .sort((a, b) => {
          for (const primitiveLayer of primitives) {
            if (primitiveLayer[a] !== primitiveLayer[b]) {
              return primitiveLayer[a] > primitiveLayer[b] ? 1 : -1;
            }
          }

          return 0;
        })
        .map(index => clone[index]);
  };
}
