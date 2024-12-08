-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table for managing user authentication
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    address bytea NOT NULL CHECK (length(address) = 20),
    nonce TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    domain TEXT NOT NULL
);

-- Session requests table
CREATE TABLE session_requests (
    id UUID PRIMARY KEY,
    address bytea NOT NULL CHECK (length(address) = 20),
    nonce TEXT NOT NULL,
    domain TEXT NOT NULL,
    chain_id bigint NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE
);

-- Compacts table for storing compact messages and their metadata
CREATE TABLE compacts (
    id UUID PRIMARY KEY,
    chain_id bigint NOT NULL,
    claim_hash bytea NOT NULL CHECK (length(claim_hash) = 32),
    arbiter bytea NOT NULL CHECK (length(arbiter) = 20),
    sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
    nonce bytea NOT NULL CHECK (length(nonce) = 32),
    expires BIGINT NOT NULL,
    compact_id bytea NOT NULL CHECK (length(compact_id) = 32),
    amount bytea NOT NULL CHECK (length(amount) = 32),
    witness_type_string TEXT,
    witness_hash bytea CHECK (witness_hash IS NULL OR length(witness_hash) = 32),
    signature bytea NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, claim_hash)
);

-- Nonces table for tracking consumed nonces
CREATE TABLE nonces (
    id UUID PRIMARY KEY,
    chain_id bigint NOT NULL,
    sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
    nonce_high bigint NOT NULL,
    nonce_low integer NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, sponsor, nonce_high, nonce_low)
);

-- Create indexes for common query patterns
CREATE INDEX idx_sessions_address ON sessions(address);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_session_requests_address ON session_requests(address);
CREATE INDEX idx_session_requests_expiration_time ON session_requests(expiration_time);
CREATE INDEX idx_compacts_sponsor ON compacts(sponsor);
CREATE INDEX idx_compacts_chain_claim ON compacts(chain_id, claim_hash);
CREATE INDEX idx_nonces_chain_sponsor ON nonces(chain_id, sponsor);
