/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts', '**/tests/**/*.(test|spec).(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverageFrom: [
    'electron/**/*.ts',
    '!electron/**/*.d.ts',
    '!electron/main.ts',
    '!electron/preload.ts',
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/mocks/electron.ts',
    '^@/(.*)$': '<rootDir>/electron/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
