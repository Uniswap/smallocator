-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table for managing user authentication
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    domain TEXT NOT NULL
);

-- Compacts table for storing compact messages and their metadata
CREATE TABLE compacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id TEXT NOT NULL,
    claim_hash TEXT NOT NULL,
    arbiter TEXT NOT NULL,
    sponsor TEXT NOT NULL,
    nonce TEXT NOT NULL,
    expires BIGINT NOT NULL,
    compact_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    witness_type_string TEXT,
    witness_hash TEXT,
    signature TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, claim_hash)
);

-- Nonces table for tracking consumed nonces
CREATE TABLE nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id TEXT NOT NULL,
    nonce TEXT NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, nonce)
);

-- Create indexes for common query patterns
CREATE INDEX idx_sessions_address ON sessions(address);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_compacts_sponsor ON compacts(sponsor);
CREATE INDEX idx_compacts_chain_claim ON compacts(chain_id, claim_hash);
CREATE INDEX idx_nonces_chain_nonce ON nonces(chain_id, nonce);
