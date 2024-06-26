import * as ast from "../ast/ast";
import { Lexer } from "../lexer/lexer";
import { Token, TokenKind } from "../token/token";

type PrefixParserFunction = () => ast.Expression | undefined;
type InfixParserFunction = (_: ast.Expression) => ast.Expression | undefined;

export enum Precedence {
  Lowest = 0,
  Equals = 1,
  LessGreater = 2,
  Sum = 3,
  Product = 4,
  Prefix = 5,
  Call = 6,
  Index = 7,
}

const precedences = new Map<TokenKind, number>([
  ["equals", Precedence.Equals],
  ["notEquals", Precedence.Equals],
  ["lessThen", Precedence.LessGreater],
  ["greaterThen", Precedence.LessGreater],
  ["plus", Precedence.Sum],
  ["minus", Precedence.Sum],
  ["slash", Precedence.Product],
  ["asterisk", Precedence.Product],
  ["leftParenthesis", Precedence.Call],
  ["leftBracket", Precedence.Index],
]);

export class Parser {
  private _lexer: Lexer;
  private _currentToken!: Token;
  private _peekToken!: Token | undefined;

  private _prefixParseFunctions = new Map<TokenKind, PrefixParserFunction>([
    ["integer", this.parseIntegerLiteral.bind(this)],
    ["true", this.parseBooleanLiteral.bind(this)],
    ["false", this.parseBooleanLiteral.bind(this)],
    ["string", this.parseStringLiteral.bind(this)],
    ["leftBracket", this.parseArrayLiteral.bind(this)],
    ["leftBrace", this.parseHashLiteral.bind(this)],
    ["function", this.parseFunctionLiteral.bind(this)],
    ["identifier", this.parseIdentifier.bind(this)],
    ["bang", this.parsePrefixExpression.bind(this)],
    ["minus", this.parsePrefixExpression.bind(this)],
    ["leftParenthesis", this.parseGroupedExpression.bind(this)],
    ["if", this.parseIfExpression.bind(this)],
  ]);

  private _infixParseFunctions = new Map<TokenKind, InfixParserFunction>([
    ["plus", this.parseInfixExpression.bind(this)],
    ["minus", this.parseInfixExpression.bind(this)],
    ["slash", this.parseInfixExpression.bind(this)],
    ["asterisk", this.parseInfixExpression.bind(this)],
    ["equals", this.parseInfixExpression.bind(this)],
    ["notEquals", this.parseInfixExpression.bind(this)],
    ["lessThen", this.parseInfixExpression.bind(this)],
    ["greaterThen", this.parseInfixExpression.bind(this)],
    ["leftParenthesis", this.parseCallExpression.bind(this)],
    ["leftBracket", this.parseIndexExpression.bind(this)],
  ]);

  public errors: string[];

  public constructor(lexer: Lexer) {
    this._lexer = lexer;
    this.errors = [];
    const firstToken = lexer.nextToken();
    if (!firstToken) throw new Error("");
    this._currentToken = firstToken;
    this._peekToken = lexer.nextToken();
  }

  private nextToken() {
    if (!this._peekToken) {
      throw new Error("No more tokens.");
    }
    this._currentToken = this._peekToken;
    this._peekToken = this._lexer.nextToken();
  }

  private currentTokenIs(kind: Token["kind"]): boolean {
    return this._currentToken.kind === kind;
  }

  private peekTokenIs(kind: Token["kind"]): boolean {
    return this._peekToken?.kind === kind;
  }

  private expectPeek(kind: Token["kind"]): boolean {
    if (this.peekTokenIs(kind)) {
      this.nextToken();
      return true;
    } else {
      this.peekError(kind);
      return false;
    }
  }

  private peekError(type: TokenKind) {
    const error = `expected next token to be ${type}, got ${this._peekToken?.kind} instead`;
    this.errors.push(error);
  }

  private currentPrecedence(): Precedence {
    const precedence = precedences.get(this._currentToken.kind);
    return precedence ?? Precedence.Lowest;
  }

  private peekPrecedence(): Precedence {
    const precedence = this._peekToken && precedences.get(this._peekToken.kind);
    return precedence ?? Precedence.Lowest;
  }

  public parseProgram(): ast.Program | undefined {
    const statements: ast.Statement[] = [];
    while (this._currentToken.kind !== "eof") {
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      this.nextToken();
    }
    return ast.program(statements);
  }

  private parseStatement(): ast.Statement | undefined {
    switch (this._currentToken.kind) {
      case "let":
        return this.parseLetStatement();
      case "return":
        return this.parseReturnStatement();
      default:
        return this.parseExpressionStatement();
    }
  }

  private parseLetStatement(): ast.LetStatement | undefined {
    if (!this.expectPeek("identifier")) {
      return;
    }

    const name = ast.identifier(this._currentToken.text);

    if (!this.expectPeek("assign")) {
      return;
    }

    this.nextToken();

    const expr = this.parseExpression(Precedence.Lowest);

    if (!expr) throw new Error("Expected new expression");

    while (!this.currentTokenIs("semicolon")) {
      this.nextToken();
    }

    return ast.letStatement(name, expr);
  }

  private parseReturnStatement(): ast.ReturnStatement | undefined {
    this.nextToken();

    const expression = this.parseExpression(Precedence.Lowest);

    if (!expression) {
      throw new Error("Expected expression");
    }

    while (!this.currentTokenIs("semicolon")) {
      this.nextToken();
    }

    return ast.returnStatement(expression);
  }

  private parseExpressionStatement(): ast.ExpressionStatement | undefined {
    const expression = this.parseExpression(Precedence.Lowest);
    if (!expression) return undefined;
    while (this.peekTokenIs("semicolon")) {
      this.nextToken();
    }
    return ast.expressionStatement(expression);
  }

  private parseIdentifier(): ast.Identifier | undefined {
    return ast.identifier(this._currentToken.text);
  }

  private parseIntegerLiteral(): ast.IntegerLiteral | undefined {
    const value = Number(this._currentToken.text);
    if (isNaN(value)) {
      this.errors.push(`could not parse ${this._currentToken.text} as integer`);
      return undefined;
    }
    return ast.integerLiteral(value);
  }

  private parseBooleanLiteral(): ast.BooleanLiteral | undefined {
    return ast.booleanLiteral(this._currentToken.kind === "true");
  }

  private parseStringLiteral(): ast.StringLiteral | undefined {
    return ast.stringLiteral(this._currentToken.text);
  }

  private parseArrayLiteral(): ast.ArrayLiteral | undefined {
    const elements = this.parseExpressionList("rightBracket");
    if (!elements) return;
    return ast.arrayLiteral(elements);
  }

  private parseHashLiteral(): ast.HashLiteral | undefined {
    const pairs: ast.KeyValuePair<ast.Expression, ast.Expression>[] = [];
    while (!this.peekTokenIs("rightBrace")) {
      this.nextToken();
      const key = this.parseExpression(Precedence.Lowest);
      if (!this.expectPeek("colon")) return;
      this.nextToken();
      const value = this.parseExpression(Precedence.Lowest);
      if (!key || !value) return;
      pairs.push({ key, value });
      if (!this.peekTokenIs("rightBrace") && !this.expectPeek("comma")) return;
    }
    if (!this.expectPeek("rightBrace")) return;
    return ast.hashLiteral(pairs);
  }

  private parseFunctionLiteral(): ast.FunctionLiteral | undefined {
    if (!this.expectPeek("leftParenthesis")) return;
    const parameters = this.parseFunctionParameters();
    if (!parameters) return;
    if (!this.expectPeek("leftBrace")) return;
    const body = this.parseBlockStatement();
    return ast.functionLiteral(parameters, body);
  }

  private parseFunctionParameters(): ast.Identifier[] | undefined {
    const identifiers: ast.Identifier[] = [];

    if (this.peekTokenIs("rightParenthesis")) {
      this.nextToken();
      return identifiers;
    }

    this.nextToken();

    identifiers.push(ast.identifier(this._currentToken.text));

    while (this.peekTokenIs("comma")) {
      this.nextToken();
      this.nextToken();
      identifiers.push(ast.identifier(this._currentToken.text));
    }

    if (!this.expectPeek("rightParenthesis")) {
      return;
    }

    return identifiers;
  }

  private parseExpression(precedence: Precedence): ast.Expression | undefined {
    const prefix = this._prefixParseFunctions.get(this._currentToken.kind);
    if (!prefix) {
      this.errors.push(`no prefix parse fn for ${this._currentToken.kind}`);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let leftExpr = prefix()!;
    while (
      !this.peekTokenIs("semicolon") &&
      precedence < this.peekPrecedence()
    ) {
      const peekKind = this._peekToken?.kind;
      if (!peekKind) throw new Error("PeekKind cannot be null.");
      const infix = this._infixParseFunctions.get(peekKind);
      if (!infix) return leftExpr;
      this.nextToken();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      leftExpr = infix(leftExpr)!;
    }
    return leftExpr;
  }

  private parsePrefixExpression(): ast.PrefixExpression | undefined {
    const operator = this._currentToken.text;
    this.nextToken();
    const right = this.parseExpression(Precedence.Prefix);
    if (!right) return undefined;
    return ast.prefixExpression(operator, right);
  }

  private parseInfixExpression(
    left: ast.Expression
  ): ast.InfixExpression | undefined {
    const operator = this._currentToken.text;
    const precedence = this.currentPrecedence();
    this.nextToken();
    const right = this.parseExpression(precedence);
    if (!right) return;
    return ast.infixExpression(operator, left, right);
  }

  private parseCallExpression(
    left: ast.Expression
  ): ast.CallExpression | undefined {
    const args = this.parseExpressionList("rightParenthesis");
    if (left.kind === "identifier" || left.kind == "functionLiteral") {
      if (!args) return;
      return ast.callExpression(left, args);
    }
  }

  private parseIndexExpression(
    left: ast.Expression
  ): ast.IndexExpression | undefined {
    this.nextToken();
    const index = this.parseExpression(Precedence.Lowest);
    if (!index) return;
    if (!this.expectPeek("rightBracket")) return;
    return ast.indexExpression(left, index);
  }

  parseCallArugments(): ast.Expression[] | undefined {
    const args: ast.Expression[] = [];
    if (this.peekTokenIs("rightParenthesis")) {
      this.nextToken();
      return args;
    }

    this.nextToken();
    const arg = this.parseExpression(Precedence.Lowest);
    if (!arg) return;
    args.push(arg);

    while (this.peekTokenIs("comma")) {
      this.nextToken();
      this.nextToken();
      const arg = this.parseExpression(Precedence.Lowest);
      if (arg) args.push(arg);
    }

    if (!this.expectPeek("rightParenthesis")) return;
    return args;
  }

  private parseGroupedExpression(): ast.Expression | undefined {
    this.nextToken();
    const expression = this.parseExpression(Precedence.Lowest);
    if (!this.expectPeek("rightParenthesis")) {
      return;
    }
    return expression;
  }

  private parseIfExpression(): ast.IfExpression | undefined {
    if (!this.expectPeek("leftParenthesis")) return;
    this.nextToken();
    const condition = this.parseExpression(Precedence.Lowest);
    if (!condition) return;
    if (!this.expectPeek("rightParenthesis")) return;
    if (!this.expectPeek("leftBrace")) return;
    const consequence = this.parseBlockStatement();

    if (!this.peekTokenIs("else")) {
      return ast.ifExpression(condition, consequence);
    }

    this.nextToken();
    if (!this.expectPeek("leftBrace")) return;
    const alternative = this.parseBlockStatement();
    return ast.ifExpression(condition, consequence, alternative);
  }

  private parseBlockStatement(): ast.BlockStatement {
    const statements: ast.Statement[] = [];
    this.nextToken();
    while (!this.currentTokenIs("rightBrace") && !this.currentTokenIs("eof")) {
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      this.nextToken();
    }
    return ast.blockStatement(statements);
  }

  private parseExpressionList(end: TokenKind): ast.Expression[] | undefined {
    const list: ast.Expression[] = [];

    if (this.peekTokenIs(end)) {
      this.nextToken();
      return list;
    }

    this.nextToken();
    const expr = this.parseExpression(Precedence.Lowest);
    if (!expr) return;
    list.push(expr);

    while (this.peekTokenIs("comma")) {
      this.nextToken();
      this.nextToken();
      const expr = this.parseExpression(Precedence.Lowest);
      if (expr) list.push(expr);
    }

    if (!this.expectPeek(end)) return;

    return list;
  }
}
