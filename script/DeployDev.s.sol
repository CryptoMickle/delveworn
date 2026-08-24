// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {DevRandomnessAdapter} from "../src/adapters/DevRandomnessAdapter.sol";

/// @notice Deploys Delveworn with deterministic, dependency-free randomness for local development.
/// @dev DEV/TEST ONLY. Do not use DevRandomnessAdapter for production or public competitive deployments.
contract DeployDev is Script {
    function run() external returns (DevRandomnessAdapter adapter, Delveworn dungeon) {
        vm.startBroadcast();

        adapter = new DevRandomnessAdapter();
        dungeon = new Delveworn(address(adapter));
        adapter.setConsumer(address(dungeon));

        vm.stopBroadcast();
    }
}
