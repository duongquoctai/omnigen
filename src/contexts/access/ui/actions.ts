"use server";

import { Layer, ManagedRuntime, Schema } from "effect";

import { makeAction } from "@/platform/run";
import { AppLayer } from "@/platform/runtime";

import {
  PasswordHasherLive,
  SessionCookieLive,
  TokenIssuerLive,
  UserRepoLive,
} from "../adapters/auth-adapters";
import { CurrentUserLive, ShareRepoLive } from "../adapters/share-repo";
import { LoginInput, RegisterInput } from "../domain/auth";
import { ListSharesInput, RemoveShareInput, ShareProjectInput } from "../domain/sharing";
import { loginWorkflow, logoutWorkflow, registerWorkflow } from "../workflows/auth-workflows";
import {
  listProjectSharesWorkflow,
  removeProjectShareWorkflow,
  shareProjectWorkflow,
} from "../workflows/share-workflows";

const AccessLayer = Layer.mergeAll(
  AppLayer,
  UserRepoLive.pipe(Layer.provide(AppLayer)),
  ShareRepoLive.pipe(Layer.provide(AppLayer)),
  CurrentUserLive.pipe(Layer.provide(AppLayer)),
  PasswordHasherLive,
  SessionCookieLive,
  TokenIssuerLive.pipe(Layer.provide(AppLayer)),
);

const accessRuntime = ManagedRuntime.make(AccessLayer);

export const loginAction = makeAction(LoginInput, loginWorkflow, accessRuntime);

export const registerAction = makeAction(RegisterInput, registerWorkflow, accessRuntime);

const EmptyInput = Schema.Struct({});
export const logoutAction = makeAction(EmptyInput, () => logoutWorkflow(), accessRuntime);

export const listProjectSharesAction = makeAction(
  ListSharesInput,
  listProjectSharesWorkflow,
  accessRuntime,
);

export const shareProjectAction = makeAction(
  ShareProjectInput,
  shareProjectWorkflow,
  accessRuntime,
);

export const removeProjectShareAction = makeAction(
  RemoveShareInput,
  removeProjectShareWorkflow,
  accessRuntime,
);
