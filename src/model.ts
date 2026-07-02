/** Data model for a parsed .mdma file: inputs declarations and blocks. */

export type ScalarType = "string" | "number" | "boolean" | "object";
export type InputType = ScalarType | `${ScalarType}[]`;

export interface InputDecl {
  name: string;
  type: InputType;
  hasDefault: boolean;
  default: unknown;
}

export interface Block {
  name: string;
  multipleVar: string | null;
  multipleSource: string | null;
  nameExpr: Expr | null; // only set alongside multipleVar
  body: Node[];
}

export interface ParsedTemplate {
  inputs: InputDecl[];
  blocks: Block[];
}

// --- Expression AST -----------------------------------------------------

export interface Literal {
  kind: "literal";
  value: unknown;
}

export interface ArrayLiteral {
  kind: "array";
  items: Expr[];
}

export interface Var {
  kind: "var";
  path: string[];
}

export interface Not {
  kind: "not";
  operand: Expr;
}

export type CompareOp = "==" | "!=" | ">" | ">=" | "<" | "<=";
export type LogicalOp = "and" | "or";

export interface BinOp {
  kind: "binop";
  op: CompareOp | LogicalOp;
  left: Expr;
  right: Expr;
}

export interface FilterCall {
  kind: "filter";
  target: Expr;
  name: string;
  args: Expr[];
}

export type Expr = Literal | ArrayLiteral | Var | Not | BinOp | FilterCall;

// --- Block-body AST -------------------------------------------------------

export interface TextNode {
  kind: "text";
  text: string;
}

export interface ExprNode {
  kind: "expr";
  expr: Expr;
}

export interface IfNode {
  kind: "if";
  // Each branch is [condition, body]. The `else` branch has condition=null.
  branches: [Expr | null, Node[]][];
}

export interface ForNode {
  kind: "for";
  varName: string;
  iterable: Expr;
  body: Node[];
}

export type Node = TextNode | ExprNode | IfNode | ForNode;
