export class InvalidAuditTrailInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAuditTrailInputError";
  }
}
