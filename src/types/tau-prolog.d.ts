declare module 'tau-prolog' {
  namespace tau {
    namespace type {
      class Session {
        consult(program: string): void;

        query(query: string): void;

        answer(callback: (answer: Answer) => void): void;

        answers(callback: (answer: Answer) => void, maxCount?: number, after?: () => void): void;
      }
    }

    interface Answer {
      id: string;

      links: Record<string, Link>;
    }

    interface Link {
      id: string;

      toJavaScript(): string|number|(string|number)[];
    }

    function format_answer(answer: Answer): string;

    function create(): type.Session;
  }

  export = tau;
}
