/*
 * TODO: #multiple schedulers - specify event as option
 *       #run once schedule on startup - option, skip interval piece
 *       #run once schedule on startup after delay, should be automatic after previous
 *       #run schedule for particular repo, app.receive event only if repo id in repos in options
 * TODO: 1. no delay, every 1 years check to see if the projects need to be created
 *       2. If projects exist, but not compatible quit
 *       3. If projects exist, and compatible rename
 *       4. If projects don't exist, create
 * TODO: Add Dry Run capability
 *       1. If flag, do create projects
 *       2. If no flag, log what would have been done
 * TODO: For bulk, check that dry run log exists
 *       If dry run flag exists, complete dry run and make sure that the dry runs match
 *       Perform in bulk
 * TODO: Bulk create / organize cards
 * TODO: Bulk create / update projects
 * TODO: Add commented label to declined
 *       Move commented to top
 * TODO: Single prioritized list?
 * TODO: Trigger pull request
 * TODO: Detect pull request
 * TODO: Move to pull requested
 * TODO: Check for tests
 * TODO: Check for docs
 * TODO: Validate comments
 * TODO: Validate syntax
 * TODO: Validate style
 * TODO: Static vulnerability analysis
 * TODO: Validate tests
 * TODO: Validate test coverage
 * TODO: Validate build
 * TODO: Review PR
 * TODO: Test Local
 * TODO: Test Sandbox
 * TODO: Test dynamic vulnerability analysis
 * TODO: Check dependencies
 * TODO: Promote to stage
 * TODO: Deploy to stage
 * TODO: Attributions
 * TODO: Chnagelog
 * TODO: Tag stage
 * TODO: Promote to prod
 * TODO: Clear cache
 * TODO: Close
 */

require('dotenv').config();
const createScheduler = require('probot-scheduler');
const Octokit = require('@octokit/rest');
const config = require('config');
const merge = require('deepmerge');

const overwriteMerge = (destArray, srcArray, options) => (srcArray ? srcArray : destArray);

const octokit = new Octokit({
  auth: process.env.WORK_TOKEN,
});

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  // Your code here
  app.log(`Yay, the app was loaded!`);
  const packageJson = process.env.npm_package_issuewatcher ? process.env.npm_package_issuewatcher : {};
  app.log(`\nPackage:\n${JSON.stringify(packageJson)}`);
  app.log(`\nConfig:\n${JSON.stringify(config)}`);
  const mergedConfig = merge(config, packageJson, { arrayMerge: overwriteMerge });
  app.log(`\nMerged:\n${JSON.stringify(mergedConfig)}`);

  createScheduler(app, {
    delay: false,
    interval: 60 * 60 * 1000 /*24 * 60 * 60 * 1000*/,
    name: 'four',
  });

  createScheduler(app, {
    delay: false,
    interval: 5 * 60 * 1000,
    runOnce: true,
    name: 'startup',
  });

  createScheduler(app, {
    delay: false,
    interval: 2 * 60 * 1000,
    name: 'two',
    repos: ['jsdevtools/testrepo'],
  });

  createScheduler(app, {
    delay: false,
    interval: 3 * 60 * 1000,
    name: 'three',
    repos: ['jsdevtools/fail'],
  });

  const locked = {};


  const getLock = id => {
    app.log(`getLock`);
    locked[id] =
      locked[id] === undefined || locked[id].length === 0
        ? [0]
        : [...locked[id], locked[id][locked[id].length - 1] + 1];
    return locked[id][locked[id].length - 1];
  };

  const isTurn = (id, lock) => {
    app.log(`isTurn`);
    app.log(`turn = ${locked[id][0]}`);
    return locked[id][0] === lock;
  };

  const unlock = context => {
    app.log(`unlock`);
    const id = context.payload.repository.id;
    app.log(`unlocking = ${locked[id][0]}`);
    locked[id] = locked[id].slice(1);
  };

  const waitForLock = async context => {
    app.log(`waitForLock`);
    const id = context.payload.repository.id;
    const lock = getLock(id);
    app.log(`lock# = ${lock}`);
    while (!isTurn(id, lock)) {
      app.log('waiting for turn');
      await new Promise(r => setTimeout(r, 1000));
    }
    app.log(`lock acquired ${lock}`);
  };

  const watcherFileExists = async (owner, repo, path) => {
    app.log(`watcherFileExists`);
    try {
      const watcherFile = await octokit.repos.getContents({
        owner,
        repo,
        path,
      });
      app.log(`watcher file ${JSON.stringify(watcherFile)}`);
      return true;
    } catch (err) {
      if (err.name === 'HttpError' && err.status === 404) {
        return false;
      }
      throw err;
    }
  };

  const initRepoProjects = async () => {
    // this event is triggered on startup
    app.log(`initRepoProjects`);
    const fileExists = await watcherFileExists('JSDevTools', 'testrepo', '.watcher');
    app.log(`fileExists: ${fileExists}`);
    /*
    const issues = await octokit.issues.listForRepo({
      owner: 'JSDevTools',
      repo: 'testrepo',
    });
    */
  };

  const getProjectBoard = async (context, boardName) => {
    app.log(`getProjectBoard`);
    app.log(`github.projects.listForRepo`);
    const projects = await context.github.projects.listForRepo({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    const [board] = projects.data.filter(project => project.name === boardName);
    return board;
  };

  const getBoardColumns = async (context, board) => {
    app.log(`getBoardColumns`);
    app.log(`github.projects.listColumns`);
    return await context.github.projects.listColumns({ project_id: board.id });
  };

  const getBoardColumnsByBoardName = async (context, boardName) => {
    app.log(`getBoardColumnsByBoardName`);
    const board = await getProjectBoard(context, boardName);
    return await getBoardColumns(context, board);
  };

  const getBoardColumnByNames = async (context, boardName, columnName) => {
    app.log(`getBoardColumnByNames`);
    const columns = await getBoardColumnsByBoardName(context, boardName);
    const [boardColumn] = columns.data.filter(column => column.name === columnName);
    return boardColumn;
  };

  const createCardFromIssue = async (context, { boardName, columnName }) => {
    app.log(`createCardFromIssue`);
    const column = await getBoardColumnByNames(context, boardName, columnName);
    app.log(`github.projects.createCard`);
    await context.github.projects.createCard({
      column_id: column.id,
      content_id: context.payload.issue.id,
      content_type: 'Issue',
    });
  };

  const getBoardCardsMatchingIssue = async (context, boardName) => {
    app.log(`getBoardCardsMatchingIssue`);
    return await getBoardCardsMatchingIssueNumber(context, boardName, context.payload.issue.number);
  };

  const getBoardCardsMatchingIssueNumber = async (context, boardName, issueNumber) => {
    app.log(`getBoardCardsMatchtingIssueNumber`);
    let allMatchingCards = [];
    const columns = await getBoardColumnsByBoardName(context, boardName);
    for (const column of columns.data) {
      app.log(`github.projects.listCards`);
      const cards = await context.github.projects.listCards({ column_id: column.id });
      const matchingCards = cards.data.filter(card => {
        const [contentType, contentNumber] = card.content_url.split('/').slice(-2);
        return contentType === 'issues' && Number(contentNumber) === issueNumber;
      });
      allMatchingCards = [...allMatchingCards, ...matchingCards];
    }
    return allMatchingCards;
  };

  const moveCardsMatchingIssueInBoardToBoardColumnAtPosition = async (
    context,
    srcBoardNames,
    destBoardName,
    destColumnName,
    pos,
  ) => {
    app.log(`moveCardsMatchingIssueInBoardToBoardColumnAtPosition`);
    let matchingCards = [];
    let srcBoardName = undefined;
    if (Array.isArray(srcBoardNames)) {
      srcBoardName = srcBoardNames[0];
      for (const srcBoard of srcBoardNames) {
        const matches = await getBoardCardsMatchingIssue(context, srcBoard);
        if (matches.length > 0) {
          matchingCards = matches;
          srcBoardName = srcBoard;
        }
      }
    } else {
      srcBoardName = srcBoardNames;
      matchingCards = await getBoardCardsMatchingIssue(context, srcBoardName);
    }
    const columns = await getBoardColumnsByBoardName(context, destBoardName);
    for (const matchingCard of matchingCards) {
      const [tgtColumn] = columns.data.filter(column => column.name === destColumnName);
      app.log(`github.porjects.moveCard`);
      if (srcBoardName === destBoardName) {
        await context.github.projects.moveCard({
          card_id: matchingCard.id,
          position: pos,
          column_id: tgtColumn.id,
        });
      } else {
        // const [ , contentNumber ] = matchingCard.content_url.split('/').slice(-2);
        // const issueNumber = Number(contentNumber);
        await context.github.projects.createCard({
          column_id: tgtColumn.id,
          content_id: context.payload.issue.id,
          content_type: 'Issue',
        });
        await context.github.projects.deleteCard({ card_id: matchingCard.id });
      }
    }
  };

  const moveCardsMatchingIssueInBoardToColumnAtPosition = async (context, boardName, columnName, pos) => {
    app.log(`moveCardsMatchingIssueInBoardToColumnAtPosition`);
    await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
      context,
      [boardName],
      boardName,
      columnName,
      pos,
    );
  };

  const getIssueLabels = context => {
    app.log(`getIssueLabels`);
    return context.payload.issue.labels.map(cur => cur.name);
  };

  const removeLabels = async (context, labelsToRemove) => {
    app.log(`removeLabels`);
    app.log(`github.issues.listLabelsOnIssue`);
    const labels = await context.github.issues.listLabelsOnIssue({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.issue.number,
    });
    const labelNames = labels.data.map(cur => cur.name);
    for (const labelToRemove of labelsToRemove) {
      if (labelNames.includes(labelToRemove)) {
        app.log(`remove label ${labelToRemove}`);
        await context.github.issues.removeLabel({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          number: context.payload.issue.number,
          name: labelToRemove,
        });
      }
    }
  };

  const findInsertionPoint = async (context, boardName, columnName) => {
    app.log(`findInsertionPoint`);
    const column = await getBoardColumnByNames(context, boardName, columnName);
    app.log(`github.projects.listCards`);
    const cards = await context.github.projects.listCards({ column_id: column.id });
    const cardsIssues = cards.data.map(card => {
      const [, contentNumber] = card.content_url.split('/').slice(-2);
      return [card.id, Number(contentNumber)];
    });
    let cardId = 0;
    let count = 0;
    for (const [card_id, issueNumber] of cardsIssues) {
      app.log(`github.issues.get`);
      const issue = await context.github.issues.get({
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

  const isCardMatchingIssueInBoardColumn = async (context, boardName, columnName) => {
    app.log(`isCardMatchingIssueInBoardColumn`);
    const column = await getBoardColumnByNames(context, boardName, columnName);
    app.log(`github.projects.listCards`);
    const columnCards = await context.github.projects.listCards({ column_id: column.id });
    app.log(`columnCards: ${columnCards}`);
    const matchingCards = await getBoardCardsMatchingIssue(context, boardName);
    for (const matchingCard of matchingCards) {
      app.log(`matchingCard: ${matchingCard.id}`);
      for (const columnCard of columnCards.data) {
        app.log(`  columnCard: ${columnCard.id}`);
        if (matchingCard.id === columnCard.id) {
          app.log(`   match: ${matchingCard.id} ${columnCard.id}`);
          return true;
        }
      }
    }
    return false;
  };

  const addLabels = async (issuesContext, labels) => {
    app.log(`addLabels`);
    app.log(`github.issues.addLabels`);
    await issuesContext.github.issues.addLabels({
      owner: issuesContext.payload.repository.owner.login,
      repo: issuesContext.payload.repository.name,
      issue_number: issuesContext.payload.issue.number,
      labels,
    });
  };

  const addComment = async (issuesContext, comment) => {
    app.log(`addComment`);
    const issueComment = issuesContext.issue({ body: comment });
    app.log(`github.issues.createComment`);
    await issuesContext.github.issues.createComment(issueComment);
  };

  const hasAssignee = issuesContext => {
    app.log(`hasAssignee`);
    return issuesContext.payload.issue.assignees.length > 0;
  };

  const addConventionalTitle = async (issuesContext, issueType) => {
    app.log(`addCOnventionalTitle`);
    let issueTitle = issuesContext.payload.issue.title;
    Object.values(conventions).map(cur => {
      const re = `^${cur}\h*[:,\.\h]+\h*`;
      const regex = new RegExp(re, 'i');
      issueTitle = issueTitle.replace(regex, '');
    });
    const title = `${conventions[issueType]}: ${issueTitle}`;
    app.log(`github.issues.update`);
    if (issueTitle !== title) {
      await issuesContext.github.issues.update({
        owner: issuesContext.payload.repository.owner.login,
        repo: issuesContext.payload.repository.name,
        issue_number: issuesContext.payload.issue.number,
        title,
      });
    } else {
      app.log('no change to conventional title');
    }
  };

  const getBranches = async context => {
    app.log(`getBranches`);
    app.log(`github.repos.listBranches`);
    const branches = await context.github.repos.listBranches({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    return branches.data;
  };

  const getForks = async context => {
    app.log(`getForks`);
    app.log(`github.repos.listForks`);
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    app.log(`      owner: ${owner}`);
    app.log(`      repo: ${repo}`);

    const forks = await context.github.repos.listForks({ owner, repo });
    forks.data.map(fork => {
      // app.log(`in forks: ${JSON.stringify(fork)}`)
      app.log(`fork found ${fork.owner.login}/${fork.name}`);
    });
    return forks.data;
  };

  const getForkBranches = async (context, fork) => {
    app.log(`getForkBranches`);
    app.log(`github.repos.listBranches`);
    const branches = await context.github.repos.listBranches({
      owner: fork.owner.login,
      repo: fork.name,
    });
    branches.data.map(branch => {
      app.log(`fork ${fork.owner.login}/${fork.name} branch ${branch.name}`);
    });
    return branches.data;
  };

  const getBranchesOfForks = async context => {
    app.log(`getBranchesOfForks`);
    const forks = await getForks(context);
    let allBranches = [];
    for (const fork of forks) {
      const branches = await getForkBranches(context, fork);
      allBranches = [...allBranches, ...branches];
    }
    return allBranches;
  };

  const getAllBranches = async context => {
    app.log(`getAllBranches`);
    const branches = await getBranches(context);
    const forkBranches = await getBranchesOfForks(context);
    return [...branches, ...forkBranches];
  };

  const getAllBranchesMatchingIssue = async (context, branches) => {
    app.log(`getAllBranchesMatchingIssue`);
    const issueTitle = context.payload.issue.title;
    const colon = issueTitle.indexOf(':');
    if (colon === -1) {
      return [];
    }
    const abbrev = issueTitle.slice(0, colon);
    const issueNumber = context.payload.issue.number;
    const branchText = `${abbrev}-${issueNumber}`;
    return branches.filter(branch => {
      app.log(`branch.name ${branch.name} branchText ${branchText}`);
      return branch.name.match(branchText);
    });
  };

  const issueHasMatchingBranches = async context => {
    app.log(`issueHasMatchingBranches`);
    const branches = await getAllBranches(context);
    app.log(`allBranches:`);
    for (const branch of branches) {
      app.log(`  name: ${branch['name']}`);
      for (const key of Object.keys(branch).filter(cur => cur != 'name')) {
        app.log(`    ${key}: ${branch[key]}`);
      }
    }
    const branchesMatchingIssue = await getAllBranchesMatchingIssue(context, branches);
    return branchesMatchingIssue.length > 0;
  };

  const getRepoIssues = async (context, owner, repo) => {
    app.log(`getRepoIssues`);
    app.log(`github.issues.listForRepo`);
    const issues = await context.github.issues.listForRepo({ owner, repo });
    app.log(`issues: ${issues}`);
    const branches = await getAllBranches(context);
    app.log(`allBranches:`);
    for (const branch of branches) {
      app.log(`  name: ${branch['name']}`);
      for (const key of Object.keys(branch).filter(cur => cur != 'name')) {
        app.log(`    ${key}: ${branch[key]}`);
      }
    }
    //let allBranchesMatchingIssue = [];
    for (const issue of issues.data) {
      const tempContext = { ...context };
      tempContext.payload.issue = issue;
      app.log(`issue ${issue.title}`);
      const branchesMatchingIssue = await getAllBranchesMatchingIssue(tempContext, branches);
      if (branchesMatchingIssue.length > 0) {
        addLabels(context, ['WIP']);
      }
      //allBranchesMatchingIssue = [ ...allBranchesMatchingIssue, ...branchesMatchingIssue ];
    }
    //app.log(JSON.stringify(allBranchesMatchingIssue));
  };

  const commenterInIssueAssignees = context => {
    app.log(`commenterInIssueAssignees`);
    if (!Object.keys(context.payload).includes('comment')) return false;
    const commenter = context.payload.comment.user.login;
    const assignees = context.payload.issue.assignees.map(curr => curr.login);
    return assignees.filter(assignee => assignee === commenter).length > 0;
  };

  const moveCardsMatchingIssueToCorrectColumn = async context => {
    app.log(`moveCardsMatchingIssueToCorrectColumn`);
    const issueLabels = getIssueLabels(context);
    if (issueLabels.includes('spin off')) {
      app.log(`<< has spin off label`);
      app.log('>> move card to declined board spin off column @bottom');
      await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
        context,
        ['triage', 'questions', 'declined'],
        'declined',
        'spin off',
        'bottom',
      );
    } else if (issueLabels.includes('duplicate')) {
      app.log(`<< has duplicate label`);
      app.log('>> move card to declined board duplicate column @bottom');
      await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
        context,
        ['triage', 'questions', 'declined'],
        'declined',
        'duplicate',
        'bottom',
      );
    } else if (issueLabels.includes('declined')) {
      app.log(`<< has declined label`);
      app.log('>> move card to declined board declined column @bottom');
      await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
        context,
        ['triage', 'questions', 'declined'],
        'declined',
        'declined',
        'bottom',
      );
    } else if (issueLabels.includes('question')) {
      app.log('<< has question label');
      if (issueLabels.includes('commented')) {
        app.log(`<< has commented label`);
        // if has assignee and commentor is assignee
        if (hasAssignee(context) && commenterInIssueAssignees(context)) {
          app.log(`<< commenter is assignee`);
          // move to responded
          const insertionPoint = await findInsertionPoint(context, 'questions', 'responded');
          app.log(`insertionPoint ${insertionPoint}`);
          app.log('>> move card to questions board responded column');
          await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
            context,
            ['triage', 'questions', 'declined'],
            'questions',
            'responded',
            insertionPoint,
          );
        } else {
          // if has commented label, move to bottom of commented cards,
          // not all the way to the bottom of the column
          const insertionPoint = await findInsertionPoint(context, 'questions', 'question');
          app.log(`insertionPoint ${insertionPoint}`);
          app.log('>> move card to questions board question column');
          await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
            context,
            ['triage', 'questions', 'declined'],
            'questions',
            'question',
            insertionPoint,
          );
        }
      } else {
        app.log(`<< no commented label`);
        if (hasAssignee(context) && commenterInIssueAssignees(context)) {
          app.log(`<< commenter is assignee`);
          app.log('>> move card to questions board responded column @bottom');
          await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
            context,
            ['triage', 'questions', 'declined'],
            'questions',
            'responded',
            'bottom',
          );
        } else {
          app.log('>> move card to questions board question column @bottom');
          await moveCardsMatchingIssueInBoardToBoardColumnAtPosition(
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
        app.log('<< has more info label');
        app.log('>> move card to more info please column');
        if (issueLabels.includes('commented')) {
          // if has commented label, move to bottom of commented cards,
          // not all the way to the bottom of the column
          const insertionPoint = await findInsertionPoint(context, 'triage', 'more info please');
          app.log(`insertionPoint ${insertionPoint}`);
          await moveCardsMatchingIssueInBoardToColumnAtPosition(
            context,
            'triage',
            'more info please',
            insertionPoint,
          );
        } else {
          await moveCardsMatchingIssueInBoardToColumnAtPosition(
            context,
            'triage',
            'more info please',
            'bottom',
          );
        }
      } else if (Object.keys(conventions).filter(key => issueLabels.includes(key)).length === 0) {
        app.log('<< has no conventions key');
        app.log('>> move card to awaiting review column');
        await moveCardsMatchingIssueInBoardToColumnAtPosition(context, 'triage', 'awaiting review', 'bottom');
      } else if (issueLabels.includes('WIP')) {
        app.log('<< has WIP label');
        app.log('>> move card to WIP column');
        await moveCardsMatchingIssueInBoardToColumnAtPosition(context, 'triage', 'WIP', 'bottom');
      } else if (hasAssignee(context)) {
        app.log('<< has assignee');
        app.log('>> move card to assigned column');
        await moveCardsMatchingIssueInBoardToColumnAtPosition(context, 'triage', 'assigned', 'bottom');
      } else {
        app.log('>> move card to backlog column');
        await moveCardsMatchingIssueInBoardToColumnAtPosition(context, 'triage', 'backlog', 'bottom');
      }
      if (issueHasMatchingBranches(context) && !getIssueLabels(context).includes('WIP')) {
        addComment(['WIP']);
      }
    }
  };

  app.on('create', async context => {
    try {
      await waitForLock(context);
      app.log(`on create`);
      app.log(`create ${context.payload.ref_type}`);
      if (context.payload.ref_type === 'branch') {
        app.log(`<< ref ${context.payload.ref}`);
        const branchName = context.payload.ref;
        const convention = branchName
          .split('-')
          .slice(0, -1)
          .join('-');
        const issueNumber = branchName.split('-').slice(-1);
        if (Object.values(conventions).includes(convention)) {
          app.log(`<< conventional branch name ${convention}`);
          app.log(`<< issueNumber ${issueNumber}`);
          const cards = await getBoardCardsMatchingIssueNumber(context, 'triage', Number(issueNumber));
          cards.map(card => {
            app.log(JSON.stringify(card));
          });
        }
      }
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('issues.unassigned', async context => {
    try {
      await waitForLock(context);
      app.log(`on issues.unassigned`);
      app.log('issues.unassigned');
      await moveCardsMatchingIssueToCorrectColumn(context);
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('issues.assigned', async context => {
    try {
      await waitForLock(context);
      app.log(`on issues.assigned`);
      app.log('issues.assigned');
      await moveCardsMatchingIssueToCorrectColumn(context);
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('issues.unlabeled', async context => {
    try {
      await waitForLock(context);
      app.log(`on issues.unlabeled`);
      app.log(`issues.unlabeled ${context.payload.label.name}`);
      await moveCardsMatchingIssueToCorrectColumn(context);
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('issues.labeled', async context => {
    try {
      await waitForLock(context);
      app.log(`on issues.labeled`);
      app.log('issues.labeled');
      const issueLabels = getIssueLabels(context);
      if (Object.keys(conventions).includes(context.payload.label.name)) {
        app.log('<< convention label');
        await addConventionalTitle(context, context.payload.label.name);
        const otherConventionLabels = Object.keys(conventions)
          .filter(convention => convention !== context.payload.label.name)
          .filter(key => issueLabels.includes(key));
        app.log('>> remove other convents, more info please, and commented labels');
        await removeLabels(context, [...otherConventionLabels, 'more info please', 'commented']);
      }
      await moveCardsMatchingIssueToCorrectColumn(context);
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('issue_comment.created', async context => {
    try {
      await waitForLock(context);
      app.log(`on issue_comment.created`);
      app.log('issue_comment.created');
      if (context.payload.comment.user.login !== 'issue-watcher[bot]') {
        app.log('<< comment from !== issue-watcher[bot]');
        const isInMoreColumn = await isCardMatchingIssueInBoardColumn(context, 'triage', 'more info please');
        const isInQuestionColumn = await isCardMatchingIssueInBoardColumn(context, 'questions', 'question');
        const isInRespondedColumn = await isCardMatchingIssueInBoardColumn(context, 'questions', 'responded');
        if (isInMoreColumn) {
          app.log('<< issue in more info please column');
          if (!commenterInIssueAssignees(context)) {
            app.log('>> commenter not assigneee, add commented label');
            await addLabels(context, ['commented']);
          }
          await moveCardsMatchingIssueToCorrectColumn(context);
        } else if (isInQuestionColumn || isInRespondedColumn) {
          app.log('<< issue question  or responded column');
          if (!commenterInIssueAssignees(context)) {
            app.log('>> commenter not assignee, add commented label');
            await addLabels(context, ['commented']);
          }
          await moveCardsMatchingIssueToCorrectColumn(context);
        }
      }
      unlock(context);
    } catch (err) {
      unlock(context);
    }
  });

  app.on('schedule.two', async context => {
    try {
      await waitForLock(context);
      app.log(`on schedule.two`);
      unlock(context);
    } catch (err) {
      app.log(`Error: ${err}`);
      unlock(context);
    }
  });

  app.on('schedule.three', async context => {
    try {
      await waitForLock(context);
      app.log(`on schedule.three`);
      unlock(context);
    } catch (err) {
      app.log(`Error: ${err}`);
      unlock(context);
    }
  });

  app.on('schedule.startup', async context => {
    try {
      await waitForLock(context);
      app.log(`on schedule.startup`);
      await initRepoProjects();
      unlock(context);
    } catch (err) {
      app.log(`Error: ${err}`);
      unlock(context);
    }
  });

  app.on('schedule.four', async context => {
    // this event is triggered on an interval
    try {
      await waitForLock(context);
      app.log(`on schedule.four`);
      // app.log(`context: ${JSON.stringify(context)}`);
      app.log(`running scheduled activities`);
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      app.log(`owner ${owner} / repo ${repo}`);
      await getRepoIssues(context, owner, repo);
      unlock(context);
    } catch (err) {
      app.log(`Error: ${err}`);
      unlock(context);
    }
  });

  const eventTypes = [
    'check_name',
    'check_suite',
    'commit_comment',
    'content_reference',
    'create',
    'delete',
    'deploy_key',
    'deployment',
    'deployment_status',
    'download',
    'follow',
    'fork',
    'fork_apply',
    'github_app_authorization',
    'gist',
    'gollum',
    'installation',
    'installation_repositories',
    'issue_comment',
    'issues',
    'label',
    'marketplace_purchase',
    'member',
    'membership',
    'meta',
    'milestone',
    'organization',
    'org_block',
    'page_build',
    'project_card',
    'project_column',
    'project',
    'public',
    'pull_request',
    'pull_request_review',
    'pull_request_review_comment',
    'push',
    'registry_package',
    'release',
    'repository',
    'repository_import',
    'repository_vulnerability_alert',
    'security_advisory',
    'star',
    'status',
    'team',
    'team_add',
    'watch',
    'schedule',
  ];

  for (const eventType of eventTypes) {
    app.on(eventType, async context => {
      try {
        await waitForLock(context);
        app.log(`event.action ${eventType}.${context.payload.action}`);
        switch (eventType) {
          case 'pull_request': {
            switch (context.payload.action) {
              case 'opened': {
                app.log(`handling ${eventType}.${context.payload.action}`);
                break;
              }
              default: {
                app.log(`unhandled action ${eventType}.${context.payload.action}`);
                break;
              }
            }
            break;
          }
          default: {
            app.log(`unhandled event ${eventType}.${context.payload.action}`);
            break;
          }
        }
        unlock(context);
      } catch (err) {
        unlock(context);
      }
    });
  }

  const server = app.route();
  server.get('/example', async (_, res) => {
    const issues = await octokit.issues.listForRepo({
      owner: 'JSDevTools',
      repo: 'testrepo',
    });
    console.log(`issues: \n${JSON.stringify(issues)}`);

    /* tesst which confifmed authentication was working
    octokit.issues.addLabels({
      owner: 'JSDevTools',
      repo: 'testrepo',
      issue_number: 7,
      labels: ['question'],
    });
    */

    res.send('Yay!');
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
