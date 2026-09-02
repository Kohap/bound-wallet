// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

/// @notice Minimal ERC-8126-shaped risk oracle used by Bound Wallet hour-1 tests.
interface IRiskOracle {
    function getLatestRiskScore(uint256 agentId) external view returns (uint8);
    function hasScore(uint256 agentId) external view returns (bool);
}

contract MockRiskOracle is IRiskOracle {
    address public immutable owner;
    mapping(uint256 => uint8) private _score;
    mapping(uint256 => bool) private _set;

    error NotOwner();

    constructor() {
        owner = msg.sender;
    }

    function setScore(uint256 agentId, uint8 score) external {
        if (msg.sender != owner) revert NotOwner();
        _score[agentId] = score;
        _set[agentId] = true;
    }

    function hasScore(uint256 agentId) external view returns (bool) {
        return _set[agentId];
    }

    function getLatestRiskScore(uint256 agentId) external view returns (uint8) {
        return _score[agentId];
    }
}
