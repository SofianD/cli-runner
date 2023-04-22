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
  args: string[]
}

const defaultBuilderOptions: RunnerOptions = {
  module: true,
  isTypescript: false,
  deleteMockFile: true
};

export class MockCliBuilder {
  builtFileName: string;
  currentFileName: string;
  ast: ESTree.Program & { body?: ESTree.VariableDeclaration[] };
  scanStatement: typeof scanImportAST | typeof scanRequireAST;
  deleteMockFile: boolean;

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
    this.scanStatement = options.module ? scanImportAST : scanRequireAST;
    this.currentFileName = currentFileName;
    this.deleteMockFile = options.deleteMockFile;
  }

  async run(options: RunOptions) {
    const { pkgList = [] , fn, args = [] } = options;

    if (!fn) {
      throw new Error("Missing 'fn' argument.")
    }

    // const oui = parseScript(fn.toString(), { module: false });
    // writeFileSync("oui.js", JSON.stringify(oui, null, "\t"));
    // console.log(generate(oui))

    const result = [...this.getImportedModules(pkgList)];
    const prog = {
      type: "Program",
      sourceType: "module",
      body: result.map((data) => data.statement)
    }

    this.builtFileName = join(dirname(this.currentFileName), "kekwait.js");
    const builtImport = generate(prog);
    const builtFile = 
`${builtImport}
${fn.toString()}

try {\n\t${fn.name}();\n}\ncatch (error) {\n\tconsole.log(error);\n\tprocess.exit(1);\n}
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
        result = this.scanStatement((statement as any), pkgList);
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
