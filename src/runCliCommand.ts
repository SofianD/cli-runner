type fn<T = any> = (...args: any[]) => T | Promise<T>;

function setDefaultContext(cb: fn,  args: (string | number)[]) {
  return async function(data: any) {
    try {
      if (!data) {
        await cb(args);
        
        process.exit(0);
      }
   
      const t = data.methodName ? cb[data.methodName] : cb;
      await t(args);
   
      process.exit(0);
     }
     catch (error) {
      console.log(error);
   
      process.exit(1);
     }
  }
}

interface IRunCliCommand {
  args?: (string | number)[];
  customContext?: typeof setDefaultContext;
}

export async function runCliCommand(cb: fn<void>, options: IRunCliCommand) {
  const { args } = options;

  const msgEventAction = options.customContext ?? setDefaultContext
  process.once("message", msgEventAction(cb, args));
}
