export const boundWalletAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "riskOracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "registerPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "allowedActions", type: "string[]" },
      { name: "allowedContracts", type: "address[]" },
      { name: "blockedContracts", type: "address[]" },
      { name: "maxValuePerTx", type: "uint256" },
      { name: "maxValuePerDay", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "minVerificationScore", type: "uint8" },
    ],
    outputs: [{ name: "policyHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "executeAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "nonce", type: "uint256" },
      { name: "entropyCommitment", type: "bytes32" },
      { name: "signature", type: "bytes" },
      { name: "action", type: "string" },
    ],
    outputs: [
      { name: "success", type: "bool" },
      { name: "auditEntryId", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "revokePolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAll",
    stateMutability: "nonpayable",
    inputs: [{ name: "reason", type: "string" }],
    outputs: [{ name: "revoked", type: "uint256" }],
  },
  {
    type: "function",
    name: "revealEntropy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "entryId", type: "bytes32" },
      { name: "secret", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "entropyRevealed",
    stateMutability: "view",
    inputs: [{ name: "entryId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "policyHashAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "policyHash", type: "bytes32" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxValuePerTx", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getAuditEntry",
    stateMutability: "view",
    inputs: [{ name: "entryId", type: "bytes32" }],
    outputs: [
      { name: "previousHash", type: "bytes32" },
      { name: "entropyCommitment", type: "bytes32" },
      { name: "sequence", type: "uint256" },
      { name: "sessionId", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "spentOnDay",
    stateMutability: "view",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "day", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "policyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isAllowedContract",
    stateMutability: "view",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "target", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isAllowedAction",
    stateMutability: "view",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "error",
    name: "PolicyExpired",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "validUntil", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ValueExceedsLimit",
    inputs: [
      { name: "value", type: "uint256" },
      { name: "maxValue", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidSignature",
    inputs: [
      { name: "recovered", type: "address" },
      { name: "expected", type: "address" },
    ],
  },
  {
    type: "error",
    name: "PolicyViolation",
    inputs: [
      { name: "policyHash", type: "bytes32" },
      { name: "reason", type: "string" },
    ],
  },
  {
    type: "error",
    name: "EntropyVerificationFailed",
    inputs: [{ name: "entryId", type: "bytes32" }],
  },
  {
    type: "event",
    name: "PolicyRegistered",
    inputs: [
      { name: "policyHash", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "validUntil", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActionExecuted",
    inputs: [
      { name: "policyHash", type: "bytes32", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "auditEntryId", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyRevoked",
    inputs: [
      { name: "policyHash", type: "bytes32", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AuditEntryLogged",
    inputs: [
      { name: "entryId", type: "bytes32", indexed: true },
      { name: "sequence", type: "uint256", indexed: false },
      { name: "sessionId", type: "bytes32", indexed: false },
      { name: "actionType", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EntropyRevealed",
    inputs: [
      { name: "entryId", type: "bytes32", indexed: true },
      { name: "secret", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const mockErc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const mockRiskOracleAbi = [
  {
    type: "function",
    name: "setScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasScore",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getLatestRiskScore",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const agentActionTypes = {
  AgentAction: [
    { name: "agent", type: "address" },
    { name: "action", type: "string" },
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "nonce", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "policyHash", type: "bytes32" },
    { name: "entropyCommitment", type: "bytes32" },
  ],
} as const;

export const eip712Domain = {
  name: "AIAgentAuthenticatedWallet",
  version: "1",
} as const;
