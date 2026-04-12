module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: "ts-jest",

  // Specify the test environment (node for backend projects)
  testEnvironment: "node",

  // Root directory for test files
  roots: ["<rootDir>/test"],

  // Glob patterns for test files
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Collect code coverage information
  collectCoverage: true,

  // Output directory for coverage reports
  coverageDirectory: "coverage",

  // Coverage report formats
  coverageReporters: ["text", "lcov", "json-summary"],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },

  // Module file extensions for importing
  moduleFileExtensions: ["ts", "js"],

  // Transform settings for ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },

  moduleNameMapper: {
    "^(.+)/version\\.js$": "$1/version.ts",
    "^(.+)/utils\\.js$": "$1/utils.ts",
    "^(.+)/auth\\.js$": "$1/auth.ts",
    "^(.+)/core\\.js$": "$1/core.ts",
    "^(.+)/workitems\\.js$": "$1/workitems.ts",
    "^(.+)/builds\\.js$": "$1/builds.ts",
    "^(.+)/releases\\.js$": "$1/releases.ts",
    "^(.+)/repos\\.js$": "$1/repos.ts",
    "^(.+)/search\\.js$": "$1/search.ts",
    "^(.+)/testplans\\.js$": "$1/testplans.ts",
    "^(.+)/wiki\\.js$": "$1/wiki.ts",
    "^(.+)/work\\.js$": "$1/work.ts",
    "^(.+)/prompts\\.js$": "$1/prompts.ts",
    "^(.+)/tools\\.js$": "$1/tools.ts",
    "^(.+)/useragent\\.js$": "$1/useragent.ts",
    "^(\\.\\.)\/index\\.js$": "$1/index.ts",
  },
};
