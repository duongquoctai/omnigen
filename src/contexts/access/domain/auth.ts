import { Data, Schema } from "effect";

export const Email = Schema.NonEmptyString.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
export type Email = typeof Email.Type;

export const LoginInput = Schema.Struct({
  email: Email,
  password: Schema.NonEmptyString,
});
export type LoginInput = typeof LoginInput.Type;

export const RegisterInput = Schema.Struct({
  name: Schema.NonEmptyString,
  email: Email,
  password: Schema.String.check(Schema.isMinLength(6)),
});
export type RegisterInput = typeof RegisterInput.Type;

export class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly message: string;
}> {}

export class EmailAlreadyExistsError extends Data.TaggedError("EmailAlreadyExistsError")<{
  readonly email: string;
  readonly message: string;
}> {}

export interface TokenPayload {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly exp: number;
}
