import { AsyncLocalStorage } from "node:async_hooks";
// Each intended operation can involve multiple provider calls (speech plus translation, or a retry).
export interface OperationMeter {
  reservation?: string;
  calls: number;
  complete: boolean;
}
export const operationMeter = new AsyncLocalStorage<OperationMeter>();

export const connectorAttribution = new AsyncLocalStorage<string>();

export const scanBudget = new AsyncLocalStorage<{ remaining: number; bytes: number }>();
export class ScanBudgetReached extends Error {}
