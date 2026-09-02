// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BoundWallet} from "../src/BoundWallet.sol";
import {MockRiskOracle} from "../src/mocks/MockRiskOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Anvil-only deploy for the Bound Wallet permission UI (hour 2).
contract Deploy is Script {
    function run() external {
        uint256 fundWallet = 10 ether;

        vm.startBroadcast();

        MockRiskOracle oracle = new MockRiskOracle();
        BoundWallet wallet = new BoundWallet(address(oracle));
        MockERC20 token = new MockERC20();

        oracle.setScore(1, 5);
        token.mint(address(wallet), 1000 ether);
        (bool funded,) = address(wallet).call{value: fundWallet}("");
        require(funded, "fund wallet");

        vm.stopBroadcast();

        console.log("ORACLE", address(oracle));
        console.log("WALLET", address(wallet));
        console.log("TOKEN", address(token));
    }
}
