# **Smallocator — Architecture Overview Document**

## Overview
**Smallocator** is a minimalistic Node.js API server implemented using Typescript and designed to act as a basic server-based allocator for [The Compact](https://github.com/Uniswap/the-compact). It interacts with an external [GraphQL indexing API](https://github.com/Uniswap/the-compact-indexer) for data retrieval and performs rigorous validation of Compact messages before signing, storing, and returning attestations. This design emphasizes simplicity, security, and high availability while ensuring low latency.

## Technical Stack
- **Language**: TypeScript
- **Framework**: Fastify
- **Hashing and Signing**: [viem](https://viem.sh/)
- **GraphQL Client**: `graphql-request`
- **Database**: PGLite
- **Environment Management**: `dotenv`
- **Cloud Deployment**: Vercel (or similar)

## High-Level Design

### Configuration & Initialization
1. **Keypair Generation**:
   - Generate an ECDSA keypair on the first run.
   - Store the private key securely (e.g., in an `.env` file).
   - Validate the private key matches the public signing address at startup.

2. **Core API Endpoints**:
   - **GET `/health`**: Provides server health and configuration details.
   - **GET `/session/:address`**: Supplies the EIP-4361 payload for sponsors to sign.
   - **POST `/session`**: Creates a session for a sponsor by verifying their EIP-4361 signature.
   - **POST `/compact`**: Validates and submits EIP-712 Compact messages (session-gated).
   - **GET `/compacts`**: Retrieves all compacts submitted by a sponsor (session-gated).
   - **GET `/compact/:chainId/:claimHash`**: Retrieves details of a specific compact (session-gated).

3. **Database Schema**:
   - **Nonces**: Tracks consumed nonces for domains.
   - **Sessions**: Manages active sessions for sponsors.
   - **Compacts**: Stores submitted compacts and their associated metadata.

4. **Security Measures**:
   - The private key remains inaccessible through the API or logs.
   - Enforce HTTPS for secure communication (this constraint can be relaxed when running locally).
   - Validate all inputs rigorously and apply basic rate limiting.

5. **Data Flow**:
   - Validate sponsor sessions using the database.
   - Perform initial validation of provided Compact messages.
   - Query data from the external indexing API with GraphQL.
   - Perform final validation of Compact messages.
   - Generate attestations for valid compacts by signing using EIP-712, marking their nonce as having been consumed, and storing their metadata.
   - Return the hash and signature for attested compacts.

---

## API Specifications

### **GET `/health`**
- **Description**: Returns the server's health and configuration.
- **Response**:
```json
  {
    "status": "healthy",
    "allocatorAddress": "0x...",
    "signingAddress": "0x..."
  }
```

### **GET `/session/:address`**
- **Description**: Provides an EIP-4361 session payload for the sponsor to sign.
- **Response**:
```json
  {
    "payload": {
      "domain": "smallocator.example",
      "address": "0x...",
      "uri": "https://smallocator.example",
      "statement": "Sign in to Smallocator",
      "version": "1",
      "chainId": 1,
      "nonce": "unique_nonce",
      "issuedAt": "2024-12-03T12:00:00Z",
      "expirationTime": "2024-12-03T13:00:00Z",
      "resources": ["https://smallocator.example/resources"]
    }
  }
```

### **POST `/session`**
- **Description**: Creates a session by verifying the sponsor's EIP-4361 signature.
- **Request**:
```json
  {
    "signature": "0x...",
    "payload": {
      "domain": "smallocator.example",
      "address": "0x...",
      "uri": "https://smallocator.example",
      "statement": "Sign in to Smallocator",
      "version": "1",
      "chainId": 1,
      "nonce": "unique_nonce",
      "issuedAt": "2024-12-03T12:00:00Z",
      "expirationTime": "2024-12-03T13:00:00Z",
      "resources": ["https://smallocator.example/resources"]
    }
  }
```
- **Response**:
```json
  {
    "sessionId": "abc123",
    "expiresAt": "2024-12-03T13:00:00Z"
  }
```

### **POST `/compact`**
- **Description**: Validates and submits an EIP-712 Compact message.
- **Request**:
```json
  {
    "chainId": 10,
    "compact": {
      "arbiter": "0x...",
      "sponsor": "0x...",
      "nonce": "123...",
      "expires": 1732520000,
      "id": "0x...",
      "amount": "1000",
      "witnessTypeString": null,
      "witnessHash": null
    }
  }
```
- **Response**:
```json
  {
    "hash": "0x...",
    "signature": "0x..."
  }
```

### **GET `/compacts`**
- **Description**: Retrieves all submitted compacts for a sponsor.
- **Requires**: A valid session.
- **Response**:
```json
  [
    {
      "chainId": 10,
      "hash": "0x...",
      "compact": {
        "arbiter": "0x...",
        "sponsor": "0x...",
        "nonce": "123...",
        "expires": 1732520000,
        "id": "0x...",
        "amount": "1000",
        "witnessTypeString": null,
        "witnessHash": null
      },
      "signature": "0x..."
    }
  ]
```

### **GET `/compact/:chainId/:claimHash`**
- **Description**: Retrieves details of a specific compact.
- **Requires**: A valid session.
- **Response**:
```json
  {
    "hash": "0x...",
    "compact": {
      "arbiter": "0x...",
      "sponsor": "0x...",
      "nonce": "123...",
      "expires": 1732520000,
      "id": "0x...",
      "amount": "1000",
      "witnessTypeString": null,
      "witnessHash": null
    },
    "signature": "0x..."
  }
```

---

## Validation Logic

### **Session Validation**
1. Verify that the EIP-4361 payload is properly structured:
   - The payload must include the sponsor's address, a valid `nonce`, and the current timestamp (`issuedAt`).
   - The `domain` must match the server's domain.
   - The `statement` should confirm that the sponsor is signing in.
   - The `expirationTime` must be in the future and within the allowed session duration.
2. Check that the signature matches the payload using the sponsor's address.
3. Confirm the session is active in the database:
   - The session's expiration timestamp must be in the future.
   - The session address must match the payload's address.

---

### **Compact Validation**

#### 1. **Structural Validation**
- Validate that all required fields are present:
  - `arbiter`, `sponsor`, `nonce`, `expires`, `id`, `amount`, and `chainId`.
- Verify Ethereum address fields (`arbiter` and `sponsor`) are valid.
- Ensure `amount`, `id`, and `chainId` are valid `uint256` values.
- Check that `witnessTypestring` and `witnessHash`:
  - Are either both null or both present.
  - If present, ensure `witnessTypestring` is a string and `witnessHash` is a valid `bytes32` hash.
- Confirm that `expires` is a valid timestamp and is within the next 2 hours.

#### 2. **Nonce Validation**
- Confirm the nonce is a valid `uint256`.
- Check that the first 20 bytes of the nonce match the sponsor's address.
- Validate the nonce has not been used before in this domain (tracked in the database).

#### 3. **Expiration Validation**
- Verify that the `expires` timestamp is:
  - In the future at the time of validation.
  - Within the next 2 hours to ensure short-lived compacts.

#### 4. **Domain and ID Validation**
- Derive the domain:
  - `name` is "The Compact".
  - `version` is "0".
  - `verifyingContract` is "0x00000000000018DF021Ff2467dF97ff846E09f48".
  - provided `chainId` value must be a valid `uint256`.
- Extract the `allocatorId` and `resetPeriod` from the `id`:
  - Use the following extraction logic:
    ```javascript
    const ResetPeriod = {
      OneSecond: 1,
      FifteenSeconds: 15,
      OneMinute: 60,
      TenMinutes: 600,
      OneHourAndFiveMinutes: 3900,
      OneDay: 86400,
      SevenDaysAndOneHour: 612000,
      ThirtyDays: 2592000,
    };
    const resetPeriodIndex = Number((id >> 252n) & 0x7n);
    const resetPeriod = Object.values(ResetPeriod)[resetPeriodIndex]!;
    const allocatorId = (id >> 160n) & ((1n << 92n) - 1n);
    ```
- Compare the extracted `allocatorId` with the one returned by the GraphQL API.
- Confirm the `resetPeriod` does not facilitate a forced withdrawal before the compact expires:
  - `(now + resetPeriod) >= expires`.

#### 5. **Allocation Validation**
- Fetch relevant data using the GraphQL API:
  - Current finalized balance for the `id`.
  - List of processed claims against compacts sponsored by the sponsor and using this allocator in the last 2 hours.
  - Withdrawal status and balances for the sponsor's resource lock.
- Validate the following:
  - Ensure the sponsor's resource lock does not have forced withdrawals enabled (`withdrawalStatus` is `0`).
  - Calculate the "pending balance":
    - Sum all unfinalized deposits or transfers (`accountDeltas`).
  - Calculate the "allocatable balance":
    - `allocatableBalance = resourceLockBalance - pendingBalance` (minimum of 0).
  - Calculate the "allocated balance":
    - Sum all valid compacts:
      - Not expired (accounting for the finalization delay).
      - Not yet finalized (i.e., no processed claim).
  - Ensure the `allocatable balance >= allocated balance + compact amount`.

#### 6. **Claim Hash Derivation**
- Derive the claim hash for the compact:
  - If no witness data:
    ```javascript
    const hash = keccak256(
      abi.encode(
        [
          "bytes32",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          "0xcdca950b17b5efc016b74b912d8527dfba5e404a688cbc3dab16cb943287fec2",
          arbiter,
          sponsor,
          nonce,
          expires,
          id,
          amount,
        ]
      )
    );
    ```
  - If witness data provided:
    ```javascript
    const typeHash = keccak256(
      abi.encodePacked(
        "Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,",
        witnessTypestring
      )
    );
    const hash = keccak256(
      abi.encode(
        [
          "bytes32",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "bytes32",
        ],
        [
          typeHash,
          arbiter,
          sponsor,
          nonce,
          expires,
          id,
          amount,
          witnessHash,
        ]
      )
    );
    ```

### **Atomic Submission Validation and Recording**
1. Sign the compact using:
   - The derived claim hash.
   - The domain details.
   - The server's private signing key.
2. Record the following in the database:
   - The compact's metadata (`hash`, `sponsor`, `nonce`, `expires`, `id`, `amount`, `witnessTypestring`, `witnessHash`, `chainId`, `signature`).
   - Mark the nonce as consumed for the specific domain and `chainId`.

---

### **Final Response**
- Return the signature and claim hash for the compact:
  ```json
  {
    "hash": "0x...",
    "signature": "0x..."
  }
  ```


## GraphQL Query
The server is available at https://the-compact-indexer-2.ponder-dev.com/ (note that some form of proxy support should be configurable during development to work around CORS issues when running the allocator against localhost).

```graphql
query GetDetails($allocator: String!, $sponsor: String!, $lockId: BigInt!, $chainId: BigInt!) {
  allocator(address: $allocator) {
    supportedChains(where: {chainId: $chainId}) {
      items {
        allocatorId
      }
    }
  }
  accountDeltas(where: {address: $sponsor, resourceLock: $lockId, chainId: $chainId, delta_gt: "0"}, orderBy: "blockTimestamp", orderDirection: "DESC") {
    items {
      delta
    }
  }
  account(address: $sponsor) {
    resourceLocks(where: {resourceLock: $lockId, chainId: $chainId}) {
      items {
        withdrawalStatus
        balance
      }
    }
    claims(where: {allocator: $allocator, chainId: $chainId}, orderBy: "timestamp", orderDirection: "DESC") {
      items {
        claimHash
      }
    }
  }
}
```

Example variables:
```json
{
  "allocator": "0x0734d56da60852a03e2aafae8a36ffd8c12b32f1",
  "sponsor": "0x899ee89dbe7e74dae12e20cc255cec0d59b5d4fc",
  "lockId": "21792518056623590435587568419860581671612179420134533156813620419438053425152",
  "chainId": "10",
  "finalizationTimestamp": "1742511953",
  "thresholdTimestamp": "1732511451"
}
```

Example response:
```json
{
  "data": {
    "allocator": {
      "supportedChains": {
        "items": [
          {
            "allocatorId": "55765469257802026776384764"
          }
        ]
      }
    },
    "accountDeltas": {
      "items": [
        {
          "delta": "700000000000"
        },
        {
          "delta": "400000000000"
        }
      ]
    },
    "account": {
      "resourceLocks": {
        "items": [
          {
            "withdrawalStatus": 0,
            "balance": "8000000000000"
          }
        ]
      },
      "claims": {
        "items": [
          {
            "claimHash": "0x2fcfd671637371ee10057d03662323b457ebd6eb38c09231cc7dd6c65ac50761"
          },
          {
            "claimHash": "0xfa156004548126208463b1212a2bacb2a10357d211b15ea9419a41acfbabf4b7"
          }
        ]
      }
    }
  }
}
```

---

## Final Thoughts

This document provides a detailed blueprint for implementing **Smallocator**, a minimalistic yet robust allocator server. To ensure a successful implementation and seamless development experience, here are key recommendations and reminders:

### 1. **Adhere to the Document**
- **Follow the Guidelines**: Stick to the architecture and validation logic outlined in this document. Ensure every endpoint and validation step is implemented as described to maintain consistency and correctness. If there are areas that need further clarification or functionality, bring those details up for discussion so they can be integrated into this document.
- **Use Examples**: Refer to the provided examples (e.g., GraphQL queries, validation logic, hashing procedures) to guide your implementation.

### 2. **Code Thoroughly and Clearly**
- **Comment Extensively**: Document the purpose of each function, endpoint, and validation rule. This will make the codebase easier to understand and maintain, especially for collaborators or future contributors.
- **Adopt Consistent Style**: Use consistent naming conventions and formatting. Utilize TypeScript’s strong typing to define interfaces and enforce structure in your data models.

### 3. **Develop Incrementally**
- **Break Tasks into Small Chunks**: Divide the project into manageable pieces. For instance:
  - Begin by installing all dependencies and setting up the basic layout of the server.
  - Start with keypair generation and the `/health` endpoint.
  - Move on to session creation (`/session`) and validation.
  - Implement compact submission and initial validation logic incrementally.
- **Commit Often**: Use small, focused commits to track progress. Each commit should address a single piece of functionality or a specific bug fix. Include unit tests or other tests as part of each commit where possible. Establish precommit hooks to enforce that code passes lint checks, that the server builds and runs without errors or warnings, and that all tests pass.

### 4. **Integrate Testing**
- **Unit Tests**: Create unit tests for critical functions, such as nonce validation, hashing, and GraphQL response handling. Mock dependencies (e.g., database or API responses) for isolated testing.
- **Integration Tests**: Test the complete flow for each endpoint, including session validation, compact validation, and submission logic.
- **Automate Testing**: Set up automated tests to run on every commit or pull request to catch regressions early.

### 5. **Keep Security in Focus**
- **Private Key Security**: Ensure the private key is securely stored and never exposed. Test failure modes for misconfigured or invalid keys.
- **Input Validation**: Implement strict validation for all inputs (e.g., addresses, nonces, timestamps) to prevent misuse.
- **Rate Limiting**: Protect endpoints from abuse with appropriate rate-limiting measures.

### 6. **Leverage Debugging Tools**
- **Log Verbosely During Development**: Use structured logging to trace the flow of data through the server. Avoid logging sensitive information like private keys or session tokens.
- **Monitor with Metrics**: Set up basic monitoring (e.g., request counts, errors) to diagnose issues during development and deployment.

### 7. **Collaborate Effectively**
- **Document Assumptions**: If any part of the document is unclear, note your assumptions and validate them through discussion or additional research.
- **Review Code**: Use code reviews to ensure the implementation aligns with the design and best practices.
- **Share Progress**: Regularly update collaborators on progress, especially when completing key milestones. Your key collaborator and coauthor on this project is 0age who is the primary author of The Compact; if you have any questions about the behavior of the protocol or about this project, ask them.

### 8. **Select a Task and Start**
- Begin with foundational tasks, such as generating the signing keypair and implementing the `/health` endpoint. These tasks provide a starting point for understanding the project structure.
- As each component is completed, build upon it incrementally, testing and validating at every stage.

By following these principles, you can approach the development of Smallocator methodically, ensuring a reliable, maintainable, and secure implementation. Whether you are an AI agent synthesizing this document or a human developer contributing on this project, the steps outlined here will guide you to success. Happy coding!
