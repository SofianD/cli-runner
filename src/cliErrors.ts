import { taggedString } from "./utils";

const Errors = {
  "CLI_ERR_MISS_VALUE": taggedString`Needs '${0}' value (given: ${1}).`,
  "CLI_ERR_TYPE_VALUE": taggedString`Wrong value'${0}' (given: ${1}).`
}

export class CliError extends Error {
  message: string;

  constructor(message: keyof typeof Errors, ...args: any[]) {
    const err = Errors[message];
    const msg = typeof err === "string" ? err : err(...args);

    super(msg);
  }
}