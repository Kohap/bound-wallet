// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BoundWallet} from "../src/BoundWallet.sol";
import {MockRiskOracle} from "../src/mocks/MockRiskOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract BoundWalletTest is Test {
    event PolicyRegistered(
        bytes32 indexed policyHash, address indexed owner, address indexed agent, uint256 validUntil
    );
    event ActionExecuted(
        bytes32 indexed policyHash, address indexed agent, address target, uint256 value, bytes32 auditEntryId
    );
    event PolicyRevoked(bytes32 indexed policyHash, string reason);
    event AuditEntryLogged(bytes32 indexed entryId, uint256 sequence, bytes32 sessionId, string actionType);

    uint256 internal constant AGENT_ID = 1;
    uint8 internal constant MIN_SCORE = 20;
    bytes32 internal constant ENTROPY = keccak256("entropy-stub");

    BoundWallet internal wallet;
    MockRiskOracle internal oracle;
    MockERC20 internal token;

    address internal owner;
    address internal agent;
    uint256 internal agentPk;
    address internal recipient;
    address internal attacker;
    uint256 internal attackerPk;

    uint256 internal validAfter;
    uint256 internal validUntil;

    function setUp() public {
        (owner,) = makeAddrAndKey("owner");
        (agent, agentPk) = makeAddrAndKey("agent");
        recipient = makeAddr("recipient");
        (attacker, attackerPk) = makeAddrAndKey("attacker");

        vm.warp(1_700_000_000);
        validAfter = block.timestamp;
        validUntil = block.timestamp + 30 days;

        oracle = new MockRiskOracle();
        oracle.setScore(AGENT_ID, 5);

        vm.prank(owner);
        wallet = new BoundWallet(address(oracle));

        token = new MockERC20();
        token.mint(address(wallet), 1000 ether);
        vm.deal(address(wallet), 10 ether);
    }

    function test_registerPolicy_emitsAndStores() public {
        string[] memory actions = _actions("transfer");
        address[] memory allowed = _addrs(recipient, address(token));
        address[] memory blocked = new address[](0);

        vm.expectEmit(false, true, true, true, address(wallet));
        emit PolicyRegistered(bytes32(0), owner, agent, validUntil);

        vm.prank(owner);
        bytes32 policyHash = wallet.registerPolicy(
            agent, AGENT_ID, actions, allowed, blocked, 1 ether, 2 ether, validAfter, validUntil, MIN_SCORE
        );

        assertTrue(policyHash != bytes32(0));
        (address gotAgent, address gotOwner, uint256 maxTx, uint256 until, bool isActive) = wallet.getPolicy(policyHash);
        assertEq(gotAgent, agent);
        assertEq(gotOwner, owner);
        assertEq(maxTx, 1 ether);
        assertEq(until, validUntil);
        assertTrue(isActive);
        assertTrue(wallet.isAllowedAction(policyHash, keccak256("transfer")));
        assertTrue(wallet.isAllowedContract(policyHash, recipient));
        assertTrue(wallet.isAllowedContract(policyHash, address(token)));
        assertEq(wallet.policyCount(), 1);
    }

    function test_executeAction_transferWithinCap() public {
        bytes32 policyHash = _register(1 ether, 5 ether, validAfter, validUntil, _addrs(recipient, address(token)));

        uint256 ethAmount = 0.4 ether;
        vm.expectEmit(false, false, false, false, address(wallet));
        emit AuditEntryLogged(bytes32(0), 1, policyHash, "transfer");
        vm.expectEmit(true, true, false, false, address(wallet));
        emit ActionExecuted(policyHash, agent, recipient, ethAmount, bytes32(0));

        (bool ok, bytes32 auditId) = _execute(policyHash, recipient, ethAmount, bytes(""), 1, "transfer", agentPk);
        assertTrue(ok);
        assertTrue(auditId != bytes32(0));
        assertEq(recipient.balance, ethAmount);
        assertEq(address(wallet).balance, 10 ether - ethAmount);

        bytes memory erc20Data = abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 0.25 ether);
        (bool okToken, bytes32 tokenAudit) = _execute(policyHash, address(token), 0, erc20Data, 2, "transfer", agentPk);
        assertTrue(okToken);
        assertTrue(tokenAudit != bytes32(0));
        assertEq(token.balanceOf(recipient), 0.25 ether);
        assertEq(token.balanceOf(address(wallet)), 999.75 ether);
        assertEq(wallet.spentOnDay(policyHash, block.timestamp / 1 days), ethAmount + 0.25 ether);

        (bytes32 prev, bytes32 storedEntropy, uint256 seq,) = wallet.getAuditEntry(auditId);
        assertEq(prev, bytes32(0));
        assertEq(storedEntropy, ENTROPY);
        assertEq(seq, 1);
    }

    function test_executeAction_revertsOverMaxValuePerTx() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.ValueExceedsLimit.selector, 1 ether + 1, 1 ether),
            policyHash,
            recipient,
            1 ether + 1,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsDailyCap() public {
        bytes32 policyHash = _register(10 ether, 1.5 ether, validAfter, validUntil, _addrs(recipient));
        (bool ok,) = _execute(policyHash, recipient, 1 ether, bytes(""), 1, "transfer", agentPk);
        assertTrue(ok);

        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.ValueExceedsLimit.selector, 1 ether, 1.5 ether),
            policyHash,
            recipient,
            1 ether,
            bytes(""),
            2,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsBlockedContract() public {
        address[] memory allowed = _addrs(recipient);
        address[] memory blocked = _addrs(recipient);
        vm.prank(owner);
        bytes32 policyHash = wallet.registerPolicy(
            agent, AGENT_ID, _actions("transfer"), allowed, blocked, 1 ether, 0, validAfter, validUntil, MIN_SCORE
        );

        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "blocked contract"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsActionNotAllowed() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "action not allowed"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "swap",
            agentPk
        );
    }

    function test_executeAction_revertsNotAllowlisted() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "target not allowlisted"),
            policyHash,
            attacker,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsExpired() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        vm.warp(validUntil + 1);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyExpired.selector, policyHash, validUntil),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsBeforeValidAfter() public {
        uint256 later = block.timestamp + 1 days;
        bytes32 policyHash = _register(1 ether, 0, later, later + 7 days, _addrs(recipient));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "policy not yet valid"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsWrongAgent() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.InvalidSignature.selector, attacker, agent),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            attackerPk
        );
    }

    function test_executeAction_revertsReplayNonce() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        (bool ok,) = _execute(policyHash, recipient, 0.1 ether, bytes(""), 7, "transfer", agentPk);
        assertTrue(ok);

        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "nonce already used"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            7,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsHighRiskScore() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));
        oracle.setScore(AGENT_ID, MIN_SCORE + 1);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "risk score exceeds threshold"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_revokePolicy_thenExecuteFails() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));

        vm.expectEmit(true, false, false, true, address(wallet));
        emit PolicyRevoked(policyHash, "owner containment");
        vm.prank(owner);
        wallet.revokePolicy(policyHash, "owner containment");

        (,,,, bool isActive) = wallet.getPolicy(policyHash);
        assertFalse(isActive);

        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "policy inactive"),
            policyHash,
            recipient,
            0.1 ether,
            bytes(""),
            1,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsErc20OverMaxValuePerTx() public {
        bytes32 policyHash = _register(1 ether, 5 ether, validAfter, validUntil, _addrs(recipient, address(token)));
        bytes memory erc20Data = abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 1 ether + 1);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.ValueExceedsLimit.selector, 1 ether + 1, 1 ether),
            policyHash,
            address(token),
            0,
            erc20Data,
            1,
            "transfer",
            agentPk
        );
        assertEq(token.balanceOf(recipient), 0);
    }

    function test_executeAction_revertsErc20DailyCap() public {
        bytes32 policyHash = _register(10 ether, 1.5 ether, validAfter, validUntil, _addrs(recipient, address(token)));
        (bool ok,) = _execute(policyHash, recipient, 1 ether, bytes(""), 1, "transfer", agentPk);
        assertTrue(ok);

        bytes memory erc20Data = abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 1 ether);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.ValueExceedsLimit.selector, 1 ether, 1.5 ether),
            policyHash,
            address(token),
            0,
            erc20Data,
            2,
            "transfer",
            agentPk
        );
        assertEq(wallet.spentOnDay(policyHash, block.timestamp / 1 days), 1 ether);
    }

    function test_executeAction_erc20AndNativeShareTheSameMeters() public {
        bytes32 policyHash = _register(1 ether, 2 ether, validAfter, validUntil, _addrs(recipient, address(token)));
        (bool okEth,) = _execute(policyHash, recipient, 0.4 ether, bytes(""), 1, "transfer", agentPk);
        assertTrue(okEth);

        bytes memory erc20Data = abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 0.5 ether);
        (bool okToken,) = _execute(policyHash, address(token), 0, erc20Data, 2, "transfer", agentPk);
        assertTrue(okToken);
        assertEq(wallet.spentOnDay(policyHash, block.timestamp / 1 days), 0.9 ether);

        bytes memory overData = abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 0.7 ether);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.ValueExceedsLimit.selector, 1.1 ether, 1 ether),
            policyHash,
            address(token),
            0.4 ether,
            overData,
            3,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_revertsUnmeterableCalldata() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient, address(token)));
        bytes memory approveData = abi.encodeWithSelector(MockERC20.approve.selector, attacker, 100 ether);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "unmeterable calldata"),
            policyHash,
            address(token),
            0,
            approveData,
            1,
            "transfer",
            agentPk
        );

        bytes memory paddedTransfer =
            bytes.concat(abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 0.1 ether), bytes(hex"00"));
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "unmeterable calldata"),
            policyHash,
            address(token),
            0,
            paddedTransfer,
            2,
            "transfer",
            agentPk
        );
    }

    function test_executeAction_transferFromMetersAmount() public {
        bytes32 policyHash = _register(1 ether, 2 ether, validAfter, validUntil, _addrs(recipient, address(token)));
        token.mint(attacker, 10 ether);
        vm.prank(attacker);
        token.approve(address(wallet), 10 ether);

        bytes memory data = abi.encodeWithSelector(MockERC20.transferFrom.selector, attacker, recipient, 0.3 ether);
        (bool ok,) = _execute(policyHash, address(token), 0, data, 1, "transfer", agentPk);
        assertTrue(ok);
        assertEq(token.balanceOf(recipient), 0.3 ether);
        assertEq(wallet.spentOnDay(policyHash, block.timestamp / 1 days), 0.3 ether);
    }

    function test_executeAction_revertsErc20RecipientNotAllowlisted() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient, address(token)));
        bytes memory erc20Data = abi.encodeWithSelector(MockERC20.transfer.selector, attacker, 0.1 ether);
        _expectRevertExecute(
            abi.encodeWithSelector(BoundWallet.PolicyViolation.selector, policyHash, "recipient not allowlisted"),
            policyHash,
            address(token),
            0,
            erc20Data,
            1,
            "transfer",
            agentPk
        );
        assertEq(token.balanceOf(attacker), 0);
    }

    function test_auditChain_linksPreviousHash() public {
        bytes32 policyHash = _register(1 ether, 0, validAfter, validUntil, _addrs(recipient));

        (bool ok1, bytes32 id1) = _execute(policyHash, recipient, 0.1 ether, bytes(""), 1, "transfer", agentPk);
        (bool ok2, bytes32 id2) = _execute(policyHash, recipient, 0.2 ether, bytes(""), 2, "transfer", agentPk);
        assertTrue(ok1 && ok2);
        assertTrue(id1 != id2);

        (bytes32 prev1, bytes32 entropy1, uint256 seq1, bytes32 session1) = wallet.getAuditEntry(id1);
        (bytes32 prev2, bytes32 entropy2, uint256 seq2, bytes32 session2) = wallet.getAuditEntry(id2);

        assertEq(seq1, 1);
        assertEq(seq2, 2);
        assertEq(prev1, bytes32(0));
        assertEq(prev2, id1);
        assertEq(session1, policyHash);
        assertEq(session2, policyHash);
        assertEq(entropy1, ENTROPY);
        assertEq(entropy2, ENTROPY);
        assertEq(wallet.lastAuditHash(), id2);
        assertEq(wallet.auditSequence(), 2);
    }

    function _register(uint256 maxTx, uint256 maxDay, uint256 afterTs, uint256 untilTs, address[] memory allowed)
        internal
        returns (bytes32)
    {
        vm.prank(owner);
        return wallet.registerPolicy(
            agent, AGENT_ID, _actions("transfer"), allowed, new address[](0), maxTx, maxDay, afterTs, untilTs, MIN_SCORE
        );
    }

    function _execute(
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes memory data,
        uint256 nonce,
        string memory action,
        uint256 pk
    ) internal returns (bool, bytes32) {
        bytes memory sig = _makeSig(policyHash, target, value, data, nonce, action, pk);
        return wallet.executeAction(policyHash, target, value, data, nonce, ENTROPY, sig, action);
    }

    function _expectRevertExecute(
        bytes memory revertData,
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes memory data,
        uint256 nonce,
        string memory action,
        uint256 pk
    ) internal {
        bytes memory sig = _makeSig(policyHash, target, value, data, nonce, action, pk);
        vm.expectRevert(revertData);
        wallet.executeAction(policyHash, target, value, data, nonce, ENTROPY, sig, action);
    }

    function _makeSig(
        bytes32 policyHash,
        address target,
        uint256 value,
        bytes memory data,
        uint256 nonce,
        string memory action,
        uint256 pk
    ) internal view returns (bytes memory) {
        (address policyAgent,,, uint256 until,) = wallet.getPolicy(policyHash);
        return _sign(pk, policyAgent, action, target, value, data, nonce, until, policyHash, ENTROPY);
    }

    function _sign(
        uint256 pk,
        address agent_,
        string memory action,
        address target,
        uint256 value,
        bytes memory data,
        uint256 nonce,
        uint256 until,
        bytes32 policyHash,
        bytes32 entropyCommitment
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                wallet.AGENT_ACTION_TYPEHASH(),
                agent_,
                keccak256(bytes(action)),
                target,
                value,
                keccak256(data),
                nonce,
                until,
                policyHash,
                entropyCommitment
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", wallet.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _actions(string memory action) internal pure returns (string[] memory list) {
        list = new string[](1);
        list[0] = action;
    }

    function _addrs(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _addrs(address a, address b) internal pure returns (address[] memory list) {
        list = new address[](2);
        list[0] = a;
        list[1] = b;
    }
}
