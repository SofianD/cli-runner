// Import Node.js Dependencies
import { writeFileSync, unlinkSync } from "node:fs";

export function createFileToTest({ pathMethod, isDefaultMethod, filePath }) {
const templateJS =
`const f = require("${pathMethod}");
const { runCliCommand } = require("./dist/index.js");

const args = process.argv.slice(2).join(" ");

const options = {
  args
};

runCliCommand(f, options);` ;

  writeFileSync(filePath, templateJS);

  return;
}

export function removeFile(path: string) {
  unlinkSync(path);

  return;
}