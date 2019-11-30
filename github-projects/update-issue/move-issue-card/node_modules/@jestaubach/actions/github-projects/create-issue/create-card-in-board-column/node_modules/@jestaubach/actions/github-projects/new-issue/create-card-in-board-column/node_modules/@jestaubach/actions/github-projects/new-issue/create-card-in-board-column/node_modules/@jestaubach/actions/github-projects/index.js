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

module.exports = {
  addComment,
};
