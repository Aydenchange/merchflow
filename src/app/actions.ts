"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../lib/db";
import {
  createPosActionHandlers,
  type LookupSkuActionInput,
  type PosOrderActionInput,
  type SimulatePaymentSuccessActionInput,
} from "./pos-action-handlers";
import {
  createOperationsActionHandlers,
} from "./operations-action-handlers";
import type { DemoRole } from "../server/demo/workbench";
import type { LoadDemoOperationsDashboardInput } from "../server/demo/operations";

const posHandlers = createPosActionHandlers({
  getDb,
  revalidatePath,
});
const operationsHandlers = createOperationsActionHandlers({
  getDb,
  revalidatePath,
});

export async function loadDemoContextAction(role: DemoRole) {
  return posHandlers.loadDemoContextAction(role);
}

export async function lookupSkuAction(input: LookupSkuActionInput) {
  return posHandlers.lookupSkuAction(input);
}

export async function createPosOrderAction(input: PosOrderActionInput) {
  return posHandlers.createPosOrderAction(input);
}

export async function simulatePaymentSuccessAction(
  input: SimulatePaymentSuccessActionInput,
) {
  return posHandlers.simulatePaymentSuccessAction(input);
}

export async function loadOperationsDashboardAction(
  input: LoadDemoOperationsDashboardInput,
) {
  return operationsHandlers.loadOperationsDashboardAction(input);
}
