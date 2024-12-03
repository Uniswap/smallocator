#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Get list of test files
const getTestFiles = (ref = 'HEAD') => {
  try {
    const cmd = ref === 'HEAD' 
      ? 'git ls-tree -r HEAD --name-only "**/*.test.ts" "**/*.spec.ts"'
      : 'git ls-files "**/*.test.ts" "**/*.spec.ts"';
    const result = execSync(cmd, { encoding: 'utf-8' });
    return result.split('\n').filter(Boolean);
  } catch (error) {
    console.error(`Error getting test files from ${ref}:`, error);
    process.exit(1);
  }
};

// Count test cases in a file
const countTestsInFile = (filePath, content) => {
  const testPatterns = [
    /\bit\s*\(/g,           // it('...'
    /\btest\s*\(/g,         // test('...'
    /\bdescribe\s*\(/g,     // describe('...'
  ];

  return testPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern) || [];
    return count + matches.length;
  }, 0);
};

// Get test counts for current state
const getCurrentTestCounts = (files) => {
  const counts = {};
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      counts[file] = countTestsInFile(file, content);
    } catch (error) {
      console.error(`Error reading current file ${file}:`, error);
      process.exit(1);
    }
  });
  return counts;
};

// Get test counts from previous commit
const getPreviousTestCounts = (files) => {
  const counts = {};
  files.forEach(file => {
    try {
      const content = execSync(`git show HEAD:${file}`, { encoding: 'utf-8' });
      counts[file] = countTestsInFile(file, content);
    } catch (error) {
      // File might be new, skip it
      counts[file] = 0;
    }
  });
  return counts;
};

const currentFiles = getTestFiles('current');
const previousFiles = getTestFiles('HEAD');
const currentCounts = getCurrentTestCounts(currentFiles);
const previousCounts = getPreviousTestCounts(previousFiles);

let hasErrors = false;

// Check for removed files
if (currentFiles.length < previousFiles.length) {
  console.error('\x1b[31mError: Test files have been removed!\x1b[0m');
  console.error(`Previous test file count: ${previousFiles.length}`);
  console.error(`Current test file count: ${currentFiles.length}`);
  hasErrors = true;
}

// Check for decreased test counts within files
previousFiles.forEach(file => {
  const previousCount = previousCounts[file] || 0;
  const currentCount = currentCounts[file] || 0;
  
  if (currentCount < previousCount) {
    console.error(`\x1b[31mError: Test count decreased in ${file}\x1b[0m`);
    console.error(`Previous test count: ${previousCount}`);
    console.error(`Current test count: ${currentCount}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  process.exit(1);
}

console.log('\x1b[32mTest file and count check passed!\x1b[0m');
process.exit(0);
