const github = require("@actions/github");
const core = require("@actions/core");
const graphql = require("@octokit/graphql");

const addComment = async (octokit, issuesContext, comment) => {
  console.log(`   ~ addComment: comment="${comment}"`)
  console.log(`     + github.issues.createComment`);
  await octokit.issues.createComment({
    owner: issuesContext.payload.repository.owner.login,
    repo: issuesContext.payload.repository.name,
    issue_number: issuesContext.issue.number,
    body: comment,
  });
  console.log(`     - github.issues.createComment completed`);
};

async function run() {
  const myToken = core.getInput("action-token");
  const commentText = core.getInput("comment-text");
  const octokit = new github.GitHub(myToken);
  const context = github.context;
  
  console.log(
    `>> Action triggered by issue #${context.issue.number}`,
    `   << Comment on issue with a greeting: "${commentText}"`,
  );
  await addComment(octokit, context, commentText);
}

run()
  .then(
    (response) => { console.log(`Finished running: ${response}`); },
    (error) => { 
      console.log(`#ERROR# ${error}`);
      process.exit(1); 
    }
  );
