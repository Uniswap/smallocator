import { spawn } from 'child_process';

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
  try {
    // Find process using port
    const findProcess = spawn('lsof', ['-t', `-i:${port}`], { shell: true });
    const pid = await new Promise((resolve) => {
      let output = '';
      findProcess.stdout?.on('data', (data) => {
        output += data;
      });
      findProcess.on('close', () => {
        resolve(output.trim());
      });
    });

    if (pid) {
      // Kill the process
      await new Promise((resolve) => {
        const kill = spawn('kill', ['-9', pid], { stdio: 'inherit', shell: true });
        kill.on('exit', () => resolve());
      });
      
      // Wait for port to be free with timeout
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const checkPort = spawn('lsof', ['-t', `-i:${port}`], { shell: true });
        const stillInUse = await new Promise(resolve => {
          checkPort.on('close', code => resolve(code === 0));
        });
        if (!stillInUse) break;
        if (i === maxAttempts - 1) {
          throw new Error(`Port ${port} is still in use after ${maxAttempts} attempts to free it`);
        }
      }
    }
  } catch (e) {
    console.error(`Error killing process on port ${port}:`, e.message);
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
    console.log(`Testing development mode (pnpm dev) on port ${PORT}...`);
    devServer = await waitForServer('PORT=' + PORT + ' pnpm', ['dev'], 10000);
    console.log('✓ Development server started successfully');
    
    // Kill the development server
    if (devServer) {
      devServer.kill('SIGTERM');
      await killProcessOnPort(PORT);
    }
    
    // Test production mode
    console.log('\nTesting production mode (pnpm start)...');
    // First build
    console.log('Building...');
    const buildProcess = spawn('pnpm', ['build'], { stdio: 'inherit', shell: true });
    await new Promise((resolve, reject) => {
      buildProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
    
    prodServer = await waitForServer('PORT=' + PORT + ' pnpm', ['start'], 10000);
    console.log('✓ Production server started successfully');
    
    console.log('\n✅ All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke tests failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: ensure all servers are stopped gracefully
    if (devServer) {
      devServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    }
    if (prodServer) {
      prodServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    }
    await killProcessOnPort(PORT); // Final cleanup
  }
}

main();
