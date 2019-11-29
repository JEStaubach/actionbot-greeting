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

const getProjectBoard = async (octokit, context, boardName) => {
  console.log(`   ~ getProjectBoard: boardName="${boardName}"`);
  console.log(`     + github.projects.listForRepo`);
  const projects = await octokit.projects.listForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  console.log(`     - github.projects.listForRepo completed`);
  const [board] = projects.data.filter(project => project.name === boardName);
  return board;
};


const getBoardColumns = async (octokit, context, board) => {
  console.log(`   ~ getBoardColumns: board.id=${board.id}`);
  console.log(`     + github.projects.listColumns`);
  const boardColumns = await octokit.projects.listColumns({ project_id: board.id });
  console.log(`     - github.projects.listColumns completed`);
  return boardColumns;
};

const getBoardColumnsByBoardName = async (octokit, context, boardName) => {
  console.log(`   ~ getBoardColumnsByBoardName: boardName="${boardName}"`);
  const board = await getProjectBoard(octokit, context, boardName);
  return await getBoardColumns(octokit, context, board);
};

const getBoardColumnByNames = async (octokit, context, boardName, columnName) => {
  console.log(`   ~ getBoardColumnByNames: boardName="${boardName}" columnName="${columnName}"`);
  const columns = await getBoardColumnsByBoardName(octokit, context, boardName);
  const [boardColumn] = columns.data.filter(column => column.name === columnName);
  return boardColumn;
};

const createCardFromIssue = async (octokit, context, { boardName, columnName }) => {
  console.log(`   ~ createCardFromIssue: boardName="${boardName}" columnName="${columnName}"`);
  const column = await getBoardColumnByNames(octokit, context, boardName, columnName);
  console.log(`     + github.projects.createCard`);
  await octokit.projects.createCard({
    column_id: column.id,
    content_id: context.payload.issue.id,
    content_type: 'Issue',
  });
  console.log(`     - github.projects.createCard completed`);
};

async function run() {
  const myToken = core.getInput("action-token");
  const commentText = core.getInput("comment-text");
  const boardName = core.getInput("board-name");
  const columnName = core.getInput("column-name");
  const octokit = new github.GitHub(myToken);
  const context = github.context;
  
  console.log(
    `>> Action triggered by issue #${context.issue.number}`,
    `   << Comment on issue with a greeting: "${commentText}"`,
    `   << Create card on project board "${boardName}" in column "${columnName}"`
  );
  await addComment(octokit, context, commentText);
  await createCardFromIssue(octokit, context, { boardName, columnName });
}

run()
  .then(
    (response) => { console.log(`Finished running: ${response}`); },
    (error) => { 
      console.log(`#ERROR# ${error}`);
      process.exit(1); 
    }
  );
