import { spawnSync } from 'child_process';

// Get shard info from command line args
const shardArg = process.argv.find(arg => arg.startsWith('--shard='));
if (!shardArg) {
  console.error('Missing --shard argument');
  process.exit(1);
}

const [currentShard, totalShards] = shardArg.split('=')[1].split('/').map(Number);
if (!currentShard || !totalShards || currentShard > totalShards) {
  console.error('Invalid shard format. Use --shard=X/Y where X <= Y');
  process.exit(1);
}

// Run Jest with sharding
const result = spawnSync('jest', [
  '--detectOpenHandles',
  `--shard=${currentShard}/${totalShards}`
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--experimental-vm-modules --no-warnings',
    JEST_SHARD: `${currentShard}/${totalShards}`
  }
});

process.exit(result.status);
