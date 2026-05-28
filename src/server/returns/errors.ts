export class ReturnRestockOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Return restock order ${orderId} was not found`);
    this.name = "ReturnRestockOrderNotFoundError";
  }
}

export class InvalidReturnRestockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReturnRestockError";
  }
}
