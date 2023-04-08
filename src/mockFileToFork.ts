// Import Node.js Dependencies
import { writeFileSync, unlinkSync } from "node:fs";

// Import Internal Deps
import { PathOfJsFile } from "utils";

export function createFileToTest(pathMethod: string, filePath: PathOfJsFile, methodName?: string) {
const templateJS =
`const f = require("${pathMethod}");
const { runCliCommand } = require("./dist/index.js");

const args = process.argv.slice(2).join(" ");

const options = {
  args
};

runCliCommand(${methodName ? `f["${methodName}"]` : "f"}, options);
`;

  writeFileSync(filePath, templateJS);

  return;
}

export function removeFile(path: string) {
  unlinkSync(path);

  return;
}