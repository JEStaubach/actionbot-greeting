const defaultBoards = [
  {
    board: "questions",
    columns: [
      {
        column: "question",
      },
      {
        column: "responded",
      },
    ],
  },
  {
    board: "triage",
    columns: [
      {
        column: "more info please",
      },
      {
        column: "awaiting review",
      },
      {
        column: "backlog",
      },
      {
        column: "assigned",
      },
      {
        column: "WIP",
      },
    ],
  },
  {
    board: "declined",
    columns: [
      {
        column: "declined",
      },
      {
        column: "duplicate",
      },
      {
        column: "spin off",
      }
    ],
  },
];

module.exports = {
  defaultBoards,
};
