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
  isModule?: boolean;
    /**
   * Default: `false`
   */
  isTypescript?: boolean;
}

interface RunOptions {
  pkgList: string[];
  fn: (...args: any) => any;
  args: string[]
}

const defaultBuilderOptions = {
  module: true,
  isTypescript: false
};

export class MockCliBuilder {
  builtFileName: string;
  currentFileName: string;
  ast: ESTree.Program & { body?: ESTree.VariableDeclaration[] };
  getModules: typeof scanImportAST | typeof scanRequireAST;

  constructor(currentFileName: string, customOptions: RunnerOptions = {}) {
    const options = {
      ...defaultBuilderOptions,
      ...customOptions
    };

    if (extname(currentFileName) === ".ts") {
      throw new Error("Typescript is not yet supported.");
    }

    const parse = options.isModule ? parseModule : parseScript;
    const currentFile = readFileSync(currentFileName, {
      encoding: "utf-8",
      flag: "r"
    });
  
    this.ast = parse(currentFile, { module: options.isModule }) as ESTree.Program & { body?: ESTree.VariableDeclaration[] };
    // writeFileSync(join(dirname(currentFileName), "ahouioui.json"), JSON.stringify(this.ast, null, "\t"));
    this.getModules = options.isModule ? scanImportAST : scanRequireAST;
    this.currentFileName = currentFileName;
  }

  async run(options: RunOptions) {
    const { pkgList = [] , fn, args = [] } = options;
    const result = [...this.getImportedModules(pkgList)];
    const prog = {
      type: "Program",
      sourceType: "module",
      body: result.map((data) => data.statement)
    }

    this.builtFileName = join(dirname(this.currentFileName), "kekwait.js");
    const builtImport = generate(prog);
    const builtFile = `${builtImport}

${fn ? `${fn.toString()}\n${fn.name}();` : ""}
`;

    writeFileSync(this.builtFileName, builtFile);

    const cp = fork(this.builtFileName, options.args, {
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });

    const rStream = createInterface(cp.stdout as Readable);

    cp.on("exit", () => {
      unlink(this.builtFileName, (error) => {
        if (error) {
          throw error;
        }
      });
    });

    const lines: string[] = [];
    for await (const line of rStream) {
      lines.push(line);
    }

    return lines;
  }

  getLines() {
    
  }

  private *getImportedModules(pkgList: string[]) {
    let i = 0;
    for (const statement of this.ast.body) {
      let result;
      try {
        result = this.getModules((statement as any), pkgList);
      }
      catch (error) {
        console.log(`[getImportedModules ERROR] index: ${i}`);
        console.log(statement);
        console.log("id", statement.declarations[0].id );
        console.log("init", statement.declarations[0].init);
        console.log(error);

        continue;
      }
      finally {
        i++;
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

  if (kRequireDeclarationType !== declaration.type) {
    return null;
  }

  if (declaration.init.type !== "CallExpression") {
    return null;
  }

  if ((declaration.init as any).callee.name !== "require") {
    return null;
  }
  
  const names: string[]= [];
  const path = (declaration.init as any).arguments[0].value as string;
  let type = "VarDeclaration";

  if (declaration.id.type === "ObjectPattern") {
    names.push(...declaration.id.properties.map((prop: any) => prop.value.name));
    type = "ObjectPattern";
  }
  else {
    names.push((declaration.id as any).name);
  }

  if (pkgList.length > 0 && pkgList.filter((pkgName) => names.includes(pkgName)).length === 0) {
    return null;
  } 

  return { names, path, statement, type };
}
