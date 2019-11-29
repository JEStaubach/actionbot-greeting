module.exports = {
  presets: ['@babel/preset-env'],
  env: {
    build: {
      ignore: [
        '**/*.test.tsx',
        '**/*.test.ts',
        '**/*.story.tsx',
        '__snapshots__',
        '__tests__',
        '__stories__',
      ],
    },
  },
  ignore: ['node_modules'],
};
