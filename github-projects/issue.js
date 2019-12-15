function configure(graphql, context) {

  async function _getIssueId() {
    const queryResult = await graphql(
      `query($owner: String!, $repo: String!, $issue_number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number:$issue_number) {
            id
          }
        }
      }`, {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.issue.number,
      }
    );
    return queryResult.repository.issue.id;
  }

  async function commentOnIssue(comment) {
    const subjectId = await _getIssueId();
    const mutationResult = await graphql(
      `mutation($subjectId: ID!, $body: String!) {
        addComment(input: {subjectId: $subjectId, body: $body}) {
          commentEdge {
            node {
              id
              body
            }
          }
        }
      }`, {
        subjectId: subjectId,
        body: comment,
      }
    );
    return mutationResult;
  }  

  return {
    commentOnIssue,
  }
}


module.exports = {
  configure
}
