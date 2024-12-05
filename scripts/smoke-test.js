import { spawn } from 'child_process';

// Utility to run a command and wait for a specific time
function runWithTimeout(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    let killed = false;

    // Set timeout to kill the process
    const timeout = setTimeout(() => {
      killed = true;
      // Send SIGTERM to the entire process group
      try {
        process.kill('-SIGTERM');
      } catch (e) {
        // Ignore errors if process is already dead
      }
      resolve(); // Process started successfully if it ran for the timeout duration
    }, timeoutMs);

    process.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    process.on('exit', (code) => {
      if (!killed && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    // Store the process in case we need to kill it from outside
    return process;
  });
}

async function main() {
  let devProcess = null;
  try {
    // Test development mode
    console.log('Testing development mode (pnpm dev)...');
    await runWithTimeout('pnpm', ['dev'], 5000);
    
    // Kill any lingering processes on port 3000
    try {
      await new Promise((resolve, reject) => {
        const kill = spawn('pkill', ['-f', 'tsx watch src/index.ts'], {
          stdio: 'inherit',
          shell: true
        });
        kill.on('exit', (code) => {
          // pkill returns 1 if no processes were killed, which is fine
          resolve();
        });
      });
    } catch (e) {
      // Ignore errors from pkill
    }

    // Wait a bit for the port to be freed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test production mode
    console.log('Testing production mode (pnpm start)...');
    // First build
    const buildProcess = spawn('pnpm', ['build'], { stdio: 'inherit', shell: true });
    await new Promise((resolve, reject) => {
      buildProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
    
    await runWithTimeout('pnpm', ['start'], 5000);
    
    console.log('✅ Smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Smoke tests failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: ensure all child processes are killed
    try {
      await new Promise((resolve) => {
        const kill = spawn('pkill', ['-f', '(tsx watch|node dist/index.js)'], {
          stdio: 'inherit',
          shell: true
        });
        kill.on('exit', () => resolve());
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

main();
