// Import Node.js Dependencies
import { fork } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

// Import Internal Dependencies
import { createFileToTest, removeFile } from "./mockFileToFork.js";
import { CliError } from "./cliErrors.js";
import { PathOfJsFile } from "./utils.js";

export { runCliCommand } from "./runCliCommand.js"

// CONSTANTS
const kPathOfMockFile = "./oui.js";

function initChildProcess(options: { filePath: PathOfJsFile, args: any[], dataToSend: any }) {
  const { filePath, args, dataToSend = null } = options;

  const childProcess = fork(filePath, args, {
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  childProcess.send(dataToSend);

  return childProcess;
}

interface IMockCliOptions {
  methodPath: PathOfJsFile;
  methodName?: string;
  filePath?: PathOfJsFile;
  isDefaultMethod?: boolean;
  args?: any[];
  dataToSend?: any;
  keepAlive: boolean;
}

export async function mockCli(options: IMockCliOptions) {
  const useMockFile = !options.filePath;
  const filePath = useMockFile ? kPathOfMockFile : options.filePath;

  if (typeof filePath !== "string") {
    throw new CliError("CLI_ERR_TYPE_VALUE", "options.filePath", options.filePath);
  }

  if (useMockFile) {
    if (typeof options.methodPath !== "string") {
      throw new CliError("CLI_ERR_TYPE_VALUE", "options.methodPath", options.methodPath);
    }

    createFileToTest(options.methodPath, filePath);
  }

  const childProcess = fork(filePath, options.args, {
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  childProcess.send(options.dataToSend);

  if (useMockFile) {
    childProcess.once("close", removeFile.bind(null, kPathOfMockFile));
  }

  const rStream = createInterface(childProcess.stdout as Readable);
  const lines: string[] = [];

  for await (const line of rStream) {
    lines.push(line);
  }

  if (!options.keepAlive) {
    childProcess.kill();
  }

  return lines;
}
