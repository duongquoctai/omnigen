import "server-only";

import { Context, Duration, Effect, Layer, Schema } from "effect";

import { UpstreamError } from "../errors";

export type UpstreamService = "python" | "zvid" | "drive";

export interface HttpRequestOptions {
  readonly service: UpstreamService;
  readonly url: string;
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: BodyInit | null;
  readonly timeoutMs?: number;
}

export interface HttpClientValue {
  readonly fetchJson: <A>(
    options: HttpRequestOptions,
    schema: Schema.Decoder<A>,
  ) => Effect.Effect<A, UpstreamError>;
  readonly fetchBuffer: (options: HttpRequestOptions) => Effect.Effect<Buffer, UpstreamError>;
}

export class HttpClient extends Context.Service<HttpClient, HttpClientValue>()(
  "platform/HttpClient",
) {}

export const makeHttpClient = (fetchImpl: typeof fetch = fetch): HttpClientValue => {
  const performFetch = (options: HttpRequestOptions): Effect.Effect<Response, UpstreamError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetchImpl(options.url, {
          method: options.method ?? "GET",
          ...(options.headers ? { headers: options.headers } : {}),
          ...(options.body !== undefined ? { body: options.body } : {}),
        });
        return res;
      },
      catch: (cause) =>
        new UpstreamError({
          service: options.service,
          message: `Request to ${options.service} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(options.timeoutMs ?? 30_000),
        orElse: () =>
          Effect.fail(
            new UpstreamError({
              service: options.service,
              status: 504,
              message: `Request to ${options.service} timed out after ${String(options.timeoutMs ?? 30_000)}ms`,
            }),
          ),
      }),
      Effect.flatMap((res) =>
        res.ok
          ? Effect.succeed(res)
          : Effect.fail(
              new UpstreamError({
                service: options.service,
                status: res.status,
                message: `Upstream ${options.service} returned HTTP ${String(res.status)}`,
              }),
            ),
      ),
    );

  return {
    fetchJson: <A>(options: HttpRequestOptions, schema: Schema.Decoder<A>) =>
      performFetch(options).pipe(
        Effect.flatMap((res) =>
          Effect.tryPromise({
            try: () => res.json() as Promise<unknown>,
            catch: (cause) =>
              new UpstreamError({
                service: options.service,
                message: `Invalid JSON from ${options.service}: ${cause instanceof Error ? cause.message : String(cause)}`,
              }),
          }),
        ),
        Effect.flatMap((json) =>
          Schema.decodeUnknownEffect(schema)(json).pipe(
            Effect.mapError(
              (issue) =>
                new UpstreamError({
                  service: options.service,
                  message: `Unexpected response schema from ${options.service}: ${String(issue)}`,
                }),
            ),
          ),
        ),
      ),
    fetchBuffer: (options: HttpRequestOptions) =>
      performFetch(options).pipe(
        Effect.flatMap((res) =>
          Effect.tryPromise({
            try: async () => Buffer.from(await res.arrayBuffer()),
            catch: (cause) =>
              new UpstreamError({
                service: options.service,
                message: `Failed reading binary body from ${options.service}: ${cause instanceof Error ? cause.message : String(cause)}`,
              }),
          }),
        ),
      ),
  };
};

export const HttpClientLive = Layer.succeed(HttpClient, makeHttpClient());
