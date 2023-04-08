import { readFileSync } from "fs";
import { parseModule, parseScript } from "meriyah";
import { Program } from "meriyah/dist/src/estree";

interface RunnerOptions {
  /**
   * Default: `true`
   */
  module?: boolean;
}

const defaultBuilderOptions = {
  module: true
};

export function buildRunner(currentFileName: string, customOptions: RunnerOptions = {}) {
  const options = {
    ...defaultBuilderOptions,
    ...customOptions
  };

  const parse = options.module ? parseModule : parseScript;
  const currentFile = readFileSync(currentFileName, {
    encoding: "utf-8",
    flag: "r"
  });

  this.ast = parse(currentFile);
}

export function* fetchVariable(program: Program, variableName: string) {
  const body = program.body;

  for (const statement of body) {
    if (statement.type !== "VariableDeclaration") {
      continue;
    }

    const declaration = statement.declarations[0];

    if (declaration.type !== "VariableDeclarator" || (declaration.id as any).name !== variableName) {
      continue;
    }

    yield {
      name: (declaration.id as any).name,
      path: (declaration.init as any).arguments[0].value
    }
  }

  throw new Error(`Could not find ${variableName} module declaration.`)
}
