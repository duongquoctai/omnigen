export type ActionSuccess<T> = {
  readonly ok: true;
  readonly data: T;
};

export type ActionFailure = {
  readonly ok: false;
  readonly error: string;
  readonly code: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;
