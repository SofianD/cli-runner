function checkVariableDeclaratorInit(declaration, forbiddenKeyWordInThisFunction, pushIdentifier) {
  if (declaration.init.type === "Identifier") {
    pushIdentifier(declaration.init.name, forbiddenKeyWordInThisFunction);
  }
  else if (declaration.init.type === "ArrayExpression") {
    for(const element of declaration.init.elements) {
      if (element.type === "Identifier") {
        pushIdentifier(element.name, forbiddenKeyWordInThisFunction);
      }

      if (element.type === "CallExpression") {
        // pushIdentifier(declaration.init.callee.name, forbiddenKeyWordInThisFunction);
        // console.log("declaration", declaration);
  
        [...checkCallExpressionStatement(element, forbiddenKeyWordInThisFunction, pushIdentifier)];
      }
    }
  }
  else if (declaration.init.type === "CallExpression") {
    if (declaration.init.callee.type === "Identifier") {
      // pushIdentifier(declaration.init.callee.name, forbiddenKeyWordInThisFunction);
      // console.log("declaration", declaration);

      [...checkCallExpressionStatement(declaration.init, forbiddenKeyWordInThisFunction, pushIdentifier)];
    }
  }
}

function getConstantsName(statement, forbiddenKeyWordInThisFunction, pushIdentifier) {
  for (const declaration of statement.declarations) {
    if (declaration.type === "VariableDeclarator") {
      if (declaration.id.type === "Identifier") {
        forbiddenKeyWordInThisFunction.push(declaration.id.name);


        // if (declaration.init.type === "Identifier") {
        //   pushIdentifier(declaration.init.name, forbiddenKeyWordInThisFunction);
        // }
        // else if (declaration.init.type === "ArrayExpression") {
        //   for(const element of declaration.init.elements) {
        //     if (element.type === "Identifier") {
        //       pushIdentifier(element.name, forbiddenKeyWordInThisFunction);
        //     }
        //   }
        // }
        // else if (declaration.init.type === "CallExpression") {
        //   if (declaration.init.callee.type === "Identifier") {
        //     pushIdentifier(declaration.init.callee.name, forbiddenKeyWordInThisFunction);

        //     // checkCallExpression(declaration);
        //   }
        // }
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
        
          // if (declaration.init.type === "Identifier") {
          //   pushIdentifier(declaration.init.name, forbiddenKeyWordInThisFunction);
          // }
          // else if (declaration.init.type === "ArrayExpression") {
          //   for(const element of declaration.init.elements) {
          //     if (element.type === "Identifier") {
          //       pushIdentifier(element.name, forbiddenKeyWordInThisFunction);
          //     }
          //   }
          // }
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

        // if (declaration.init.type === "Identifier") {
        //   pushIdentifier(declaration.init.name, forbiddenKeyWordInThisFunction);
        // }
        // else if (declaration.init.type === "ArrayExpression") {
        //   for(const element of declaration.init.elements) {
        //     if (element.type === "Identifier") {
        //       pushIdentifier(element.name, forbiddenKeyWordInThisFunction);
        //     }
        //   }
        // }
      }

      checkVariableDeclaratorInit(declaration, forbiddenKeyWordInThisFunction, pushIdentifier);
    }
  }
}

function pushIdentifier(arr, value, forbiddenKeyWords) {
  if (forbiddenKeyWords.includes(value)) {
    return;
  }

  arr.push(value);
}

function initIdentifierArray(arr) {
  return pushIdentifier.bind(null, arr);
}

function getFunctionParamsAsForbiddenKeyWord(params) {
  const fw = [];

  for(const param of params) {
    if (param.type === "Identifier") {
      fw.push(param.name);
    }
  }

  return fw;
}

function* checkCallExpressionStatement(obj, forbiddenKeyWordInThisFunction, pushIdentifier) {
  if (obj.callee.type === "Identifier") {
    pushIdentifier(obj.callee.name, forbiddenKeyWordInThisFunction);

    for (const arg of obj.arguments) {
      // [...checkCallExpressionStatement(arg, forbiddenKeyWordInThisFunction, pushIdentifier)];
      console.log("arg", arg);
      checkVariableDeclaratorInit(obj, forbiddenKeyWordInThisFunction, pushIdentifier);
    }
  }
  else if (obj.callee.type === "MemberExpression" && obj.callee.object.type === "CallExpression") {
    [...checkCallExpressionStatement(obj.callee.object, forbiddenKeyWordInThisFunction, pushIdentifier)];
  }
  else {
    console.log("obj", obj)
    pushIdentifier(obj.callee.object.name, forbiddenKeyWordInThisFunction);
  }
}

module.exports = {
  getFunctionParamsAsForbiddenKeyWord,
  initIdentifierArray,
  getConstantsName,
  checkCallExpressionStatement
};
