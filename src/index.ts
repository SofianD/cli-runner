// Import Node.js Dependencies
import { fork } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

// Import Internal Dependencies
import { createFileToTest, removeFile } from "./mockFileToFork.js";
import { CliError } from "./cliErrors.js";
import { FilePath } from "./utils.js";

export { runCliCommand } from "./runCliCommand.js"

// CONSTANTS
const kPathToGeneratedFile = "./oui.js";

function initChildProcess(options: { filePath: FilePath, args: any[], dataToSend: any }) {
  const { filePath, args, dataToSend = null } = options;

  const childProcess = fork(filePath, args, {
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  childProcess.send(dataToSend);

  return childProcess;
}

interface IMockCliOptions {
  methodPath: FilePath;
  methodName?: string;
  filePath?: FilePath;
  isDefaultMethod?: boolean;
  args?: any[];
  dataToSend?: any;
  keepAlive: boolean;
}

export async function mockCli(options: IMockCliOptions) {
  const genereateMockFile = !options.filePath;
  const filePath = genereateMockFile ? kPathToGeneratedFile : options.filePath;

  if (typeof filePath !== "string") {
    throw new CliError("CLI_ERR_MISS_VALUE", "options.filePath", options.filePath);
  }

  if (genereateMockFile) {
    if (typeof options.methodPath !== "string") {
      throw new CliError("CLI_ERR_TYPE_VALUE", "options.methodPath", options.methodPath);
    }

    createFileToTest({
      pathMethod: options.methodPath,
      isDefaultMethod: Boolean(options.isDefaultMethod),
      filePath
    });
  }

  const childProcess = initChildProcess({
    filePath,
    args: options.args ?? [],
    dataToSend: options
  });

  if (genereateMockFile) {
    childProcess.once("close", removeFile.bind(null, filePath));
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
