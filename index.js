const github = require("@actions/github");
const core = require("@actions/core");
const graphql = require("@octokit/graphql");

async function run() {
  const myToken = core.getInput("action-token");
  const projectUrl = core.getInput("project-url");
  const columnName = core.getInput("column-name");
  const octokit = new github.GitHub(myToken);
  const context = github.context;

  console.log(`Action triggered by issue #${context.issue.number}`);
}

run()
  .then(
    (response) => { console.log(`Finished running: ${response}`); },
    (error) => { 
      console.log(`#ERROR# ${error}`);
      process.exit(1); 
    }
  );
