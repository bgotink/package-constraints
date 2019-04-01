import * as pl from 'tau-prolog';

type AnyTerm = pl.type.Term<number, string>;

export function variable(id: string): pl.type.Var {
  return new pl.type.Var(id);
}

export function term<Arity extends number, Indicator extends string>(
    id: string, args?: pl.type.Value[]): pl.type.Term<Arity, Indicator> {
  return new pl.type.Term(id, args);
}

export function and(first: AnyTerm, second: AnyTerm, ...rest: AnyTerm[]): pl.type.Term<2, ',/2'> {
  const result = term<2, ',/2'>(',', [first, second]);

  if (rest.length > 0) {
    return and(result, ...(rest as [AnyTerm, ...AnyTerm[]]));
  } else {
    return result;
  }
}

export function rule(head: AnyTerm, body?: AnyTerm): pl.type.Rule {
  return new pl.type.Rule(head, body || null);
}

export function termEquals(lhs: pl.type.Value, rhs: pl.type.Value|string): pl.type.Term<2, '=/2'> {
  if (typeof rhs === 'string') {
    rhs = term(rhs);
  }

  return term('=', [lhs, rhs]);
}

export function replaceGoal(state: pl.type.State, goal: AnyTerm): pl.type.State {
  return new pl.type.State(state.goal.replace(goal), state.substitution, state);
}
