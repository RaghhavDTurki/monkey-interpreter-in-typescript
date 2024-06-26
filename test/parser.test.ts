import * as ast from "../src/lib/ast/ast";
import { Lexer } from "../src/lib/lexer/lexer";
import { Parser } from "../src/lib/parser/parser";

const checkParserErrors = (parser: Parser) => {
  if (parser.errors.length !== 0) {
    let message = "The parser produced the following errors:\n\n";
    for (const error of parser.errors) {
      message += "ERROR: " + error + "\n";
    }
    throw new Error(message);
  }
};

test("testLetStatement", () => {
  const expected = ast.program([
    ast.letStatement(ast.identifier("x"), ast.integerLiteral(5)),
    ast.letStatement(ast.identifier("y"), ast.integerLiteral(10)),
    ast.letStatement(ast.identifier("foobar"), ast.integerLiteral(838383)),
  ]);

  const input = `
    let x = 5;
    let y = 10;
    let foobar = 838383;
  `;

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("return statement", () => {
  const expected = ast.program([
    ast.returnStatement(ast.integerLiteral(5)),
    ast.returnStatement(ast.integerLiteral(10)),
    ast.returnStatement(ast.integerLiteral(993322)),
  ]);

  const input = `
    return 5;
    return 10;
    return 993322;
  `;

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("identifier expression", () => {
  const expected = ast.program([
    ast.expressionStatement(ast.identifier("foobar")),
  ]);

  const input = "foobar;";
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("integer literal expression", () => {
  const expected = ast.program([
    ast.expressionStatement(ast.integerLiteral(5)),
  ]);

  const input = "5;";
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("parsing prefix expressions", () => {
  const expected = [
    ast.program([
      ast.expressionStatement(ast.prefixExpression("!", ast.integerLiteral(5))),
    ]),
    ast.program([
      ast.expressionStatement(
        ast.prefixExpression("-", ast.integerLiteral(15))
      ),
    ]),
    ast.program([
      ast.expressionStatement(
        ast.prefixExpression("!", ast.booleanLiteral(true))
      ),
    ]),
    ast.program([
      ast.expressionStatement(
        ast.prefixExpression("!", ast.booleanLiteral(false))
      ),
    ]),
  ];

  const actual = ["!5;", "-15;", "!true", "!false"].map((input) => {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    checkParserErrors(parser);
    return program;
  });

  expect(actual).toStrictEqual(expected);
});

test("parsing infix expression", () => {
  const operators = ["+", "-", "*", "/", ">", "<", "==", "!="];

  const expected = operators.map((operator) => {
    return ast.program([
      ast.expressionStatement(
        ast.infixExpression(
          operator,
          ast.integerLiteral(5),
          ast.integerLiteral(5)
        )
      ),
    ]);
  });

  const actual = operators.map((operator) => {
    const lexer = new Lexer(`5 ${operator} 5;`);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    checkParserErrors(parser);
    return program;
  });

  expect(actual).toStrictEqual(expected);
});

test("operator precedence parsing", () => {
  [
    ["-a * b", "((-a) * b)"],
    ["!-a", "(!(-a))"],
    ["a + b + c", "((a + b) + c)"],
    ["a + b - c", "((a + b) - c)"],
    ["a * b * c", "((a * b) * c)"],
    ["a * b / c", "((a * b) / c)"],
    ["a + b / c", "(a + (b / c))"],
    ["a + b * c + d / e - f", "(((a + (b * c)) + (d / e)) - f)"],
    ["3 + 4; -5 * 5", "(3 + 4)((-5) * 5)"],
    ["5 > 4 == 3 < 4", "((5 > 4) == (3 < 4))"],
    ["5 < 4 != 3 > 4", "((5 < 4) != (3 > 4))"],
    ["3 + 4 * 5 == 3 * 1 + 4 * 5", "((3 + (4 * 5)) == ((3 * 1) + (4 * 5)))"],
    ["true", "true"],
    ["true", "true"],
    ["3 > 5 == false", "((3 > 5) == false)"],
    ["3 < 5 == true", "((3 < 5) == true)"],
    ["1 + (2 + 3) + 4", "((1 + (2 + 3)) + 4)"],
    ["(5 + 5) * 2", "((5 + 5) * 2)"],
    ["2 / (5 + 5)", "(2 / (5 + 5))"],
    ["-(5 + 5)", "(-(5 + 5))"],
    ["!(true == true)", "(!(true == true))"],
    ["a * [1, 2, 3, 4][b * c] * d", "((a * ([1, 2, 3, 4][(b * c)])) * d)"],
    [
      "add(a * b[2], b[1], 2 * [1, 2][1])",
      "add((a * (b[2])), (b[1]), (2 * ([1, 2][1])))",
    ],
  ].forEach(([input, expected]) => {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (!program) return;
    checkParserErrors(parser);
    const actual = ast.toString(program);
    expect(actual).toStrictEqual(expected);
  });
});

test("boolean expression", () => {
  const expected = ast.program([
    ast.expressionStatement(ast.booleanLiteral(true)),
    ast.expressionStatement(ast.booleanLiteral(false)),
    ast.letStatement(ast.identifier("foobar"), ast.booleanLiteral(true)),
    ast.letStatement(ast.identifier("barfoo"), ast.booleanLiteral(false)),
  ]);

  const input = `
    true;
    false;
    let foobar = true;
    let barfoo = false;`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);

  expect(program).toStrictEqual(expected);
});

test("if expression", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.ifExpression(
        ast.infixExpression("<", ast.identifier("x"), ast.identifier("y")),
        ast.blockStatement([ast.expressionStatement(ast.identifier("x"))])
      )
    ),
  ]);

  const input = `if (x < y) { x }`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);

  expect(program).toStrictEqual(expected);
});

test("if else expression", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.ifExpression(
        ast.infixExpression("<", ast.identifier("x"), ast.identifier("y")),
        ast.blockStatement([ast.expressionStatement(ast.identifier("x"))]),
        ast.blockStatement([ast.expressionStatement(ast.identifier("y"))])
      )
    ),
  ]);

  const input = `if (x < y) { x } else { y }`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);

  expect(program).toStrictEqual(expected);
});

test("function literal", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.functionLiteral(
        [ast.identifier("x"), ast.identifier("y")],
        ast.blockStatement([
          ast.expressionStatement(
            ast.infixExpression("+", ast.identifier("x"), ast.identifier("y"))
          ),
        ])
      )
    ),
  ]);

  const input = `fn(x, y) { x + y; }`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("function parameter parsing", () => {
  const expected = [[], ["x"], ["x", "y", "z"]];

  const input = `
    fn() { };
    fn(x) { };
    fn(x, y, z) { }`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);

  const stmt = program?.body as ast.ExpressionStatement[];
  const lits = stmt.map((e) => e.expression) as ast.FunctionLiteral[];
  const params = lits.map((f) => f.parameters.map((p) => p.value));
  expect(params).toStrictEqual(expected);
});

test("call expression", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.callExpression(ast.identifier("add"), [
        ast.integerLiteral(1),
        ast.infixExpression("*", ast.integerLiteral(2), ast.integerLiteral(3)),
        ast.infixExpression("+", ast.integerLiteral(4), ast.integerLiteral(5)),
      ])
    ),
  ]);

  const input = `add(1, 2 * 3, 4 + 5);`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("string expression", () => {
  const expected = ast.program([
    ast.expressionStatement(ast.stringLiteral("hello world")),
  ]);

  const input = `"hello world";`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("array literal", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.arrayLiteral([ast.integerLiteral(1), ast.integerLiteral(2)])
    ),
  ]);

  const input = "[1, 2];";
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("index expression", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.indexExpression(ast.identifier("arr"), ast.integerLiteral(1))
    ),
  ]);

  const input = "arr[1];";
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("hash literal", () => {
  const expected = ast.program([
    ast.expressionStatement(
      ast.hashLiteral([
        { key: ast.stringLiteral("one"), value: ast.integerLiteral(1) },
        { key: ast.stringLiteral("two"), value: ast.integerLiteral(2) },
      ])
    ),
  ]);

  const input = `{"one": 1, "two": 2}`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  expect(program).toStrictEqual(expected);
});

test("parsing empty hash literal", () => {
  const input = "{}";
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  const stmt = program?.body as ast.ExpressionStatement[];
  const hash = stmt[0].expression as ast.HashLiteral;
  expect(hash.pairs.length).toBe(0);
});

test("parsing hash string keys", () => {
  const input = `{"one": 1, "two": 2, "three": 3}`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  const stmt = program?.body as ast.ExpressionStatement[];
  const hash = stmt[0].expression as ast.HashLiteral;
  const expected: ast.KeyValuePair<ast.Expression, ast.Expression>[] = [
    { key: ast.stringLiteral("one"), value: ast.integerLiteral(1) },
    { key: ast.stringLiteral("two"), value: ast.integerLiteral(2) },
    { key: ast.stringLiteral("three"), value: ast.integerLiteral(3) },
  ];
  expect(hash.pairs).toStrictEqual(expected);
});

test("parsing hash with expressions", () => {
  const input = `{"one": 0 + 1, "two": 10 - 8, "three": 15 / 5}`;
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  checkParserErrors(parser);
  const stmt = program?.body as ast.ExpressionStatement[];
  const hash = stmt[0].expression as ast.HashLiteral;
  const expected: ast.KeyValuePair<ast.Expression, ast.Expression>[] = [
    {
      key: ast.stringLiteral("one"),
      value: ast.infixExpression(
        "+",
        ast.integerLiteral(0),
        ast.integerLiteral(1)
      ),
    },
    {
      key: ast.stringLiteral("two"),
      value: ast.infixExpression(
        "-",
        ast.integerLiteral(10),
        ast.integerLiteral(8)
      ),
    },
    {
      key: ast.stringLiteral("three"),
      value: ast.infixExpression(
        "/",
        ast.integerLiteral(15),
        ast.integerLiteral(5)
      ),
    },
  ];
  expect(hash.pairs).toStrictEqual(expected);
});
