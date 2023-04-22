Pb: duplication de la data actuellement mais ez et refacto

```js
// Import Node.js Dependencies
import { fileURLToPath } from "node:url";
import path from "node:path";

// Import Third-party Dependencies
import tap from "tap";
import { MockAgent, setGlobalDispatcher } from "undici";
import { API_URL } from "@nodesecure/ossf-scorecard-sdk";

// Import Internal Dependencies
import cliRunner from "../../../cliRunner/dist/buildCliRunnerClass.js";
import * as scorecard from "../../src/commands/scorecard.js";
import { getExpectedScorecardLines } from "../helpers/utils.js";

const MockCli = new cliRunner.MockCliBuilder(fileURLToPath(import.meta.url));

tap.test("scorecard should display fastify scorecard", async(tape) => {
  function abcd() {
    const packageName = "fastify/fastify";
    const undiciMockAgentOptions = {
      intercept: {
        path: `/projects/github.com/${packageName}`,
        method: "GET"
      },
      response: {
        body: {
          date: "2222-12-31",
          repo: {
            name: `github.com/${packageName}`
          },
          score: 5.2,
          checks: [
            {
              name: "Maintained",
              score: -1,
              reason: "Package is maintained"
            }
          ]
        },
        status: 200
      }
    };
    const mockAgent = new MockAgent();
    const pool = mockAgent.get(API_URL);
    const { intercept, response } = undiciMockAgentOptions;
  
    mockAgent.disableNetConnect();
    pool.intercept(intercept).reply(response.status, () => response.body);
    setGlobalDispatcher(mockAgent);
  
    scorecard.main(packageName).then(() => process.exit(0));
  }
  
  const givenLines = await MockCli.run({ fn: abcd });
  const expectedLines = getExpectedScorecardLines("fastify/fastify", {
    date: "2222-12-31",
    repo: {
      name: `github.com/${"fastify/fastify"}`
    },
    score: 5.2,
    checks: [
      {
        name: "Maintained",
        score: -1,
        reason: "Package is maintained"
      }
    ]
  });

  tape.same(givenLines, expectedLines, `lines should be ${expectedLines}`);
  tape.end();
});
```