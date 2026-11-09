export class MessageInsertRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageInsertRejectedError';
  }
}
