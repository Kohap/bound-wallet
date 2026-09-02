// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

/// @notice Minimal ERC-8126-shaped risk oracle used by Bound Wallet hour-1 tests.
interface IRiskOracle {
    function getLatestRiskScore(uint256 agentId) external view returns (uint8);
}

contract MockRiskOracle is IRiskOracle {
    mapping(uint256 => uint8) private _score;

    function setScore(uint256 agentId, uint8 score) external {
        _score[agentId] = score;
    }

    function getLatestRiskScore(uint256 agentId) external view returns (uint8) {
        return _score[agentId];
    }
}
