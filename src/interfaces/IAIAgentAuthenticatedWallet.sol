// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

/// @title IAIAgentAuthenticatedWallet
/// @notice ERC-8196 AI Agent Authenticated Wallet interface (Confirmed Final).
/// @dev SPEC GAP: published `executeAction` omits `string action`, but EIP-712 `AgentAction`
///      requires it. Bound Wallet adds `action` as a trailing argument, hashes it into the
///      typed data, and reverts `PolicyViolation` if it is not in `allowedActions`.
///      Non-empty `data` must be meterable ERC-20 `transfer`/`transferFrom` (raw token units,
///      18-decimal assumption; see BoundWallet NatSpec).
interface IAIAgentAuthenticatedWallet {
    event PolicyRegistered(
        bytes32 indexed policyHash, address indexed owner, address indexed agent, uint256 validUntil
    );
    event ActionExecuted(
        bytes32 indexed policyHash, address indexed agent, address target, uint256 value, bytes32 auditEntryId
    );
    event PolicyRevoked(bytes32 indexed policyHash, string reason);
    event AuditEntryLogged(bytes32 indexed entryId, uint256 sequence, bytes32 sessionId, string actionType);

    function registerPolicy(
        address agent,
        uint256 agentId,
        string[] calldata allowedActions,
        address[] calldata allowedContracts,
        address[] calldata blockedContracts,
        uint256 maxValuePerTx,
        uint256 maxValuePerDay,
        uint256 validAfter,
        uint256 validUntil,
        uint8 minVerificationScore
    ) external returns (bytes32 policyHash);

    function executeAction(
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 nonce,
        bytes32 entropyCommitment,
        bytes calldata signature,
        string calldata action
    ) external returns (bool success, bytes32 auditEntryId);

    function revokePolicy(bytes32 policyHash, string calldata reason) external;

    function getPolicy(bytes32 policyHash)
        external
        view
        returns (address agent, address owner, uint256 maxValuePerTx, uint256 validUntil, bool isActive);
}
