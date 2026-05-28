export class InvalidReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportInputError";
  }
}
