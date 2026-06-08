"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  createPosActionHandlers,
  type LookupSkuActionInput,
  type PosOrderActionInput,
  type SimulatePaymentSuccessActionInput,
} from "@/features/pos/actions/handlers";
import {
  createOperationsActionHandlers,
} from "@/features/operations/actions/handlers";
import {
  createControlActionHandlers,
  type AdjustDemoStockInput,
  type CancelDemoOrderInput,
  type FulfillDemoOrderInput,
  type LoadDemoControlCenterInput,
  type RefundDemoOrderInput,
  type RestockDemoReturnInput,
} from "@/features/control-center/actions/handlers";
import {
  createAuditActionHandlers,
  type LoadDemoAuditTrailInput,
} from "@/features/audit/actions/handlers";
import type { DemoRole } from "@/server/demo/workbench";
import type { LoadDemoOperationsDashboardInput } from "@/server/demo/operations";

const posHandlers = createPosActionHandlers({
  getDb,
  revalidatePath,
});
const operationsHandlers = createOperationsActionHandlers({
  getDb,
  revalidatePath,
});
const controlHandlers = createControlActionHandlers({
  getDb,
  revalidatePath,
});
const auditHandlers = createAuditActionHandlers({
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

export async function loadControlCenterAction(
  input: LoadDemoControlCenterInput,
) {
  return controlHandlers.loadControlCenterAction(input);
}

export async function fulfillOrderAction(input: FulfillDemoOrderInput) {
  return controlHandlers.fulfillOrderAction(input);
}

export async function cancelOrderAction(input: CancelDemoOrderInput) {
  return controlHandlers.cancelOrderAction(input);
}

export async function refundOrderAction(input: RefundDemoOrderInput) {
  return controlHandlers.refundOrderAction(input);
}

export async function adjustStockAction(input: AdjustDemoStockInput) {
  return controlHandlers.adjustStockAction(input);
}

export async function restockReturnAction(input: RestockDemoReturnInput) {
  return controlHandlers.restockReturnAction(input);
}

export async function loadAuditTrailAction(input: LoadDemoAuditTrailInput) {
  return auditHandlers.loadAuditTrailAction(input);
}
