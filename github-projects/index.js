const conventions = require('./config/conventions');
const { defaultBoards } = require('./config/default-boards');

const createOnceBoards = async (octokit, context, boardsParam) => {
  const boards = boardsParam ? boardsParam : defaultBoards;
  console.log(`   ~ createOnceBoards: boards=${JSON.stringify(boards)}`);
  const existingBoards = getProjectBoards(octokit, context).map(existingBoard => (
    {
      board: existingBoard,
      columns: getBoardColumns(octokit, context, existingBoard.name),
    }
  ));
  boards.forEach(board => {
    let matchingBoards = existingBoards.filter( existingboard => (
      existingBoard.board.name === board.board
    ));
    if (!matchingBoards) {
      console.log(`createing board ${board.board}`);
      const createdBoard = await octokit.projects.createForRepo({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        name: board.board,
      });
      matchingBoards = [createdBoard.data];
    }
    matchingBoards.forEach(matchingBoard => {
      board.columns.forEach(column => {
        let neededColumns = matchingBoard.columns.filter( existingColumn => (
          existingColumn.name !== column.column
        ));
        neededColumns.forEach(neededColumn => {
          console.log(`creating column ${column.column} in board ${matchingBoard.name}`);
          await octokit.projects.createColumn({
            project_id: matchingBoard.id,
            name: column.column,
          });
        });
      });
    });
  });
}

const addComment = async (octokit, context, comment) => {
  console.log(`   ~ addComment: comment="${comment}"`)
  console.log(`     + github.issues.createComment`);
  await octokit.issues.createComment({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.issue.number,
    body: comment,
  });
  console.log(`     - github.issues.createComment completed`);
}

const getProjectBoards = async (octokit, context) => {
  console.log(`   ~ getProjectBoards`);
  console.log(`     + octokit.projects.listForRepo`);
  const projects = await octokit.projects.listForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  console.log(`     - octokit.projects.listForRepo completed`);
  console.log(`       boards: ${JSON.stringify(projects.data.map(board => board.name))}`);
  return projects.data ? projects.data : [];
}

const getProjectBoard = async (octokit, context, boardName) => {
  console.log(`   ~ getProjectBoard: boardName="${boardName}"`);
  const boards = getProjectBoards(octokit, context);
  const [board] = boards ? boards.filter(project => project.name === boardName) : [undefined];
  return board;
};

const getBoardColumns = async (octokit, context, board) => {
  console.log(`   ~ getBoardColumns: board.id=${board.id}`);
  console.log(`     + octokit.projects.listColumns`);
  const boardColumns = await octokit.projects.listColumns({ project_id: board.id });
  console.log(`     - octokit.projects.listColumns completed`);
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
  console.log(`     + octokit.projects.createCard`);
  await octokit.projects.createCard({
    column_id: column.id,
    content_id: context.payload.issue.id,
    content_type: 'Issue',
  });
  console.log(`     - octokit.projects.createCard completed`);
};

const getIssueLabels = (_, context) => {
  console.log(`getIssueLabels`);
  return context.payload.issue.labels.map(cur => cur.name);
};

const getBoardCardsMatchingIssue = async (octokit, context, boardName) => {
  console.log(`getBoardCardsMatchingIssue`);
  return await getBoardCardsMatchingIssueNumber(octokit, context, boardName, context.payload.issue.number);
};

const getBoardCardsMatchingIssueNumber = async (octokit, context, boardName, issueNumber) => {
  console.log(`getBoardCardsMatchtingIssueNumber`);
  let allMatchingCards = [];
  const columns = await getBoardColumnsByBoardName(octokit, context, boardName);
  for (const column of columns.data) {
    console.log(`octokit.projects.listCards`);
    const cards = await octokit.projects.listCards({ column_id: column.id });
    const matchingCards = cards.data.filter(card => {
      const [contentType, contentNumber] = card.content_url.split('/').slice(-2);
      return contentType === 'issues' && Number(contentNumber) === issueNumber;
    });
    allMatchingCards = [...allMatchingCards, ...matchingCards];
  }
  return allMatchingCards;
};

const moveCardsMatchingIssueInBoardToBoardColumnAtPosition = async (
  octokit,
  context,
  srcBoardNames,
  destBoardName,
  destColumnName,
  pos,
) => {
  console.log(`moveCardsMatchingIssueInBoardToBoardColumnAtPosition`);
  let matchingCards = [];
  let srcBoardName = undefined;
  if (Array.isArray(srcBoardNames)) {
    srcBoardName = srcBoardNames[0];
    for (const srcBoard of srcBoardNames) {
      const matches = await getBoardCardsMatchingIssue(octokit, context, srcBoard);
      if (matches.length > 0) {
        matchingCards = matches;
        srcBoardName = srcBoard;
      }
    }
  } else {
    srcBoardName = srcBoardNames;
    matchingCards = await getBoardCardsMatchingIssue(octokit, context, srcBoardName);
  }
  const columns = await getBoardColumnsByBoardName(octokit, context, destBoardName);
  for (const matchingCard of matchingCards) {
    const [tgtColumn] = columns.data.filter(column => column.name === destColumnName);
    console.log(`github.porjects.moveCard`);
    if (srcBoardName === destBoardName) {
      await octokit.projects.moveCard({
        card_id: matchingCard.id,
        position: pos,
        column_id: tgtColumn.id,
      });
    } else {
      // const [ , contentNumber ] = matchingCard.content_url.split('/').slice(-2);
      // const issueNumber = Number(contentNumber);
      await octokit.projects.createCard({
        column_id: tgtColumn.id,
        content_id: context.payload.issue.id,
        content_type: 'Issue',
      });
      await octokit.projects.deleteCard({ card_id: matchingCard.id });
    }
  }
};

const hasAssignee = (_, context) => {
  console.log(`hasAssignee`);
  return context.payload.issue.assignees.length > 0;
};

const commenterInIssueAssignees = (_, context) => {
  console.log(`commenterInIssueAssignees`);
  if (!Object.keys(context.payload).includes('comment')) return false;
  const commenter = context.payload.comment.user.login;
  const assignees = context.payload.issue.assignees.map(curr => curr.login);
  return assignees.filter(assignee => assignee === commenter).length > 0;
};

const findInsertionPoint = async (octokit, context, boardName, columnName) => {
  console.log(`findInsertionPoint`);
  const column = await getBoardColumnByNames(octokit, context, boardName, columnName);
  console.log(`octokit.projects.listCards`);
  const cards = await octokit.projects.listCards({ column_id: column.id });
  const cardsIssues = cards.data.map(card => {
    const [, contentNumber] = card.content_url.split('/').slice(-2);
    return [card.id, Number(contentNumber)];
  });
  let cardId = 0;
  let count = 0;
  for (const [card_id, issueNumber] of cardsIssues) {
    console.log(`github.issues.get`);
    const issue = await octokit.issues.get({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: issueNumber,
    });
    if (issue.data.labels.map(label => label.name).includes('commented')) {
      cardId = card_id;
    } else {
      return cardId === 0 ? 'top' : `after:${cardId}`;
    }
  }
  return `after:${cardId}`;
};

const moveCardsMatchingIssueInBoardToColumnAtPosition = async (octokit, context, boardName, columnName, pos) => {
  console.log(`moveCardsMatchingIssueInBoardToColumnAtPosition`);
  await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
    octokit,
    context,
    [boardName],
    boardName,
    columnName,
    pos,
  );
};

const issueHasMatchingBranches = async (octokit, context) => {
  console.log(`issueHasMatchingBranches`);
  const branches = await getAllBranches(octokit, context);
  console.log(`allBranches:`);
  for (const branch of branches) {
    console.log(`  name: ${branch['name']}`);
    for (const key of Object.keys(branch).filter(cur => cur != 'name')) {
      console.log(`    ${key}: ${branch[key]}`);
    }
  }
  const branchesMatchingIssue = await getAllBranchesMatchingIssue(octokit, context, branches);
  return branchesMatchingIssue.length > 0;
};

const moveCardsMatchingIssueToCorrectColumn = async (octokit, context) => {
  console.log(`moveCardsMatchingIssueToCorrectColumn`);
  const issueLabels = getIssueLabels(octokit, context);
  if (issueLabels.includes('spin off')) {
    console.log(`<< has spin off label`);
    console.log('>> move card to declined board spin off column @bottom');
    await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
      octokit,
      context,
      ['triage', 'questions', 'declined'],
      'declined',
      'spin off',
      'bottom',
    );
  } else if (issueLabels.includes('duplicate')) {
    console.log(`<< has duplicate label`);
    console.log('>> move card to declined board duplicate column @bottom');
    await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
      octokit, 
      context,
      ['triage', 'questions', 'declined'],
      'declined',
      'duplicate',
      'bottom',
    );
  } else if (issueLabels.includes('declined')) {
    console.log(`<< has declined label`);
    console.log('>> move card to declined board declined column @bottom');
    await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
      octokit,
      context,
      ['triage', 'questions', 'declined'],
      'declined',
      'declined',
      'bottom',
    );
  } else if (issueLabels.includes('question')) {
    console.log('<< has question label');
    if (issueLabels.includes('commented')) {
      console.log(`<< has commented label`);
      // if has assignee and commentor is assignee
      if (hasAssignee(octokit, context) && commenterInIssueAssignees(octokit, context)) {
        console.log(`<< commenter is assignee`);
        // move to responded
        const insertionPoint = await findInsertionPoint(octokit, context, 'questions', 'responded');
        console.log(`insertionPoint ${insertionPoint}`);
        console.log('>> move card to questions board responded column');
        await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
          octokit,
          context,
          ['triage', 'questions', 'declined'],
          'questions',
          'responded',
          insertionPoint,
        );
      } else {
        // if has commented label, move to bottom of commented cards,
        // not all the way to the bottom of the column
        const insertionPoint = await findInsertionPoint(octokit, context, 'questions', 'question');
        console.log(`insertionPoint ${insertionPoint}`);
        console.log('>> move card to questions board question column');
        await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
          octokit,
          context,
          ['triage', 'questions', 'declined'],
          'questions',
          'question',
          insertionPoint,
        );
      }
    } else {
      console.log(`<< no commented label`);
      if (hasAssignee(octokit, context) && commenterInIssueAssignees(octokit, context)) {
        console.log(`<< commenter is assignee`);
        console.log('>> move card to questions board responded column @bottom');
        await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
          octokit,
          context,
          ['triage', 'questions', 'declined'],
          'questions',
          'responded',
          'bottom',
        );
      } else {
        console.log('>> move card to questions board question column @bottom');
        await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
          octokit,
          context,
          ['triage', 'questions', 'declined'],
          'questions',
          'question',
          'bottom',
        );
      }
    }
  } else {
    if (issueLabels.includes('more info please')) {
      console.log('<< has more info label');
      console.log('>> move card to more info please column');
      if (issueLabels.includes('commented')) {
        // if has commented label, move to bottom of commented cards,
        // not all the way to the bottom of the column
        const insertionPoint = await findInsertionPoint(octokit, context, 'triage', 'more info please');
        console.log(`insertionPoint ${insertionPoint}`);
        await moveCardsMatchingIssueInBoardToColumnAtPosition(
          octokit,
          context,
          'triage',
          'more info please',
          insertionPoint,
        );
      } else {
        await moveCardsMatchingIssueInBoardToColumnAtPosition(
          octokit,
          context,
          'triage',
          'more info please',
          'bottom',
        );
      }
    } else if (Object.keys(conventions).filter(key => issueLabels.includes(key)).length === 0) {
      console.log('<< has no conventions key');
      console.log('>> move card to awaiting review column');
      await moveCardsMatchingIssueInBoardToColumnAtPosition(octokit, context, 'triage', 'awaiting review', 'bottom');
    } else if (issueLabels.includes('WIP')) {
      console.log('<< has WIP label');
      console.log('>> move card to WIP column');
      await moveCardsMatchingIssueInBoardToColumnAtPosition(octokit, context, 'triage', 'WIP', 'bottom');
    } else if (hasAssignee(octokit, context)) {
      console.log('<< has assignee');
      console.log('>> move card to assigned column');
      await moveCardsMatchingIssueInBoardToColumnAtPosition(octokit, context, 'triage', 'assigned', 'bottom');
    } else {
      console.log('>> move card to backlog column');
      await moveCardsMatchingIssueInBoardToColumnAtPosition(octokit, context, 'triage', 'backlog', 'bottom');
    }
    if (issueHasMatchingBranches(octokit, context) && !getIssueLabels(octokit, context).includes('WIP')) {
      addComment(['WIP']);
    }
  }
};

module.exports = {
  addComment,
  createCardFromIssue,
  moveCardsMatchingIssueToCorrectColumn,
  createOnceBoards,
};