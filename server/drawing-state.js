export class DrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    this.operations = [];
    this.operationIndex = 0;
  }

  addOperation(operation) {
    this.operations = this.operations.slice(0, this.operationIndex);
    this.operations.push(operation);
    this.operationIndex = this.operations.length;
    return this.operationIndex - 1;
  }

  undo() {
    if (this.operationIndex > 0) {
      this.operationIndex--;
      return {
        success: true,
        index: this.operationIndex,
        operation: this.operations[this.operationIndex],
        operations: this.operations.slice(0, this.operationIndex) // Send all valid operations
      };
    }
    return { success: false };
  }

  redo() {
    if (this.operationIndex < this.operations.length) {
      const operation = this.operations[this.operationIndex];
      this.operationIndex++;
      return {
        success: true,
        index: this.operationIndex - 1,
        operation
      };
    }
    return { success: false };
  }

  getOperations() {
    return this.operations.slice(0, this.operationIndex);
  }

  getCurrentIndex() {
    return this.operationIndex;
  }
}
