module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/tests/mocks/react-native.js',
    '^expo-secure-store$': '<rootDir>/tests/mocks/expo-secure-store.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
};
