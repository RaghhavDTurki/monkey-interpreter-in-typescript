import * as ast from "./ast/ast";
import { builtins } from "./object/builtins";
import * as env from "./object/environment";
import * as obj from "./object/object";

export function evaluate(
  node: ast.Node,
  environment: env.Environment
): obj.Object {
  switch (node.kind) {
    // Statements
    case "program":
      return evaluateProgram(node, environment);
    case "blockStatement":
      return evaluateBlockStatement(node, environment);
    case "expressionStatement":
      return evaluate(node.expression, environment);

    // Expressions
    case "integerLiteral":
      return obj.integer(node.value);
    case "booleanLiteral":
      return obj.boolean(node.value);
    case "stringLiteral":
      return obj.string(node.value);
    case "arrayLiteral": {
      const elements = evaluateExpressions(node.elements, environment);
      if (elements.length == 1 && obj.isError(elements[0])) {
        return elements[0];
      }
      return obj.array(elements);
    }
    case "hashLiteral":
      return evaluateHashLiteral(node, environment);
    case "prefixExpression": {
      const right = evaluate(node.right, environment);
      if (obj.isError(right)) return right;
      return evaluatePrefixExpression(node.operator, right);
    }
    case "infixExpression": {
      const left = evaluate(node.left, environment);
      if (obj.isError(left)) return left;
      const right = evaluate(node.right, environment);
      if (obj.isError(right)) return left;
      return evaluateInfixExpression(node.operator, left, right);
    }
    case "ifExpression":
      return evaluateIfExpression(node, environment);
    case "returnStatement": {
      const value = evaluate(node.returnValue, environment);
      if (obj.isError(value)) return value;
      return obj.returnValue(value);
    }
    case "let": {
      const value = evaluate(node.value, environment);
      if (obj.isError(value)) return value;
      environment.set(node.name.value, value);
      return value;
    }
    case "identifier": {
      return evaluateIdentifier(node, environment);
    }
    case "functionLiteral": {
      return obj.func(node.parameters, node.body, environment);
    }
    case "callExpression": {
      const func = evaluate(node.func, environment);
      if (obj.isError(func)) return func;
      const args = evaluateExpressions(node.args, environment);
      if (args.length == 1 && obj.isError(args[0])) {
        return args[0];
      }
      return applyFunction(func, args);
    }
    case "indexExpression": {
      const left = evaluate(node.left, environment);
      if (obj.isError(left)) return left;
      const index = evaluate(node.index, environment);
      if (obj.isError(index)) return index;
      return evaluateIndexExpression(left, index);
    }
    default:
      throw new Error(`unexpected node: '${JSON.stringify(node)}'`);
  }
}

export function applyFunction(
  func: obj.Object,
  args: obj.Object[]
): obj.Object {
  switch (func.kind) {
    case "builtin": {
      return func.fn(args);
    }
    case "func": {
      const extendedEnvironment = extendFunctionEnvironment(func, args);
      const evaluated = evaluate(func.body, extendedEnvironment);
      return unwrapReturnValue(evaluated);
    }
    default:
      return obj.error(`not a function: ${func.kind}`);
  }
}

export function extendFunctionEnvironment(
  func: obj.Func,
  args: obj.Object[]
): env.Environment {
  const environment = new env.Environment(func.env);
  for (let p = 0; p < func.parameters.length; p++) {
    const { value } = func.parameters[p];
    const arg = args[p];
    environment.set(value, arg);
  }
  return environment;
}

export function unwrapReturnValue(returnValue: obj.Object): obj.Object {
  if (returnValue.kind === "returnValue") {
    return returnValue.value;
  }
  return returnValue;
}

export function evaluateExpressions(
  expressions: ast.Expression[],
  environment: env.Environment
): obj.Object[] {
  const result: obj.Object[] = [];

  for (const expression of expressions) {
    const evaluated = evaluate(expression, environment);
    if (obj.isError(evaluated)) {
      return [evaluated];
    }
    result.push(evaluated);
  }

  return result;
}

export function evaluateIdentifier(
  node: ast.Identifier,
  env: env.Environment
): obj.Object {
  const value = env.get(node.value);
  if (value) return value;
  const builtin = builtins.get(node.value);
  if (builtin) return builtin;
  return obj.error(`identifier not found: ${node.value}`);
}

export function evaluateProgram(
  program: ast.Program,
  environment: env.Environment
): obj.Object {
  let result!: obj.Object;
  for (const statement of program.body) {
    result = evaluate(statement, environment);

    if (result.kind === "returnValue") {
      return result.value;
    } else if (result.kind === "error") {
      return result;
    }
  }
  return result;
}

export function evaluateBlockStatement(
  node: ast.BlockStatement,
  environment: env.Environment
): obj.Object {
  let result!: obj.Object;
  for (const statement of node.statements) {
    result = evaluate(statement, environment);

    if (result.kind === "returnValue" || result.kind === "error") {
      return result;
    }
  }
  return result;
}

export function evaluatePrefixExpression(
  operator: string,
  right: obj.Object
): obj.Object {
  switch (operator) {
    case "!":
      return evaluateBangOperatorExpression(right);
    case "-":
      return evaluateMinusOperatorExpression(right);
    default:
      return obj.error(`unknown operator: ${operator}${right.kind}`);
  }
}

export function evaluateBangOperatorExpression(right: obj.Object): obj.Object {
  switch (right.kind) {
    case "boolean":
      return right.value ? obj.FALSE : obj.TRUE;
    case "null":
      return obj.TRUE;
    default:
      return obj.FALSE;
  }
}

export function evaluateMinusOperatorExpression(right: obj.Object): obj.Object {
  if (right.kind !== "integer") {
    return obj.error(`unknown operator: -${right.kind}`);
  }
  return obj.integer(-right.value);
}

export function evaluateInfixExpression(
  operator: string,
  left: obj.Object,
  right: obj.Object
): obj.Object {
  if (left.kind !== right.kind) {
    return obj.error(`type mismatch: ${left.kind} ${operator} ${right.kind}`);
  }

  switch (operator) {
    case "==":
      return obj.boolean(obj.eq(left, right));
    case "!=":
      return obj.boolean(!obj.eq(left, right));
  }

  if (left.kind === "integer" && right.kind === "integer")
    return evaluateIntegerInfixExpression(operator, left, right);

  if (left.kind === "string" && right.kind === "string")
    return evaluateStringInfixExpression(operator, left, right);

  return obj.error(`unknown operator: ${left.kind} ${operator} ${right.kind}`);
}

export function evaluateStringInfixExpression(
  operator: string,
  left: obj.String,
  right: obj.String
): obj.Object {
  if (operator !== "+") {
    return obj.error(
      `unknown operator: ${left.kind} ${operator} ${right.kind}`
    );
  }
  return obj.string(left.value + right.value);
}

export function evaluateIntegerInfixExpression(
  operator: string,
  left: obj.Integer,
  right: obj.Integer
): obj.Object {
  switch (operator) {
    case "+":
      return obj.integer(left.value + right.value);
    case "-":
      return obj.integer(left.value - right.value);
    case "*":
      return obj.integer(left.value * right.value);
    case "/":
      return obj.integer(left.value / right.value);
    case ">":
      return obj.boolean(left.value > right.value);
    case "<":
      return obj.boolean(left.value < right.value);
    default:
      return obj.error(
        `unknown operator: ${left.kind} ${operator} ${right.kind}`
      );
  }
}

export function evaluateIfExpression(
  node: ast.IfExpression,
  environment: env.Environment
): obj.Object {
  const condition = evaluate(node.condition, environment);
  if (obj.isError(condition)) return condition;
  if (obj.isTruthy(condition)) {
    return evaluate(node.consequence, environment);
  } else if (node.alternative) {
    return evaluate(node.alternative, environment);
  }

  return obj.NULL;
}

export function evaluateIndexExpression(
  left: obj.Object,
  index: obj.Object
): obj.Object {
  if (left.kind === "array" && index.kind === "integer") {
    return evaluateArrayIndexExpression(left, index);
  }
  if (left.kind === "hashmap") {
    return evaluateHashIndexExpression(left, index);
  }
  return obj.error(`index operator not supported: ${left.kind}`);
}

export function evaluateArrayIndexExpression(
  array: obj.Array,
  index: obj.Integer
): obj.Object {
  const i = index.value;
  const max = array.elements.length - 1;
  if (i < 0 || i > max) return obj.NULL;
  return array.elements[i];
}

export function evaluateHashLiteral(
  node: ast.HashLiteral,
  environment: env.Environment
): obj.Object {
  const pairs: obj.HashPair[] = [];
  for (const { key: keyNode, value: valueNode } of node.pairs) {
    const key = evaluate(keyNode, environment);
    if (obj.isError(key)) return key;
    const value = evaluate(valueNode, environment);
    if (obj.isError(value)) return value;
    pairs.push({ key, value });
  }
  return obj.hashmap(pairs);
}

export function evaluateHashIndexExpression(
  hashmap: obj.Hashmap,
  index: obj.Object
): obj.Object {
  const key = obj.hash(index);
  if (!key) {
    return obj.error(`unusable as hash key: ${index.kind}`);
  }
  const pair = hashmap.pairs.get(key);
  if (!pair) return obj.NULL;
  return pair.value;
}
