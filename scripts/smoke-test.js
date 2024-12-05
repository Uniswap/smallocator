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

    return process;
  });
}

// Kill processes by command pattern
async function killProcesses(pattern) {
  try {
    await new Promise((resolve) => {
      const kill = spawn('pkill', ['-f', pattern], {
        stdio: 'inherit',
        shell: true
      });
      kill.on('exit', () => resolve());
    });
    // Wait a bit for processes to die
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
    // Ignore errors from pkill
  }
}

async function main() {
  try {
    // Test development mode
    console.log('Testing development mode (pnpm dev)...');
    await runWithTimeout('pnpm', ['dev'], 5000);
    
    // Kill the development server
    await killProcesses('tsx watch');
    
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
    // Cleanup: kill both dev and prod servers
    await killProcesses('tsx watch');
    await killProcesses('node dist/index.js');
  }
}

main();
