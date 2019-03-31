import {Observable} from 'rxjs';
import * as pl from 'tau-prolog';

import {WorkspaceInfo} from '../workspace';

import {registerModule} from './prolog-module';

export type Answer = Record<string, any>;

export class Engine {
  private session: pl.type.Session;

  public constructor(workspacesInfo: WorkspaceInfo) {

    this.session = pl.create(1_000_000);

    registerModule(this.session, workspacesInfo);
  }

  consult(program: string): void {
    this.session.consult(program);
  }

  query(query: string): Observable<Answer> {
    return new Observable<Answer>(observer => {
      let stop = false;

      const next = () => this.session.answer(answer => {
        if (stop) {
          return;
        }

        if (!answer) {
          stop = true;
          observer.complete();
          return;
        }

        if (answer.id === 'throw') {
          stop = true;
          observer.error(new Error(pl.format_answer(answer)));
          return;
        }

        observer.next(Object.entries(answer.links).reduce((answer, [key, value]) => {
          answer[key] = value.id === 'null' ? null : value.toJavaScript();
          return answer;
        }, {} as Answer));

        next();
      });

      this.session.query(query);
      next();

      return () => stop = true;
    });
  }
}
