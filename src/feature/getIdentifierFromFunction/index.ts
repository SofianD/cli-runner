import { checkCallExpressionStatement, getConstantsName, getFunctionParamsAsForbiddenKeyWord, initIdentifierArray } from "./utils";

export function* getConstantsFromFunctionV2(ast: any, defaultForbiddenKeywords: string[], ignoreParams = true): Generator<string[]> {
  const { type, id, params, body: blockStatement } = ast;
  const paramList = getFunctionParamsAsForbiddenKeyWord(params);
  const forbiddenKeyWordInThisFunction = [...defaultForbiddenKeywords];
  const foundIdentifier = [];

  if (ignoreParams) {
    forbiddenKeyWordInThisFunction.push(...paramList);
  }
  else {
    foundIdentifier.push(...paramList);
  }
  const pushIdentifier = initIdentifierArray(foundIdentifier);

  if (blockStatement.type === "BlockStatement") {    
    for(const statement of blockStatement.body) {
      if (statement.type === "VariableDeclaration" && statement.kind === "const") {
        getConstantsName(statement, forbiddenKeyWordInThisFunction, pushIdentifier);
      }

      else if (statement.type === "FunctionDeclaration") {
        forbiddenKeyWordInThisFunction.push(statement.id.name);

        foundIdentifier.push(...[...getConstantsFromFunctionV2(statement, forbiddenKeyWordInThisFunction)].flat());
      }
      
      else if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") {
        [...checkCallExpressionStatement(statement.expression, forbiddenKeyWordInThisFunction, pushIdentifier)];
      }
    }
  }
  
  yield foundIdentifier;
}