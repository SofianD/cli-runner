Pb:
- refacto mdr
- fetch les constantes présentes  dans la fonction (MemberExpression je crois) passé en argument (RunOptions.fn). Comme ça plus besoin de déclarer les constantes ;)
- gérer les destructurations etc
- flemme
- le nom

## USAGE 
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

// CONSTANTS
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kProcessDir = path.join(__dirname, "..", "process");
const kProcessPath = path.join(kProcessDir, "scorecard.js");
const MockCli = new cliRunner.MockCliBuilder(fileURLToPath(import.meta.url));

tap.test("scorecard should display fastify scorecard", async(tape) => {
  MockCli.mark("KEKW");

  const packageName = "fastify/fastifyyyyyy";
  const mockBody = {
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
  };

  function doItInAnotherProcess() {
    const undiciMockAgentOptions = {
      baseUrl: API_URL,
      intercept: {
        path: `/projects/github.com/${packageName}`,
        method: "GET"
      },
      response: {
        body: mockBody,
        status: 200
      }
    };

    const { response } = undiciMockAgentOptions;
    const mockAgent = new MockAgent();
    const pool = mockAgent.get(undiciMockAgentOptions.baseUrl);

    mockAgent.disableNetConnect();
    pool.intercept(undiciMockAgentOptions.intercept).reply(response.status, () => response.body);
    setGlobalDispatcher(mockAgent);

    scorecard.main(packageName).then(() => process.exit(0));
  }

  const expectedLines = getExpectedScorecardLines(packageName, mockBody);
  const givenLines = await MockCli.run({
    fn: doItInAnotherProcess,
    constants: ["mockBody", "packageName"]
  });

  tape.same(givenLines, expectedLines, `lines should be ${expectedLines}`);
  tape.end();
});
```

### Exemple du fichier créé par le cli-runner pour mock

```js
import {fileURLToPath} from "node:url";
import path from "node:path";
import tap from "tap";
import {API_URL} from "@nodesecure/ossf-scorecard-sdk";
import {MockAgent, setGlobalDispatcher} from "undici";
import {getExpectedScorecardLines} from "../helpers/utils.js";
import * as scorecard from "../../src/commands/scorecard.js";

const packageName = "fastify/fastifyyyyyy";
const mockBody = {
  date: "2222-12-31",
  repo: {
    name: `github.com/${packageName}`
  },
  score: 5.2,
  checks: [{
    name: "Maintained",
    score: -1,
    reason: "Package is maintained"
  }]
};

function doItInAnotherProcess() {
  const undiciMockAgentOptions = {
    baseUrl: API_URL,
    intercept: {
      path: `/projects/github.com/${packageName}`,
      method: "GET"
    },
    response: {
      body: mockBody,
      status: 200
    }
  };

  const { baseUrl, intercept, response } = undiciMockAgentOptions;
  const mockAgent = new MockAgent();
  const pool = mockAgent.get(baseUrl);

  mockAgent.disableNetConnect();
  pool.intercept(intercept).reply(response.status, () => response.body);
  setGlobalDispatcher(mockAgent);

  scorecard.main(packageName).then(() => process.exit(0));
}

try {
	doItInAnotherProcess();
}
catch (error) {
	console.log(error);
	process.exit(1);
}
```
Bientôt:

⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⠂⠀⠀⠀⠀⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣀⠀⠀⠀⠀⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⠀⢠⣾⣿⣿⣿⣿⣿⣿⣦⠀

⠀⠀⠀⠀⠀⠀⣴⣿⢿⣷⠒⠲⣾⣾⣿⣿

⠀⠀⠀⠀⣴⣿⠟⠁⠀⢿⣿⠁⣿⣿⣿⠻⣿⣄⠀⠀⠀⠀

⠀⠀⣠⡾⠟⠁⠀⠀⠀⢸⣿⣸⣿⣿⣿⣆⠙⢿⣷⡀⠀⠀

⣰⡿⠋⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⠀⠀⠉⠻⣿⡀

⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣆⠂⠀

⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⡿⣿⣿⣿⣿⡄⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⠿⠟⠀⠀⠻⣿⣿⡇⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⢀⣾⡿⠃⠀⠀⠀⠀⠀⠘⢿⣿⡀⠀⠀⠀

⠀⠀⠀⠀⠀⣰⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣷⡀⠀⠀

⠀⠀⠀⠀⢠⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣿⣧⠀⠀

⠀⠀⠀⢀⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣆⠀

⠀⠀⠠⢾⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣷⡤⠄
