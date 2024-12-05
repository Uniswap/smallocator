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

    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      
      // Check if server has started
      if (chunk.includes('Server listening')) {
        serverStarted = true;
        resolve();
      }
    });

    // Set timeout
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        process.kill('SIGTERM');
        reject(new Error('Server failed to start within timeout'));
      }
    }, timeoutMs);

    process.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    process.on('exit', (code) => {
      clearTimeout(timeout);
      if (!serverStarted) {
        reject(new Error(`Process exited with code ${code}\nOutput: ${output}`));
      }
    });

    return process;
  });
}

// Kill process using port
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
      // Wait a bit for the process to die
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {
    // Ignore errors from kill commands
  }
}

// Get port from environment variable or use default
const PORT = process.env.SMOKE_TEST_PORT || 3000;

async function main() {
  try {
    // Ensure port is free before starting
    await killProcessOnPort(PORT);

    // Test development mode
    console.log(`Testing development mode (pnpm dev) on port ${PORT}...`);
    await waitForServer('PORT=' + PORT + ' pnpm', ['dev'], 10000);
    console.log('✓ Development server started successfully');
    
    // Kill the development server
    await killProcessOnPort(PORT);
    
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
    
    await waitForServer('PORT=' + PORT + ' pnpm', ['start'], 10000);
    console.log('✓ Production server started successfully');
    
    console.log('\n✅ All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke tests failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: ensure port is free
    await killProcessOnPort(PORT);
  }
}

main();
