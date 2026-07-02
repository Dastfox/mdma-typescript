/**
 * Error types for the mdma template engine. Message text follows the error
 * table in spec.md section 7.1 exactly, so `.message` is stable and suitable
 * for display to end users.
 */

export class MdmaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MdmaSyntaxError extends MdmaError {}

export class MissingInputError extends MdmaError {
  readonly inputName: string;

  constructor(inputName: string) {
    super(`MissingInput: ${inputName}`);
    this.inputName = inputName;
  }
}

export class MdmaTypeError extends MdmaError {
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string) {
    super(`TypeError: expected ${expected}, got ${actual}`);
    this.expected = expected;
    this.actual = actual;
  }
}

export class MdmaReferenceError extends MdmaError {
  static forwardBlock(name: string): MdmaReferenceError {
    return new MdmaReferenceError(`ReferenceError: block '${name}' not yet rendered`);
  }

  static undefined_(name: string): MdmaReferenceError {
    return new MdmaReferenceError(`ReferenceError: '${name}' is not defined`);
  }
}

export class FilterError extends MdmaError {
  readonly filterName: string;
  readonly expectedType: string;

  constructor(filterName: string, expectedType: string) {
    super(`FilterError: '${filterName}' expects ${expectedType}`);
    this.filterName = filterName;
    this.expectedType = expectedType;
  }
}

export class DuplicateNameError extends MdmaError {
  readonly computedName: string;
  readonly blockName: string;

  constructor(computedName: string, blockName: string) {
    super(`DuplicateName: '${computedName}' in block '${blockName}'`);
    this.computedName = computedName;
    this.blockName = blockName;
  }
}
