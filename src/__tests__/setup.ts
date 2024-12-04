// Set up test environment variables before any tests run
process.env.SKIP_SIGNING_VERIFICATION = 'true';
process.env.NODE_ENV = 'test';
process.env.SIGNING_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
process.env.ALLOCATOR_ADDRESS = '0x2345678901234567890123456789012345678901';
process.env.PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
process.env.CORS_ORIGIN = '*';
process.env.PORT = '3001';
