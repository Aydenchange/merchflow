"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../lib/db";
import {
  createPosActionHandlers,
  type LookupSkuActionInput,
  type PosOrderActionInput,
  type SimulatePaymentSuccessActionInput,
} from "./pos-action-handlers";
import type { DemoRole } from "../server/demo/workbench";

const handlers = createPosActionHandlers({
  getDb,
  revalidatePath,
});

export async function loadDemoContextAction(role: DemoRole) {
  return handlers.loadDemoContextAction(role);
}

export async function lookupSkuAction(input: LookupSkuActionInput) {
  return handlers.lookupSkuAction(input);
}

export async function createPosOrderAction(input: PosOrderActionInput) {
  return handlers.createPosOrderAction(input);
}

export async function simulatePaymentSuccessAction(
  input: SimulatePaymentSuccessActionInput,
) {
  return handlers.simulatePaymentSuccessAction(input);
}
