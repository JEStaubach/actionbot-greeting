const github = require("@actions/github");
const core = require("@actions/core");
const graphql = require("@octokit/graphql");
const actions = require("@jestaubach/actions");

async function run() {
  const myToken = process.env.ACTION_TOKEN ? process.env.ACTION_TOKEN : core.getInput("action-token");
  const boardName = process.env.BOARD_NAME ? process.env.BOARD_NAME : core.getInput("board-name");
  const columnName = process.env.COLUMN_NAME ? process.env.COLUMN_NAME : core.getInput("column-name");
  const octokit = new github.GitHub(myToken);
  const context = github.context;
  
  console.log(
    `>> Action triggered by issue #${context.issue.number}\n`,
    `   << Create card on project board "${boardName}" in column "${columnName}"`
  );
  await actions.githubProjects.createCardFromIssue(octokit, context, { boardName, columnName });
}

run()
  .then(
    (response) => { console.log(`Finished running: ${response}`); },
    (error) => { 
      console.log(`#ERROR# ${error}`);
      process.exit(1); 
    }
  );
