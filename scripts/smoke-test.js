import { spawn } from 'child_process';
import { appendFileSync } from 'fs';

// Helper to log both to console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${message}\n`;
  console.log(message);
  appendFileSync('/tmp/smallocator-smoke-test.log', logMessage);
}

// Utility to run a command and wait for server to start
function waitForServer(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: true
    });

    let serverStarted = false;
    let output = '';
    let processExited = false;

    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      
      // Check if server has started
      if (chunk.includes('Server listening')) {
        serverStarted = true;
        resolve(process);
      }
    });

    // Set timeout
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        process.kill('SIGTERM');
        reject(new Error(`Server failed to start within ${timeoutMs}ms timeout.\nOutput: ${output}`));
      }
    }, timeoutMs);

    process.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Server process error: ${error.message}\nOutput: ${output}`));
    });

    process.on('exit', (code) => {
      clearTimeout(timeout);
      processExited = true;
      if (!serverStarted) {
        reject(new Error(`Process exited with code ${code} before server started\nOutput: ${output}`));
      }
    });

    // Additional safety timeout - if process exits without starting
    setTimeout(() => {
      if (!serverStarted && !processExited) {
        process.kill('SIGTERM');
        reject(new Error(`Server did not start or exit within ${timeoutMs * 2}ms\nOutput: ${output}`));
      }
    }, timeoutMs * 2);
  });
}

// Kill process using port with timeout
async function killProcessOnPort(port) {
  log(`Checking for processes on port ${port}...`);
  try {
    // Try to find process ID using lsof
    const { stdout } = await new Promise((resolve, reject) => {
      const lsof = spawn('lsof', ['-i', `:${port}`, '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      
      lsof.stdout.on('data', (data) => {
        output += data;
      });

      lsof.on('close', (code) => {
        resolve({ stdout: output, code });
      });

      lsof.on('error', (err) => {
        reject(err);
      });
    });

    const pid = stdout.trim();
    if (pid) {
      log(`Found process ${pid} on port ${port}, attempting to kill...`);
      // Kill the process
      process.kill(parseInt(pid), 'SIGTERM');
      
      // Wait for process to exit
      let attempts = 10;
      while (attempts > 0) {
        try {
          log(`Checking if process ${pid} is still running (${attempts} attempts left)...`);
          process.kill(parseInt(pid), 0); // Check if process exists
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts--;
        } catch (e) {
          log(`Process ${pid} successfully terminated`);
          return; // Process no longer exists
        }
      }
      log(`Process ${pid} did not terminate gracefully, forcing kill...`);
      process.kill(parseInt(pid), 'SIGKILL');
    } else {
      log(`No process found on port ${port}`);
    }
  } catch (error) {
    if (error.code === 'ESRCH') {
      log('Process already terminated');
    } else {
      log(`Error killing process: ${error}`);
      throw error;
    }
  }
}

// Get port from environment variable or use default
const PORT = process.env.SMOKE_TEST_PORT || 3000;

async function main() {
  let devServer = null;
  let prodServer = null;

  try {
    // Ensure port is free before starting
    await killProcessOnPort(PORT);

    // Test development mode
    log(`Testing development mode (pnpm dev) on port ${PORT}...`);
    devServer = await waitForServer('PORT=' + PORT + ' pnpm', ['dev'], 10000);
    log('✓ Development server started successfully');
    
    // Kill the development server
    if (devServer) {
      devServer.kill('SIGTERM');
      await killProcessOnPort(PORT);
    }
    
    // Test production mode
    log('\nTesting production mode (pnpm start)...');
    // First build
    log('Building...');
    const buildProcess = spawn('pnpm', ['build'], { stdio: 'inherit', shell: true });
    await new Promise((resolve, reject) => {
      buildProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
    
    prodServer = await waitForServer('PORT=' + PORT + ' pnpm', ['start'], 10000);
    log('✓ Production server started successfully');
    
    log('\n✅ All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    log('\n❌ Smoke tests failed:', error.message);
    process.exit(1);
  } finally {
    log('\nStarting cleanup process...');
    // Cleanup: ensure all servers are stopped gracefully
    if (devServer) {
      log('Stopping development server...');
      devServer.kill('SIGTERM');
      log('Waiting for development server cleanup...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
      log('Development server cleanup complete');
    }
    if (prodServer) {
      log('Stopping production server...');
      prodServer.kill('SIGTERM');
      log('Waiting for production server cleanup...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
      log('Production server cleanup complete');
    }
    log('Running final port cleanup...');
    await killProcessOnPort(PORT); // Final cleanup
    log('Cleanup process complete');
  }
}

main();
