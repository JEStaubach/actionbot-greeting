const github = require("@actions/github");
const core = require("@actions/core");
const graphql = require("@octokit/graphql");

const addComment = async (issuesContext, comment) => {
  console.log(`   ~ addComment: comment="${comment}"`)
  const issueComment = issuesContext.issue({ body: comment });
  console.log(`     + github.issues.createComment`);
  await issuesContext.github.issues.createComment(issueComment);
  console.log(`     - github.issues.createComment completed`);
};

const getProjectBoard = async (context, boardName) => {
  console.log(`   ~ getProjectBoard: boardName="${boardName}"`);
  console.log(`     + github.projects.listForRepo`);
  const projects = await context.github.projects.listForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  console.log(`     - github.projects.listForRepo completed`);
  const [board] = projects.data.filter(project => project.name === boardName);
  return board;
};


const getBoardColumns = async (context, board) => {
  console.log(`   ~ getBoardColumns: board.id=${board.id}`);
  console.log(`     + github.projects.listColumns`);
  const boardColumns = await context.github.projects.listColumns({ project_id: board.id });
  console.log(`     - github.projects.listColumns completed`);
  return boardColumns;
};

const getBoardColumnsByBoardName = async (context, boardName) => {
  console.log(`   ~ getBoardColumnsByBoardName: boardName="${boardName}"`);
  const board = await getProjectBoard(context, boardName);
  return await getBoardColumns(context, board);
};

const getBoardColumnByNames = async (context, boardName, columnName) => {
  console.log(`   ~ getBoardColumnByNames: boardName="${boardName}" columnName="${columnName}"`);
  const columns = await getBoardColumnsByBoardName(context, boardName);
  const [boardColumn] = columns.data.filter(column => column.name === columnName);
  return boardColumn;
};

const createCardFromIssue = async (context, { boardName, columnName }) => {
  console.log(`   ~ createCardFromIssue: boardName="${boardName}" columnName="${columnName}"`);
  const column = await getBoardColumnByNames(context, boardName, columnName);
  console.log(`     + github.projects.createCard`);
  await context.github.projects.createCard({
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
  await addComment(context, commentText);
  await createCardFromIssue(context, { boardName, columnName });
}

run()
  .then(
    (response) => { console.log(`Finished running: ${response}`); },
    (error) => { 
      console.log(`#ERROR# ${error}`);
      process.exit(1); 
    }
  );
