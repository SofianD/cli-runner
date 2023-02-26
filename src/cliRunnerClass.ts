// Import Node Deps
import { ChildProcess, fork } from "node:child_process";
import { unlinkSync } from "node:fs";
import { createInterface, Interface } from "node:readline";
import { Readable } from "node:stream";

// Import Internal Deps
import { createFileToTest } from "./mockFileToFork.js";
import { PathOfJsFile } from "./utils.js";

const kPathOfMockFile = "./mockFileToRunProcess.js";

interface ICliRunnerOptions {
  methodName?: string;
  filePath?: PathOfJsFile;
  args?: any[];
  methodPath?: PathOfJsFile;
}

export class CliRunner {
  childProcess: ChildProcess;
  expectedLines: string[];
  result: string[];
  private childProcessIsInitialized: boolean = false;
  private useMockFile: boolean;
  private filePath: PathOfJsFile;
  private args: string[];
  private interfaceAsReadable: Interface;

  constructor(options: ICliRunnerOptions = {}) {
    this.useMockFile = !options.filePath;

    this.filePath = this.useMockFile ? kPathOfMockFile : options.filePath;
    this.args = options.args ?? [];

    if (this.useMockFile) {
      const { methodPath, methodName } = options;

      if (!methodPath) {
        throw new Error("Require methodPath");
      }


      createFileToTest(methodPath, this.filePath, methodName);
    }
    
    const childProcess = fork(this.filePath, this.args, {
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });  
    
    if (this.useMockFile) {
      childProcess.once("close", unlinkSync.bind(null, kPathOfMockFile));
    }


    this.interfaceAsReadable = createInterface(childProcess.stdout as Readable);
    this.childProcess = childProcess;
  }

  initMockData(dataToSend: any = null) {
    this.childProcess.send(dataToSend);
    this.childProcessIsInitialized = true;

    return this;
  }

  getStream() {
    return this.interfaceAsReadable;
  }

  async getLines() {
    if (!this.childProcessIsInitialized) {
      this.initMockData();
    }

    const lines: string[] = [];
    for await (const line of this.interfaceAsReadable) {
      lines.push(line);
    }

    this.result = lines;

    return lines;
  }

  setExpectedLines(expectedLines: string[]) {
    if (!Array.isArray(expectedLines)) {
      throw new Error("'expectedLines' must be an array of string.");
    }

    this.expectedLines = expectedLines;

    return this;
  }

  async compare(
    fnToCompareLine: (lineReceived: string, expected: string) => void | Promise<void>,
    fnToCompareLength?: (resultArray: string[], expectedLinesArray: string[]) => void | Promise<void>
  ) {
    if (!this.expectedLines) {
      throw new Error("No expected lines to compare with the result. Please use 'setExpectedLines'.");
    }

    if (!this.result) {
      await this.getLines();
    }

    if (fnToCompareLength) {
      await fnToCompareLength(this.result, this.expectedLines);
    }
    
    for(let i = 0; i < this.result.length; i++) {
      await fnToCompareLine(this.result[i], this.expectedLines[i]);
    }

    return;
  }

  forceToCloseCli() {
    this.childProcess.kill();
  }

  write(cmd: string) {
    // TODO

    return this;
  }
}