const { writeFileSync } = require("fs");
const { MockCliBuilder, scanMemberExpressionInFunctionAST, scanMemberExpressionInVarDeclarationAST } = require("../dist/buildCliRunnerClass.js");
const { parseScript } = require("meriyah");
const { join } = require("path");
const { getFunctionParamsAsForbiddenKeyWord, initIdentifierArray, getConstantsName, checkCallExpressionStatement } = require("./utils.js");

const myString = "abc";
const myObject = {
  objectParam1: 1
};
const myArray = [];
const myNumber = 123;
const MyBigInt = BigInt(123);
function mockFunction(mockParam) { }

function myFunction(fnParam) {
  // const { myParam1 = myArray, myParam2 = [], myParam3, myParam4: customParam = myObject } = myString;
  const absc = parseScript(mockFunction);
  const absc2 = parseScript2(mockFunction2.toString());
  // fnParam();
  // mockFunction2(myNumber);
  // mockFunction3(myNumber2).next(nextArgument).next2(nextArgument2);
}

writeFileSync(join(__dirname, "MyFunction.AST.json"), JSON.stringify(parseScript(myFunction.toString()), null, "  "));

const kForbiddenKeywords = ["console", "process"];

const ast = (parseScript(myFunction.toString())).body[0];
function* getConstantsFromFunction(ast, defaultForbiddenKeywords = kForbiddenKeywords) {
  const { type, id, params, body: blockStatement } = ast;
  const forbiddenKeyWordInThisFunction = [
    ...defaultForbiddenKeywords,
    ...getFunctionParamsAsForbiddenKeyWord(params)
  ];
  const foundIdentifier = [];
  const pushIdentifier = initIdentifierArray(foundIdentifier);

  if (blockStatement.type === "BlockStatement") {    
    for(const statement of blockStatement.body) {
      if (statement.type === "VariableDeclaration" && statement.kind === "const") {
        getConstantsName(statement, forbiddenKeyWordInThisFunction, pushIdentifier);
      }

      else if (statement.type === "FunctionDeclaration") {
        forbiddenKeyWordInThisFunction.push(statement.id.name);

        foundIdentifier.push(...[...getConstantsFromFunction(statement)].flat());
      }
      
      else if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") {
        [...checkCallExpressionStatement(statement.expression, forbiddenKeyWordInThisFunction, pushIdentifier)];
      }
    }
  }
  
  yield foundIdentifier;
}

console.log(...getConstantsFromFunction(ast));
