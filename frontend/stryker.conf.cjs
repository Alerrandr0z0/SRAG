module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  mutate: ['src/components/charts/AggregatedSwimmerPlot.tsx'],
  vitest: {
    configFile: 'vitest.config.ts',
  },
  coverageAnalysis: 'perTest',
  tsconfigFile: 'tsconfig.json',
};
