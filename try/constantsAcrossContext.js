const { writeFile } = require("fs/promises");
const { MockCliBuilder } = require("../dist/buildCliRunnerClass.js");
const { generate } = require("astring");
const { join } = require("path");

const builder = new MockCliBuilder(__filename, {
  module: false,
  deleteMockFile: false
});

async function test(str, fn) {
  console.log(str);

  await fn();
}

async function describe(str, fn) {
  console.log(str);

  await fn();
}

const abc = { a: 1, b: 2, c: 3 };

describe("describe 1", () => { 
  const abc = { a: 156 };
  const abc32 = "abc32" + String(abc.a);

  describe("describe 2", () => { 
    const def = "DEF" + abc32;
    const def2 = "2" + def;

    test('MONFON TEFESTEUFEU', async() => {
      builder.mark("mon premier test");
      const ghi = "GHI" + def2;
      const ghssssi = "3" + ghi;

      function mockFn() {
        console.log(ghi);
    
        process.exit(0);
      }
    
      const [ast] = [...builder.getContextBasedOnTheMarkV2()];  
      const constantsToImport = new Set(["ghi","abc","abc32","def","def2","ghssssi"]);
      const matchedConstants = [];
      function* getConstantsAcrossCtxs(parentObj) {
        const { ctx, parent } = parentObj;

        const matchedConstsInCurrentCtx = [];
        for (const statement of ctx) {
          if (statement.type === "VariableDeclaration") {
            const declaration = statement.declarations[0];
            if (declaration.type === "VariableDeclarator") {
              if (constantsToImport.has(declaration.id.name)) {
                matchedConstsInCurrentCtx.push(statement);
                constantsToImport.delete(declaration.id.name);
              }
            }
          }
        }

        matchedConstants.push(...matchedConstsInCurrentCtx.reverse());
  
        if (parent && constantsToImport.size > 0) {
          [...getConstantsAcrossCtxs(parent)];
        }
      }

      console.log(constantsToImport);
      [...getConstantsAcrossCtxs(ast)];
      console.log(constantsToImport);

      if (constantsToImport.size > 0) {
        throw new Error(`Cannot find constants: ${[...constantsToImport.values()].join(" - ")}`)
      }

      const prog = {
        type: "Program",
        sourceType: "module",
        body: matchedConstants.reverse()
      }
      const oui = generate(prog);
      await writeFile(join(__dirname, "duplicateContext.js"), oui);

      console.log(oui);
    })
  })
})
