export function checkVariableDeclaratorInit(declaration, forbiddenKeyWordInThisFunction, pushIdentifier) {
  const d = declaration.init ?? declaration;
  
  if (d.type === "Identifier") {
    pushIdentifier(d.name, forbiddenKeyWordInThisFunction);
  }

  else if (d.type === "ArrayExpression") {
    for(const element of d.elements) {
      if (element.type === "Identifier") {
        pushIdentifier(element.name, forbiddenKeyWordInThisFunction);
      }

      if (element.type === "CallExpression") {  
        [...checkCallExpressionStatement(element, forbiddenKeyWordInThisFunction, pushIdentifier)];
      }
    }
  }

  else if (d.type === "CallExpression") {
    [...checkCallExpressionStatement(d, forbiddenKeyWordInThisFunction, pushIdentifier)];
  }

  else if (d.type === "MemberExpression") {
    if (d.object.type === "Identifier") {
      pushIdentifier(d.object.name, forbiddenKeyWordInThisFunction);
    }
  }
}

export function getConstantsName(statement, forbiddenKeyWordInThisFunction, pushIdentifier) {
  for (const declaration of statement.declarations) {
    if (declaration.type === "VariableDeclarator") {
      if (declaration.id.type === "Identifier") {
        forbiddenKeyWordInThisFunction.push(declaration.id.name);
      }

      else if (declaration.id.type === "ObjectPattern") {
        const objectPattern = declaration.id;

        if (objectPattern.properties) {
          for(const prop of objectPattern.properties) {
            if (prop.value.type === "Identifier") {
              forbiddenKeyWordInThisFunction.push(prop.value.name); 
            }

            if (prop.value.type === "AssignmentPattern") {
              forbiddenKeyWordInThisFunction.push(prop.value.left.name);

              if (prop.value.right.type === "Identifier") {
                pushIdentifier(prop.value.right.name, forbiddenKeyWordInThisFunction);
              }
            }
          }
        }
      }

      else if (declaration.id.type === "ArrayPattern") {
        for (const element of declaration.id.elements) {
          if (element.type === "Identifier") {
            forbiddenKeyWordInThisFunction.push(element.name); 
          }

          if (element.type === "AssignmentPattern") {
            forbiddenKeyWordInThisFunction.push(element.left.name);

            if (element.right.type === "Identifier") {
              pushIdentifier(element.right.name, forbiddenKeyWordInThisFunction);
            }
          }
        }
      }

      checkVariableDeclaratorInit(declaration, forbiddenKeyWordInThisFunction, pushIdentifier);
    }
  }
}

export function pushIdentifier(arr, value, forbiddenKeyWords) {
  if (forbiddenKeyWords.includes(value)) {
    return;
  }

  arr.push(value);
}

export function initIdentifierArray(arr) {
  return pushIdentifier.bind(null, arr);
}

export function getFunctionParamsAsForbiddenKeyWord(params) {
  const fw = [];

  for(const param of params) {
    if (param.type === "Identifier") {
      fw.push(param.name);
    }
  }

  return fw;
}

export function* checkCallExpressionStatement(obj, forbiddenKeyWordInThisFunction, pushIdentifier) {
  if (obj.callee.type === "Identifier") {
    pushIdentifier(obj.callee.name, forbiddenKeyWordInThisFunction);
  }

  else if (obj.callee.type === "MemberExpression" && obj.callee.object.type === "CallExpression") {
    [...checkCallExpressionStatement(obj.callee.object, forbiddenKeyWordInThisFunction, pushIdentifier)];
  }

  else {
    pushIdentifier(obj.callee.object.name, forbiddenKeyWordInThisFunction);
  }

  for (const arg of obj.arguments) {
    checkVariableDeclaratorInit(arg, forbiddenKeyWordInThisFunction, pushIdentifier);
  }
}