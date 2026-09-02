// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

import {IAIAgentAuthenticatedWallet} from "./interfaces/IAIAgentAuthenticatedWallet.sol";
import {IRiskOracle} from "./mocks/MockRiskOracle.sol";

/// @title BoundWallet
/// @notice Hour-1 ERC-8196 MVP: owner registers an immutable policy; an AI agent never holds the
///         owner key; `executeAction` succeeds only if an EIP-712 `AgentAction` complies with that policy.
///
/// @dev ERC-20 metering / decimals: when `data` is non-empty, it must be a standard ABI-encoded
///      `transfer(address,uint256)` or `transferFrom(address,address,uint256)`. The decoded token
///      `amount` is added to native `value` and checked against `maxValuePerTx` / `maxValuePerDay`.
///      Amounts are the token's **raw units with no decimal conversion**. That is 1:1 with wei only
///      for 18-decimal tokens (this repo's MockERC20). A 6-decimal token's `1e6` (one whole token)
///      meters as `1e6` against the same caps. Unknown or unmeterable calldata is rejected.
contract BoundWallet is IAIAgentAuthenticatedWallet {
    error PolicyExpired(bytes32 policyHash, uint256 validUntil);
    error ValueExceedsLimit(uint256 value, uint256 maxValue);
    error InvalidSignature(address recovered, address expected);
    error PolicyViolation(bytes32 policyHash, string reason);

    /// @dev IERC20.transfer(address,uint256)
    bytes4 private constant _TRANSFER_SELECTOR = 0xa9059cbb;
    /// @dev IERC20.transferFrom(address,address,uint256)
    bytes4 private constant _TRANSFER_FROM_SELECTOR = 0x23b872dd;

    bytes32 public constant AGENT_ACTION_TYPEHASH = keccak256(
        "AgentAction(address agent,string action,address target,uint256 value,bytes data,uint256 nonce,uint256 validUntil,bytes32 policyHash,bytes32 entropyCommitment)"
    );

    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256(bytes("AIAgentAuthenticatedWallet"));
    bytes32 private constant _VERSION_HASH = keccak256(bytes("1"));

    struct Policy {
        address agent;
        address owner;
        uint256 agentId;
        uint256 maxValuePerTx;
        uint256 maxValuePerDay;
        uint256 validAfter;
        uint256 validUntil;
        uint8 minVerificationScore;
        bool exists;
        bool isActive;
    }

    struct AuditEntry {
        bytes32 previousHash;
        bytes32 entropyCommitment;
        uint256 sequence;
        bytes32 sessionId;
    }

    address public immutable owner;
    IRiskOracle public immutable riskOracle;

    uint256 public policyCount;
    uint256 public auditSequence;
    bytes32 public lastAuditHash;

    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => mapping(bytes32 => bool)) public isAllowedAction;
    mapping(bytes32 => mapping(address => bool)) public isAllowedContract;
    mapping(bytes32 => mapping(address => bool)) public isBlockedContract;
    mapping(bytes32 => mapping(uint256 => bool)) public nonceUsed;
    mapping(bytes32 => mapping(uint256 => uint256)) public spentOnDay;
    mapping(bytes32 => AuditEntry) private _auditEntries;

    constructor(address riskOracle_) {
        if (riskOracle_ == address(0)) revert PolicyViolation(bytes32(0), "oracle required");
        owner = msg.sender;
        riskOracle = IRiskOracle(riskOracle_);
    }

    receive() external payable {}

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(_EIP712_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)));
    }

    /// @inheritdoc IAIAgentAuthenticatedWallet
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
    ) external returns (bytes32 policyHash) {
        if (msg.sender != owner) revert PolicyViolation(bytes32(0), "not owner");
        if (agent == address(0)) revert PolicyViolation(bytes32(0), "agent required");
        if (validUntil <= validAfter) revert PolicyViolation(bytes32(0), "invalid window");

        uint256 id = ++policyCount;
        policyHash = keccak256(
            abi.encode(
                address(this),
                id,
                agent,
                agentId,
                msg.sender,
                _hashStrings(allowedActions),
                allowedContracts,
                blockedContracts,
                maxValuePerTx,
                maxValuePerDay,
                validAfter,
                validUntil,
                minVerificationScore
            )
        );

        Policy storage policy = _policies[policyHash];
        policy.agent = agent;
        policy.owner = msg.sender;
        policy.agentId = agentId;
        policy.maxValuePerTx = maxValuePerTx;
        policy.maxValuePerDay = maxValuePerDay;
        policy.validAfter = validAfter;
        policy.validUntil = validUntil;
        policy.minVerificationScore = minVerificationScore;
        policy.exists = true;
        policy.isActive = true;

        for (uint256 i; i < allowedActions.length; ++i) {
            isAllowedAction[policyHash][keccak256(bytes(allowedActions[i]))] = true;
        }
        for (uint256 i; i < allowedContracts.length; ++i) {
            isAllowedContract[policyHash][allowedContracts[i]] = true;
        }
        for (uint256 i; i < blockedContracts.length; ++i) {
            isBlockedContract[policyHash][blockedContracts[i]] = true;
        }

        emit PolicyRegistered(policyHash, msg.sender, agent, validUntil);
    }

    /// @inheritdoc IAIAgentAuthenticatedWallet
    function executeAction(
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 nonce,
        bytes32 entropyCommitment,
        bytes calldata signature,
        string calldata action
    ) external returns (bool success, bytes32 auditEntryId) {
        Policy storage policy = _policies[policyHash];

        // 1. Policy exists and isActive
        if (!policy.exists) revert PolicyViolation(policyHash, "policy not found");
        if (!policy.isActive) revert PolicyViolation(policyHash, "policy inactive");

        // 2. block.timestamp in [validAfter, validUntil]
        if (block.timestamp < policy.validAfter) {
            revert PolicyViolation(policyHash, "policy not yet valid");
        }
        if (block.timestamp > policy.validUntil) {
            revert PolicyExpired(policyHash, policy.validUntil);
        }

        // 3. Recovered signer == policy agent
        address recovered =
            _recoverAgent(policy, policyHash, target, value, data, nonce, entropyCommitment, signature, action);
        if (recovered != policy.agent) {
            revert InvalidSignature(recovered, policy.agent);
        }

        // 4. nonce unused for that policy
        if (nonceUsed[policyHash][nonce]) {
            revert PolicyViolation(policyHash, "nonce already used");
        }

        // 5. target in allowedContracts AND not in blockedContracts
        if (isBlockedContract[policyHash][target]) {
            revert PolicyViolation(policyHash, "blocked contract");
        }
        if (!isAllowedContract[policyHash][target]) {
            revert PolicyViolation(policyHash, "target not allowlisted");
        }

        // 6. action in allowedActions (`transfer` covers native ETH and ERC-20 transfer calls)
        if (!isAllowedAction[policyHash][keccak256(bytes(action))]) {
            revert PolicyViolation(policyHash, "action not allowed");
        }

        // 7–8. Meter native `value` plus ERC-20 transfer/transferFrom amounts (raw token units).
        //      Empty `data` is a native transfer. Non-empty `data` must be meterable ERC-20
        //      transfer/transferFrom; the inner recipient must be allowlisted.
        uint256 metered = _meteredAmount(policyHash, value, data);
        if (metered > policy.maxValuePerTx) {
            revert ValueExceedsLimit(metered, policy.maxValuePerTx);
        }

        uint256 day = block.timestamp / 1 days;
        if (policy.maxValuePerDay > 0) {
            uint256 newSpend = spentOnDay[policyHash][day] + metered;
            if (newSpend > policy.maxValuePerDay) {
                revert ValueExceedsLimit(metered, policy.maxValuePerDay);
            }
            spentOnDay[policyHash][day] = newSpend;
        }

        // 9. MockRiskOracle: fail closed if no score is recorded.
        //    Then reject if score EXCEEDS threshold (lower score = lower risk).
        if (!riskOracle.hasScore(policy.agentId)) {
            revert PolicyViolation(policyHash, "risk score unset");
        }
        uint8 score = riskOracle.getLatestRiskScore(policy.agentId);
        if (score > policy.minVerificationScore) {
            revert PolicyViolation(policyHash, "risk score exceeds threshold");
        }

        nonceUsed[policyHash][nonce] = true;

        // 10. Execute call, append hash-chained audit (previousHash), emit events
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) revert PolicyViolation(policyHash, "execution failed");
        _requireErc20Success(policyHash, data, ret);

        auditEntryId = _appendAudit(policyHash, policy.agent, target, value, nonce, entropyCommitment, action);
        emit ActionExecuted(policyHash, policy.agent, target, value, auditEntryId);
        success = true;
    }

    /// @inheritdoc IAIAgentAuthenticatedWallet
    function revokePolicy(bytes32 policyHash, string calldata reason) external {
        Policy storage policy = _policies[policyHash];
        if (!policy.exists) revert PolicyViolation(policyHash, "policy not found");
        if (msg.sender != policy.owner) revert PolicyViolation(policyHash, "not owner");
        if (!policy.isActive) revert PolicyViolation(policyHash, "policy inactive");
        policy.isActive = false;
        emit PolicyRevoked(policyHash, reason);
    }

    /// @inheritdoc IAIAgentAuthenticatedWallet
    function getPolicy(bytes32 policyHash)
        external
        view
        returns (address agent, address owner_, uint256 maxValuePerTx, uint256 validUntil, bool isActive)
    {
        Policy storage policy = _policies[policyHash];
        return (policy.agent, policy.owner, policy.maxValuePerTx, policy.validUntil, policy.isActive);
    }

    function getAuditEntry(bytes32 entryId)
        external
        view
        returns (bytes32 previousHash, bytes32 entropyCommitment, uint256 sequence, bytes32 sessionId)
    {
        AuditEntry storage entry = _auditEntries[entryId];
        return (entry.previousHash, entry.entropyCommitment, entry.sequence, entry.sessionId);
    }

    /// @dev Native `value` plus ERC-20 `transfer`/`transferFrom` amount. Empty calldata is native-only.
    function _meteredAmount(bytes32 policyHash, uint256 value, bytes calldata data)
        private
        view
        returns (uint256 metered)
    {
        metered = value;
        if (data.length == 0) return metered;
        metered += _tokenAmountFromCalldata(policyHash, data);
    }

    /// @dev Decode a standard ERC-20 transfer/transferFrom. Rejects any other or non-canonical encoding.
    function _tokenAmountFromCalldata(bytes32 policyHash, bytes calldata data) private view returns (uint256 amount) {
        if (data.length < 4) revert PolicyViolation(policyHash, "unmeterable calldata");
        bytes4 selector = bytes4(data[:4]);
        if (selector == _TRANSFER_SELECTOR) {
            if (data.length != 68) revert PolicyViolation(policyHash, "unmeterable calldata");
            address to;
            (to, amount) = abi.decode(data[4:], (address, uint256));
            _requireRecipientAllowlisted(policyHash, to);
            return amount;
        }
        if (selector == _TRANSFER_FROM_SELECTOR) {
            if (data.length != 100) revert PolicyViolation(policyHash, "unmeterable calldata");
            address to;
            (, to, amount) = abi.decode(data[4:], (address, address, uint256));
            _requireRecipientAllowlisted(policyHash, to);
            return amount;
        }
        revert PolicyViolation(policyHash, "unmeterable calldata");
    }

    function _requireRecipientAllowlisted(bytes32 policyHash, address to) private view {
        if (isBlockedContract[policyHash][to]) {
            revert PolicyViolation(policyHash, "blocked contract");
        }
        if (!isAllowedContract[policyHash][to]) {
            revert PolicyViolation(policyHash, "recipient not allowlisted");
        }
    }

    /// @dev Empty returndata is treated as success (USDT-style). A 32-byte `false` is a failed transfer.
    function _requireErc20Success(bytes32 policyHash, bytes calldata data, bytes memory ret) private pure {
        if (data.length < 4) return;
        bytes4 selector = bytes4(data[:4]);
        if (selector != _TRANSFER_SELECTOR && selector != _TRANSFER_FROM_SELECTOR) return;
        if (ret.length == 0) return;
        if (ret.length != 32 || !abi.decode(ret, (bool))) {
            revert PolicyViolation(policyHash, "execution failed");
        }
    }

    function _recoverAgent(
        Policy storage policy,
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 nonce,
        bytes32 entropyCommitment,
        bytes calldata signature,
        string calldata action
    ) private view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                AGENT_ACTION_TYPEHASH,
                policy.agent,
                keccak256(bytes(action)),
                target,
                value,
                keccak256(data),
                nonce,
                policy.validUntil,
                policyHash,
                entropyCommitment
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
        return _recover(digest, signature);
    }

    function _appendAudit(
        bytes32 policyHash,
        address agent,
        address target,
        uint256 value,
        uint256 nonce,
        bytes32 entropyCommitment,
        string calldata action
    ) private returns (bytes32 entryId) {
        bytes32 previousHash = lastAuditHash;
        uint256 sequence = ++auditSequence;
        bytes32 sessionId = policyHash;
        entryId = keccak256(
            abi.encode(
                previousHash,
                sequence,
                sessionId,
                keccak256(bytes(action)),
                policyHash,
                agent,
                target,
                value,
                nonce,
                entropyCommitment
            )
        );
        _auditEntries[entryId] = AuditEntry({
            previousHash: previousHash, entropyCommitment: entropyCommitment, sequence: sequence, sessionId: sessionId
        });
        lastAuditHash = entryId;
        emit AuditEntryLogged(entryId, sequence, sessionId, action);
    }

    function _hashStrings(string[] calldata items) private pure returns (bytes32) {
        bytes32[] memory hashed = new bytes32[](items.length);
        for (uint256 i; i < items.length; ++i) {
            hashed[i] = keccak256(bytes(items[i]));
        }
        return keccak256(abi.encode(hashed));
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        // EIP-2: reject high-s signatures (malleability).
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
    }
}
