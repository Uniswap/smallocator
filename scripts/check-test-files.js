#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Get list of test files
const getTestFiles = (ref = 'HEAD') => {
  try {
    if (ref === 'staged') {
      const result = execSync('git diff --cached --name-only --diff-filter=d "**/*.test.ts" "**/*.spec.ts"', { encoding: 'utf-8' });
      return result.split('\n').filter(Boolean);
    } else {
      const result = execSync('git ls-tree -r HEAD --name-only "**/*.test.ts" "**/*.spec.ts"', { encoding: 'utf-8' });
      return result.split('\n').filter(Boolean);
    }
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

// Get test counts for staged changes
const getCurrentTestCounts = (files) => {
  const counts = {};
  files.forEach(file => {
    try {
      // Get the staged content
      const content = execSync(`git show :${file}`, { encoding: 'utf-8' });
      counts[file] = countTestsInFile(file, content);
    } catch (error) {
      console.error(`Error reading staged content for ${file}:`, error);
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

const stagedFiles = getTestFiles('staged');
const previousFiles = getTestFiles('HEAD');

// Only proceed if there are staged test files
if (stagedFiles.length > 0) {
  const currentCounts = getCurrentTestCounts(stagedFiles);
  const previousCounts = getPreviousTestCounts(stagedFiles);

  let hasErrors = false;

  // Check for decreased test counts within files
  stagedFiles.forEach(file => {
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
}

process.exit(0);
