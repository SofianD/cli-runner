// Import Node.js Dependencies
import { readFileSync, unlink, writeFileSync } from "fs";
import { extname, dirname, join } from "path";
import { fork } from "child_process";

// Import External Dependencies
import { parseModule, parseScript, ESTree } from "meriyah";
import { generate } from "astring";
import { createInterface } from "readline";
import { Readable } from "stream";

// CONST is module
const kImportStatementsType = "ImportDeclaration";
const kSpecifiersType = ["ImportSpecifier", "ImportDefaultSpecifier"];
const kVarStatementType = "ExpressionStatement";
const kVarType = ["CallExpression"];

// CONST is not module
const kRequireStatementsType = "VariableDeclaration";
const kRequireDeclarationType = "VariableDeclarator";

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
  fn: (...args: any) => any;
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

  async run(options: RunOptions) {
    const { pkgList = [] , fn, args = [], constants: constantsToImport = [] } = options;

    if (!fn) {
      throw new Error("Missing 'fn' argument.")
    }

    const result = [...this.getImportedModules(pkgList)];
    const prog = {
      type: "Program",
      sourceType: "module",
      body: result.map((data) => data.statement)
    }

    this.builtFileName = join(dirname(this.currentFileName), "kekwait.js");
    const builtImport = generate(prog);

    const [ContextStatement] = [...this.getContextBasedOnTheMark()];
    const body = ContextStatement.expression.arguments[1].body.body;
  
    const matchedConstants = [];
    for (const statement of body) {
      if (statement.type === "VariableDeclaration") {
        const declaration = statement.declarations[0];
        if (declaration.type === "VariableDeclarator") {
          if (constantsToImport.includes(declaration.id.name)) {
            matchedConstants.push(statement);
          }
        }
      }
    }

    const prog2 = {
      type: "Program",
      sourceType: "module",
      body: matchedConstants
    }

    const builtConstants = generate(prog2);

    const builtFile = 
`${builtImport}
${builtConstants}
${fn.toString()}

function main() {
  try {\n\t await ${fn.name}();\n}\ncatch (error) {\n\tconsole.log(error);\n\tprocess.exit(1);\n}
}

main();
`;

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

export function scanRequireAST(statement: ESTree.VariableDeclaration, pkgList: string[]) {  
  if (statement.type !== kRequireStatementsType) {
    return null;
  }

  const declaration = statement.declarations[0];

  if (kRequireDeclarationType !== declaration.type || declaration.init.type !== "CallExpression") {
    return null;
  }

  if (declaration.init.callee.name !== "require") {
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
