const conventions = require('./config/conventions');
const { defaultBoards } = require('./config/default-boards');
const { defaultLabels } = require('./config/default-labels');

const getProjectLabels = async (octokit, context) => {
  console.log(`   ~ getProjectLabels`);
  console.log(`     + octokit.issues.listLabelsForRepo`);
  const labels = await octokit.issues.listLabelsForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  console.log(`     - octokit.issues.listLabelsForRepo completed`);
  console.log(`       labels: ${JSON.stringify(labels)}`);
  return labels.data ? labels.data : [];
}

const createOnceLabels = async (octokit, context, labelsParam) => {
  const labels = defaultLabels;
  console.log(`   ~ createOnceLabels: labels=${JSON.stringify(labels)}`);
  const repoLabels = await getProjectLabels(octokit, context);
  console.log(`repoLabels: ${JSON.stringify(repoLabels)}`);
  for (repoLabel of repoLabels) {
    const matchingLabels = labels.filter(label => label.name === repoLabel.name);
    if (matchingLabels.length === 0) {
      console.log(`deleting label ${repoLabel.name}`);
      await octokit.issues.deleteLabel({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        name: repoLabel.name,
      })
    }
  }
  for (label of labels) {
    console.log(`label: ${JSON.stringify(label)}`);
    const matchingLabels = repoLabels.filter(repoLabel => (label.name === repoLabel.name));
    if (matchingLabels.length === 0) {
      console.log(`creating label ${label.name}`);
      await octokit.issues.createLabel({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } else {
      console.log(`ml: ${matchingLabels[0].name}, ${matchingLabels[0].color}, ${matchingLabels[0].description}`);
      console.log(`ls: ${label.name}, ${label.color}, ${label.description}`);
      if (matchingLabels[0].color !== label.color || matchingLabels[0].description !== label.description) {
        console.log(`updating label ${label.name}`);
        await octokit.issues.updateLabel({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          current_name: label.name,
          new_name: label.name,
          color: label.color,
          description: label.description,
        });
      }
    }
  }
};

const createOnceBoards = async (octokit, context, boardsParam) => {
  // const boards = boardsParam ? boardsParam : defaultBoards;
  const boards = defaultBoards;
  console.log(`   ~ createOnceBoards: boards=${JSON.stringify(boards)}`);
  const repoBoards = await getProjectBoards(octokit, context);
  console.log(`repoBoards: ${JSON.stringify(repoBoards)}`);
  const existingBoards = [];
  for (repoBoard of repoBoards) {
    console.log(`repoBoard: ${JSON.stringify(repoBoard)}`);
    const cols = await getBoardColumns(octokit, context, repoBoard);
    existingBoards.push({board: repoBoard, columns: cols.data});
  }
  console.log(`existing boards: ${JSON.stringify(existingBoards)}`);
  for (board of boards) {
    console.log(`board: ${board.board}`);
    let matchingBoards = existingBoards.filter( existingBoard => (
      existingBoard.board.name === board.board
    ));
    console.log(`matchingBoards: ${JSON.stringify(matchingBoards)}`);
    if (!matchingBoards.length > 0) {
      console.log(`creating board ${board.board}`);
      const createdBoard = await octokit.projects.createForRepo({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        name: board.board,
      });
      await createOnceBoards(octokit, context, boardsParam);
      return;
    }
    for (matchingBoard of matchingBoards) {
      console.log(`matchingBoard: ${JSON.stringify(matchingBoard)}`);
      for (column of board.columns) {
        console.log(`column: ${JSON.stringify(column)}`);
        let matchingColumns = matchingBoard.columns.filter( existingColumn => (
          existingColumn.name === column.column
        ));
        if (!matchingColumns.length > 0) {
          console.log(`neededColumn: ${JSON.stringify(column.column)}`);
          console.log(`creating column ${column.column} in board ${matchingBoard.board.name}`);
          await octokit.projects.createColumn({
            project_id: matchingBoard.board.id,
            name: column.column,
          });
        };
      };
    };
  };
}

const addComment = async (octokit, context, comment) => {
  console.log(`   ~ addComment: comment="${comment}"`)
  console.log(`     + github.issues.createComment`);
  /*
  await octokit.issues.createComment({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.issue.number,
    body: comment,
  });
  */
  const foobar = await octokit.graphql(
    `
      query($owner: String!, $repo: String!) {
        repositories(owner: $owner, name: $repo) {
          issues(last: 3) {
            edges {
              node {
                title
              }
            }
          }
        }
      }
    `,
    {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.issue.number,
      body: comment,
    }
  );
  console.log(`foobar: ${JSON.stringify(foobar)}`);
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
  const boards = await getProjectBoards(octokit, context);
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
    const hasMatchingBranches = await issueHasMatchingBranches(octokit, context);
    if (hasMatchingBranches && !getIssueLabels(octokit, context).includes('WIP')) {
      await addLabels(octokit, context, ['WIP']);
      await moveCardsMatchingIssueInBoardToColumnAtPosition(octokit, context, 'triage', 'WIP', 'bottom');
    }
  }
};

const isCardMatchingIssueInBoardColumn = async (octokit, context, boardName, columnName) => {
  console.log(`isCardMatchingIssueInBoardColumn`);
  const column = await getBoardColumnByNames(octokit, context, boardName, columnName);
  console.log(`github.projects.listCards`);
  const columnCards = await octokit.projects.listCards({ column_id: column.id });
  console.log(`columnCards: ${columnCards}`);
  const matchingCards = await getBoardCardsMatchingIssue(octokit, context, boardName);
  for (const matchingCard of matchingCards) {
    console.log(`matchingCard: ${matchingCard.id}`);
    for (const columnCard of columnCards.data) {
      console.log(`  columnCard: ${columnCard.id}`);
      if (matchingCard.id === columnCard.id) {
        console.log(`   match: ${matchingCard.id} ${columnCard.id}`);
        return true;
      }
    }
  }
  return false;
};

const addLabels = async (octokit, context, labels) => {
  console.log(`addLabels`);
  console.log(`github.issues.addLabels`);
  await octokit.issues.addLabels({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
    labels,
  });
};

const adjustCommentedLabel = async (octokit, context) => {
  console.log(`on issue_comment.created`);
  console.log('issue_comment.created');
  if (context.payload.comment.user.login !== 'github-actions[bot]') {
    console.log('<< comment from !== github-actions[bot]');
    const isInMoreColumn = await isCardMatchingIssueInBoardColumn(octokit, context, 'triage', 'more info please');
    const isInQuestionColumn = await isCardMatchingIssueInBoardColumn(octokit, context, 'questions', 'question');
    const isInRespondedColumn = await isCardMatchingIssueInBoardColumn(octokit, context, 'questions', 'responded');
    if (isInMoreColumn) {
      console.log('<< issue in more info please column');
      if (!commenterInIssueAssignees(octokit, context)) {
        console.log('>> commenter not assigneee, add commented label');
        await addLabels(octokit, context, ['commented']);
      }
      await moveCardsMatchingIssueToCorrectColumn(octokit, context);
    } else if (isInQuestionColumn || isInRespondedColumn) {
      console.log('<< issue question  or responded column');
      if (!commenterInIssueAssignees(octokit, context)) {
        console.log('>> commenter not assignee, add commented label');
        await addLabels(octokit, context, ['commented']);
      }
      await moveCardsMatchingIssueToCorrectColumn(octokit, context);
    }
  }
};

const addConventionalTitle = async (octokit, context, issueType) => {
  console.log(`addConventionalTitle`);
  console.log(`context: ${JSON.stringify(context)}`);
  let issueTitle = context.payload.issue.title;
  Object.values(conventions).map(cur => {
    const re = `^${cur}\h*[:,\.\h]+\h*`;
    const regex = new RegExp(re, 'i');
    issueTitle = issueTitle.replace(regex, '');
  });
  const title = `${conventions[issueType]}: ${issueTitle}`;
  console.log(`github.issues.update`);
  if (issueTitle !== title) {
    await octokit.issues.update({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.issue.number,
      title,
    });
  } else {
    console.log('no change to conventional title');
  }
};

const removeLabels = async (octokit, context, labelsToRemove) => {
  console.log(`removeLabels`);
  console.log(`github.issues.listLabelsOnIssue`);
  const labels = await octokit.issues.listLabelsOnIssue({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
  });
  const labelNames = labels.data.map(cur => cur.name);
  for (const labelToRemove of labelsToRemove) {
    if (labelNames.includes(labelToRemove)) {
      console.log(`remove label ${labelToRemove}`);
      await octokit.issues.removeLabel({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        number: context.payload.issue.number,
        name: labelToRemove,
      });
    }
  }
};

const adjustLabelsToConventions = async (octokit, context) => {
  console.log(`on issues.labeled`);
  console.log('issues.labeled');
  const issueLabels = getIssueLabels(octokit, context);
  if (Object.keys(conventions).includes(context.payload.label.name)) {
    const otherConventionLabels = Object.keys(conventions)
      .filter(convention => convention !== context.payload.label.name)
      .filter(key => issueLabels.includes(key));
    console.log('>> remove other convents, more info please, and commented labels');
    await removeLabels(octokit, context, [...otherConventionLabels, 'more info please', 'commented']);
  }
}

const adjustTitleToConventions = async (octokit, context) => {
  console.log(`on issues.labeled`);
  console.log('issues.labeled');
  if (Object.keys(conventions).includes(context.payload.label.name)) {
    console.log('<< convention label');
    await addConventionalTitle(octokit, context, context.payload.label.name);
  }
};

const getForks = async (octokit, context) => {
  console.log(`getForks`);
  console.log(`github.repos.listForks`);
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  console.log(`      owner: ${owner}`);
  console.log(`      repo: ${repo}`);

  const forks = await octokit.repos.listForks({ owner, repo });
  forks.data.map(fork => {
    // console.log(`in forks: ${JSON.stringify(fork)}`)
    console.log(`fork found ${fork.owner.login}/${fork.name}`);
  });
  return forks.data;
};

const getForkBranches = async (octokit, context, fork) => {
  console.log(`getForkBranches`);
  console.log(`github.repos.listBranches`);
  const branches = await octokit.repos.listBranches({
    owner: fork.owner.login,
    repo: fork.name,
  });
  branches.data.map(branch => {
    console.log(`fork ${fork.owner.login}/${fork.name} branch ${branch.name}`);
  });
  return branches.data;
};

const getBranchesOfForks = async (octokit, context) => {
  console.log(`getBranchesOfForks`);
  const forks = await getForks(octokit,context);
  let allBranches = [];
  for (const fork of forks) {
    const branches = await getForkBranches(octokit, context, fork);
    allBranches = [...allBranches, ...branches];
  }
  return allBranches;
};

const getBranches = async (octokit, context) => {
  console.log(`getBranches`);
  console.log(`github.repos.listBranches`);
  const branches = await octokit.repos.listBranches({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  return branches.data;
};

const getAllBranches = async (octokit, context) => {
  console.log(`getAllBranches`);
  const branches = await getBranches(octokit, context);
  const forkBranches = await getBranchesOfForks(octokit, context);
  return [...branches, ...forkBranches];
};

const getAllBranchesMatchingIssue = async (_, context, branches) => {
  console.log(`getAllBranchesMatchingIssue`);
  const issueTitle = context.payload.issue.title;
  const colon = issueTitle.indexOf(':');
  if (colon === -1) {
    return [];
  }
  const abbrev = issueTitle.slice(0, colon);
  const issueNumber = context.payload.issue.number;
  const branchText = `${abbrev}-${issueNumber}`;
  return branches.filter(branch => {
    console.log(`branch.name ${branch.name} branchText ${branchText}`);
    return branch.name.match(branchText);
  });
};

const getRepoBranches = async(octokit, context) => {
  const branches = await getAllBranches(octokit, context);
  console.log(`allBranches:`);
  for (const branch of branches) {
    console.log(`  name: ${branch['name']}`);
    for (const key of Object.keys(branch).filter(cur => cur != 'name')) {
      console.log(`    ${key}: ${branch[key]}`);
    }
  }
  return branches;
}

const getRepoIssues = async (octokit, context) => {
  console.log(`getRepoIssues`);
  console.log(`github.issues.listForRepo`);
  const issues = await octokit.issues.listForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  console.log(`issues: ${issues}`);
  return issues;
}

const getIssuesWithMatchingBranches = async (octokit, context, issues, branches) => {
  const allIssuesWithMatchingBranches = [];
  for (const issue of issues.data) {
    const tempContext = { ...context };
    tempContext.payload.issue = issue;
    console.log(`issue ${issue.title}`);
    const branchesMatchingIssue = await getAllBranchesMatchingIssue(octokit, tempContext, branches);
    if (branchesMatchingIssue.length > 0) {
      allIssuesWithMatchingBranches.push(issue);
    }
  }
  return allIssuesWithMatchingBranches;
};

const tagIssueWithBranchAsWIP = async (octokit, context, repo) => {
  console.log(`on schedule`);
  console.log(`running scheduled activiy: tagIssueWithBranchAsWIP`);
  const [ owner, repository ] = repo.split('/');
  const tempContext = context;
  tempContext.payload.repository = {
    owner: {
      login: owner,
    },
    name: repository,
  };
  const issues = await getRepoIssues(octokit, tempContext);
  const branches = await getRepoBranches(octokit, tempContext);
  const allIssuesWithMatchingBranches = await getIssuesWithMatchingBranches(octokit, tempContext, issues, branches);
  for (const issueWithMatchingBranch of allIssuesWithMatchingBranches) {
    console.log(`${JSON.stringify(issueWithMatchingBranch)}`);
    tempContext.payload.issue = issueWithMatchingBranch;
    await addLabels(octokit, tempContext, ['WIP']);
    tempContext.payload.issue.labels.push('WIP');
    await moveCardsMatchingIssueToCorrectColumn(octokit, tempContext);
  } 
};

const getIssuesNotInAProjectBoard = async (octokit, context) => {
  console.log(`getIssuesNotInAProjectBoard`);
  const allCards = [];
  const boards = await getProjectBoards(octokit, context);
  for (const board of boards) {
    const columns = await getBoardColumnsByBoardName(octokit, context, board.name);
    for (const column of columns.data) {
      const cards = await octokit.projects.listCards({ column_id: column.id });
      for (const card of cards.data) {
        allCards.push(card);
      }
    }
  }
  const allNonMatchingIssues = [];
  const issues = await getRepoIssues(octokit, context);
  for (const issue of issues.data) {
    const matchingCards = allCards.filter(card => {
      const [contentType, contentNumber] = card.content_url.split('/').slice(-2);
      return contentType === 'issues' && Number(contentNumber) === issue.number;
    });
    if (matchingCards.length === 0) {
      allNonMatchingIssues.push(issue);
    }
  }
  return allNonMatchingIssues;
};

const createCardsForMissingIssues = async (octokit, context, repo) => {
  console.log(`on schedule`);
  console.log(`running scheduled activiy: createCardsForMissingIssues`);
  const [ owner, repository ] = repo.split('/');
  const tempContext = context;
  tempContext.payload.repository = {
    owner: {
      login: owner,
    },
    name: repository,
  };
  const missingIssues = await getIssuesNotInAProjectBoard(octokit, tempContext);
  for (const missingIssue of missingIssues) {
    tempContext.payload.issue = missingIssue;
    await createCardFromIssue(octokit, tempContext, { boardName: 'triage', columnName: 'awaiting review' });
    await moveCardsMatchingIssueToCorrectColumn(octokit, tempContext);
  }
};

const moveAllCardsToCorrectPosition = async (octokit, context, repo) => {
  await createCardsForMissingIssues(octokit, context, repo);
  console.log(`on schedule`);
  console.log(`running scheduled activiy: moveAllCardsToCorrectColumn`);
  const [ owner, repository ] = repo.split('/');
  const tempContext = context;
  tempContext.payload.repository = {
    owner: {
      login: owner,
    },
    name: repository,
  };
  const issues = await getRepoIssues(octokit, tempContext);
  for (const issue of issues.data) {
    tempContext.payload.issue = issue;
    await moveCardsMatchingIssueToCorrectColumn(octokit, tempContext);
  }
}

const markIssueMatchingBranchAsWIP = async (octokit, context, repo, ref) => {
  console.log(`on create branch: markIssueMatchingBranchAsWIP`);
  console.log(`context: ${JSON.stringify(context.payload.ref_type)}`);
  console.log(`<< ref ${context.payload.ref}`);
  const tempContext = context;
  tempContext.payload.repository = {
    owner: {
      login: owner,
    },
    name: repository,
  };
  const branchName = ref;
  const convention = branchName
    .split('-')
    .slice(0, -1)
    .join('-');
  const issueNumber = branchName.split('-').slice(-1);
  if (Object.values(conventions).includes(convention)) {
    console.log(`<< conventional branch name ${convention}`);
    console.log(`<< issueNumber ${issueNumber}`);
    tempContext.payload.issue = { number: Number(issueNumber), };
    const cards = await getBoardCardsMatchingIssueNumber(octokit, tempContext, 'triage', Number(issueNumber));
    for (const card of cards) {
      console.log(`matching card: ${JSON.stringify(card)}`);
      await addLabels(octokit, tempContext, ['WIP']);
      tempContext.payload.issue.labels.push('WIP');
      await moveCardsMatchingIssueToCorrectColumn(octokit, tempContext);
    }
  }
};

module.exports = {
  addComment,
  createCardFromIssue,
  moveCardsMatchingIssueToCorrectColumn,
  createOnceBoards,
  adjustCommentedLabel,
  createOnceLabels,
  adjustTitleToConventions,
  adjustLabelsToConventions,
  tagIssueWithBranchAsWIP,
  createCardsForMissingIssues,
  moveAllCardsToCorrectPosition,
  markIssueMatchingBranchAsWIP,
};
