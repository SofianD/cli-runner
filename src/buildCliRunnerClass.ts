// Import Node.js Dependencies
import { readFileSync, unlink, writeFileSync } from "fs";
import { extname, dirname, join } from "path";
import { fork } from "child_process";

// Import External Dependencies
import { parseModule, parseScript, ESTree } from "meriyah";
import { generate } from "astring";
import { createInterface } from "readline";
import { Readable } from "stream";

// Import Internal Dependencies
import { getConstantsFromFunctionV2 } from "./feature/getIdentifierFromFunction/index";

  // TODO: récupérer le nom de la constante qui save le MockCli pour s'assurer de récupérer la bonne méthode mais là: flemme.

// CONST is module
const kImportStatementsType = "ImportDeclaration";
const kSpecifiersType = ["ImportSpecifier", "ImportDefaultSpecifier"];
const kVarStatementType = "ExpressionStatement";
const kVarType = ["CallExpression"];

// CONST is not module
const kRequireStatementsType = "VariableDeclaration";
const kRequireDeclarationType = "VariableDeclarator";

const kForbiddenKeyword = ["console", "process", "Array","Date","Math","NaN","Number","Object","String","arguments","clearInterval","clearTimeout"];

interface RunnerOptions {
  /**
   * Default: `true`
   */
  module?: boolean;
    /**
   * Default: `false`
   */
  isTypescript?: boolean;
  deleteMockFile?: boolean;
}

interface RunOptions {
  pkgList: string[];
  args: string[];
  constants: string[];
}

const defaultBuilderOptions: RunnerOptions = {
  module: true,
  isTypescript: false,
  deleteMockFile: true
};

export class MockCliBuilder {
  builtFileName: string;
  currentFileName: string;
  deleteMockFile: boolean;
  markToFetchConstants: string
  ast: ESTree.Program & { body?: ESTree.VariableDeclaration[] };
  getImportStatement: typeof scanImportAST | typeof scanRequireAST;
  getVarDeclarationStatement: typeof scanVarDeclarationInContextAST;

  constructor(currentFileName: string, customOptions: RunnerOptions = {}) {
    const options = {
      ...defaultBuilderOptions,
      ...customOptions
    };

    if (extname(currentFileName) === ".ts") {
      throw new Error("Typescript is not yet supported.");
    }

    const parse = options.module ? parseModule : parseScript;
    const currentFile = readFileSync(currentFileName, {
      encoding: "utf-8",
      flag: "r"
    });
  
    this.ast = parse(currentFile, { module: options.module }) as ESTree.Program & { body?: ESTree.VariableDeclaration[] };
    // writeFileSync(join(dirname(currentFileName), "ahouioui.json"), JSON.stringify(this.ast, null, "\t"));
    this.getImportStatement = options.module ? scanImportAST : scanRequireAST;
    this.getVarDeclarationStatement = scanVarDeclarationInContextAST;
    this.currentFileName = currentFileName;
    this.deleteMockFile = options.deleteMockFile;
  }

  async run(fn: (...args: any) => any, options: RunOptions = {
    pkgList: [],
    args: [],
    constants: []
  }) {
    const { pkgList = [] , args = [], constants = [] } = options;

    if (!fn) {
      throw new Error("Missing 'fn' argument.");
    }

    const result = [...this.getImportedModules(pkgList)];
    // console.log("🚀 ~ file: buildCliRunnerClass.ts:95 ~ MockCliBuilder ~ run ~ result:", result);
    
    const constantsToIgnore = [
      ...result.flatMap((data) => data.names),
      ...kForbiddenKeyword
    ];
    // console.log("🚀 ~ file: buildCliRunnerClass.ts:101 ~ MockCliBuilder ~ run ~ constantsToIgnore:", constantsToIgnore);
    const fnProgram = parseScript(fn.toString());
    // console.log("🚀 ~ file: buildCliRunnerClass.ts:106 ~ MockCliBuilder ~ run ~ fnProgram:", fnProgram)
    const fnAst = fnProgram.body[0];
    // console.log("🚀 ~ file: buildCliRunnerClass.ts:108 ~ MockCliBuilder ~ run ~ fnAst:", fnAst)
    const constantsToImport = Array
      .from(new Set([
        ...constants,
        ...[...getConstantsFromFunctionV2(fnAst, constantsToIgnore, false)].flat()
      ]))
      .filter((c) => c ? !constantsToIgnore.includes(c) : false);
    // console.log("🚀 ~ file: buildCliRunnerClass.ts:114 ~ MockCliBuilder ~ run ~ constantsToImport:", constantsToImport)
    const [kekw] = [...this.getContextBasedOnTheMarkV2()];
    const builtConstants = magic(kekw, constantsToImport);

    const prog = {
      type: "Program",
      sourceType: "module",
      body: result.map((data) => data.statement)
    };
    const builtImport = generate(prog);

    (fnProgram.body[0] as any).params = [];
    const builtFn = generate(fnProgram);
  
    const builtFile = 
`${builtImport}
${builtConstants}
${builtFn}

(async function() {
  try {
    await ${fn.name}();
  }
  catch (error) {
    console.log(error);

    process.exit(1);
  }
})();
`;

    this.builtFileName = join(dirname(this.currentFileName), "kekwait.js");
    writeFileSync(this.builtFileName, builtFile);

    const cp = fork(this.builtFileName, options.args, {
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });

    const rStream = createInterface(cp.stdout as Readable);

    if (this.deleteMockFile) {
      cp.once("exit", () => {
        unlink(this.builtFileName, (error) => {
          if (error) {
            throw error;
          }
        });
      });
    }

    const lines: string[] = [];
    for await (const line of rStream) {
      lines.push(line);
    }

    return lines;
  }

  private *getImportedModules(pkgList: string[]) {
    for (const statement of this.ast.body) {
      let result;
      try {
        result = this.getImportStatement((statement as any), pkgList);
      }
      catch (error) {
        console.log(error);

        continue;
      }

      if (!result) {
        continue;
      }

      yield result;
    }
  }

  *getContextBasedOnTheMark(ast = this.ast) {
    // console.log("ast", ast);
    let i = 0;
    if (this.markToFetchConstants) {
      for (const statement of ast.body) {
        let result;
        try {
          result = this.getVarDeclarationStatement((statement as any), this.markToFetchConstants);
        }
        catch (error) {
          console.log(error);

          continue;
        }
  
        if (result?.body) {
          ([result] = [...this.getContextBasedOnTheMark(result.body)]);
          
          if (result) {
            yield statement;
          }

          continue;
        }


        if (!result?.statement) {
          continue;
        }
        
        yield result.statement;
      }
    }
  }

  mark(mark: string) {
    this.markToFetchConstants = mark;
  }

  removeMark() {
    this.markToFetchConstants = undefined;
  }

  *getContextBasedOnTheMarkV2(ast = this.ast, parent: { parent: any, ctx: any } = null) {
    // console.log("ast", ast);
    let i = 0;
    if (this.markToFetchConstants) {
      for (const statement of ast.body) {
        let result;
        try {
          result = this.getVarDeclarationStatement((statement as any), this.markToFetchConstants);
        }
        catch (error) {
          console.log(error);

          continue;
        }
  
        if (result?.body) {
          ([result] = [...this.getContextBasedOnTheMarkV2(result.body, { ctx: ast.body, parent: parent ? parent : { ctx: ast.body } })]);

          if (result) {
            yield result;
          }

          continue;
        }


        if (!result?.statement) {
          continue;
        }
        
        // yield { global: this.ast.body, ...parent };
        yield { ctx: ast.body, parent };
      }
    }
  }

  checkFnAst(fn: (...args: any[]) => any, writeFile = false) {
    const fnAst = parseScript(fn.toString(), { module: false });
    if (writeFile) {
      writeFileSync(join(dirname(this.currentFileName), "checkFnAst.json"), JSON.stringify(fnAst, null, "\t"));
    }

    return fnAst;
  }
}

export function scanImportAST(statement: ESTree.ImportDeclaration, pkgList: string[]) {  
  if (statement.type !== kImportStatementsType) {
    return null;
  }

  const names: string[]= [];
  for (const specifier of statement.specifiers) {
    if (!kSpecifiersType.includes(specifier.type)) {
      continue;
    }
  
    const name = specifier.local.name;
  
    if (pkgList.length > 0 && !pkgList.includes(name)) {
      continue;
    }

    names.push(name);
  }

  const path = statement.source.value as string;

  return { names, path, statement };
}

export function scanRequireAST(statement: ESTree.VariableDeclaration, pkgList: string[], onlyImport = true) {  
  if (statement.type !== kRequireStatementsType) {
    return null;
  }

  const declaration = statement.declarations[0];

  if (kRequireDeclarationType !== declaration.type || declaration.init.type !== "CallExpression") {
    return null;
  }

  if (declaration.init.callee.name !== "require" && onlyImport) {
    return null;
  }
  
  const names: string[]= [];
  const path = (declaration.init.arguments[0] as any).value as string;

  if (declaration.id.type === "ObjectPattern") {
    names.push(...declaration.id.properties.map((prop: any) => prop.value.name));
  }
  else {
    names.push((declaration.id as any).name);
  }

  if (pkgList.length > 0 && pkgList.filter((pkgName) => names.includes(pkgName)).length === 0) {
    return null;
  } 

  return { names, path, statement };
}

export function scanVarDeclarationInContextAST(statement: ESTree.ExpressionStatement, mark: string) {  
  if (statement.type !== kVarStatementType) {
    return null;
  }

  if (!kVarType.includes(statement.expression.type)) {
    return null;
  }

  if ((statement.expression as any).arguments[1]) {
    const args = (statement.expression as any).arguments;
    const arg = args[args.length - 1];
    if (["ArrowFunctionExpression", "FunctionExpression"].includes(arg.type)) {
      if (arg.body) {
        return { body: arg.body };
      }
    }
  }

  if ((statement.expression as ESTree.CallExpression).callee.type !== "MemberExpression") {
    return null;
  }

  // TODO: récupérer le nom de la constante qui save le MockCli pour s'assurer de récupérer la bonne méthode mais là: flemme.

  if ((statement.expression as ESTree.CallExpression).callee.property.name !== "mark") {
    return null;
  }

  if ((statement.expression as any).arguments[0].value !== mark) {
    return null;
  }

  return { statement };
}

function magic(ast: ESTree.VariableDeclaration[], constants: string[]) {
  const constantsToImport = new Set(constants);
  const matchedConstants = [];

  function* getConstantsAcrossCtxs(parentObj) {
    const { ctx, parent } = parentObj;

    const matchedConstsInCurrentCtx = [];
    for (const statement of ctx) {
      if (statement.type === "VariableDeclaration") {
        const declaration = statement.declarations[0];
        if (declaration.type === "VariableDeclarator") {
          if (constantsToImport.has(declaration.id.name)) {
            matchedConstsInCurrentCtx.push(statement);
            constantsToImport.delete(declaration.id.name);
          }
        }
      }
    }

    matchedConstants.push(...matchedConstsInCurrentCtx.reverse());

    if (parent && constantsToImport.size > 0) {
      [...getConstantsAcrossCtxs(parent)];
    }
  }

  // console.log(constantsToImport);
  [...getConstantsAcrossCtxs(ast)];
  // console.log(constantsToImport);

  if (constantsToImport.size > 0) {
    // throw new Error(`Cannot find constants: ${[...constantsToImport.values()].join(" - ")}`)

    console.log(`Cannot find constants: ${[...constantsToImport.values()].join(" - ")}`);
  }

  const prog = {
    type: "Program",
    sourceType: "module",
    body: matchedConstants.reverse()
  };

  return generate(prog);
}

export function scanMemberExpressionInFunctionAST(statement: ESTree.ExpressionStatement) {  
  const constants: string[] = [];

  if (statement.type === kVarStatementType) {
    if (statement.expression.type !== "CallExpression") {
      return null;
    }

    const callee = statement.expression.callee;

    if (callee.type === "Identifier") {
      if (!kForbiddenKeyword.includes(callee.name)) {
        constants.push(callee.name);
      }

      constants.push(...checkFnArguments(statement.expression.arguments));

      return constants;
    }

    if (statement.expression.callee.type === "MemberExpression") {
      if (!kForbiddenKeyword.includes(statement.expression.callee.object.name)) {
        constants.push(statement.expression.callee.object.name);
      }

      constants.push(...checkFnArguments(statement.expression.arguments));
    
      return constants;
    }
      
    return null;
  }

  if (statement.type === "CallExpression") {
    const s: any = statement;
    if (s.callee.type === "Identifier") {
      if (!kForbiddenKeyword.includes(s.callee.name)) {
        constants.push(s.callee.name);
      }

      constants.push(...checkFnArguments(s.arguments));

      return constants;
    }


    if (s.callee.type === "MemberExpression") {
      // console.log(s);
      if (s.callee.object.type === "MemberExpression") {
        if (s.callee.object.object.type === "Identifier") {
          constants.push(s.callee.object.object.name);

          return constants;
        }
      }
    }

    return null;
  }


  return null;
}

function checkFnArguments(args: ESTree.Expression[]): string[] {
  const constants = [];

  for (const arg of args) {
    if (arg.type === "Identifier") {
      constants.push(arg.name);

      continue;
    }

    if (arg.type === "MemberExpression") {
      if (arg.object.type === "Identifier") {
        constants.push(arg.object.name);

        continue;
      }

      continue;
    }

    if (arg.type === "CallExpression") {
      const result = scanMemberExpressionInFunctionAST(arg as any);

      if (result) {
        constants.push(...result);
      }
    }
  }

  return constants;
}

export function scanMemberExpressionInVarDeclarationAST(statement: ESTree.VariableDeclaration){
  if (statement.type !== kRequireStatementsType) {
    return null;
  }

  const declaration = statement.declarations[0];

  if (kRequireDeclarationType !== declaration.type) {
    return null;
  }

  const response = (declaration.id as any).name;

  if (declaration.init.type === "CallExpression") {
    if (declaration.init.callee.type === "MemberExpression") {
      return [
        response,
        [
          declaration.init.callee.object.name,
          ...checkFnArguments(declaration.init.arguments)
        ]
      ];
    }

    return [response, null];
  }

  if (declaration.init.type === "BinaryExpression") {
    console.log("BinaryExpression not supported yet.");

    return [response, null];
  }
  
  return [response, null];
}

function getConstantsFromFunction(fn: any, constantsToIgnore: string[]) {
  const ast = parseScript(fn.toString());
  const constants = [];

  function* hui(a) {
    for (const statement of a.body ?? a) {
      if (statement.type === "FunctionDeclaration") {
        [...hui(statement.body)];

        continue;
      }

      if (statement.type === "VariableDeclaration") {
        const result = scanMemberExpressionInVarDeclarationAST(statement);

        if (result) {
          const [declared, constantsToImport] = result;

          if (constantsToImport) {
            constants.push(...constantsToImport);
          }

          constantsToIgnore.push(declared);
        }

        continue;
      }

      const result = scanMemberExpressionInFunctionAST(statement);

      if (!result) {
        continue;
      }

      constants.push(...result);
    }
  }

  [...hui(ast)];

  return constants;
}
