import { spawn } from 'child_process';
import os from 'os';
import process from 'process';

// Get the number of CPU cores
const cpuCount = os.cpus().length;
// Use this as the number of shards - one per CPU core
const totalShards = cpuCount;

// Track all child processes
const processes = [];
const startTime = Date.now();

console.log(`Starting test execution across ${totalShards} shards...`);

// Launch a process for each shard
for (let shard = 1; shard <= totalShards; shard++) {
  const childProcess = spawn('node', [
    'scripts/run-sharded-tests.js',
    `--shard=${shard}/${totalShards}`
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      JEST_MAX_WORKERS: '90%', // Use 90% of available CPU resources
    }
  });
  
  processes.push(new Promise((resolve, reject) => {
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Shard ${shard}/${totalShards} failed with code ${code}`));
      }
    });
  }));
}

// Wait for all processes to complete
Promise.all(processes)
  .then(() => {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nAll test shards completed successfully in ${duration.toFixed(2)}s`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest execution failed:', error.message);
    process.exit(1);
  });
