// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Delveworn} from "../src/Delveworn.sol";

/// @notice Deploys Delveworn directly against the RISE Testnet VRF coordinator.
/// @dev The RISE coordinator already satisfies Delveworn's provider-neutral randomness interface.
contract DeployRiseTestnet is Script {
    function run() external returns (Delveworn dungeon) {
        address riseCoordinator = vm.envAddress("RISE_VRF_COORDINATOR");
        require(riseCoordinator != address(0), "Invalid RISE VRF coordinator");

        vm.startBroadcast();

        dungeon = new Delveworn(riseCoordinator);

        vm.stopBroadcast();

        console2.log("RISE VRF coordinator:", riseCoordinator);
        console2.log("Delveworn:", address(dungeon));
    }
}
