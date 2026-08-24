// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {LegacyVRFAdapter} from "../src/adapters/LegacyVRFAdapter.sol";

/// @notice Deploys Delveworn on RISE Testnet behind the compatibility VRF adapter.
/// @dev RISE_VRF_COORDINATOR must point to the existing RISE VRF-style coordinator/provider contract.
contract DeployRiseTestnet is Script {
    function run() external returns (LegacyVRFAdapter adapter, Delveworn dungeon) {
        address upstreamCoordinator = vm.envAddress("RISE_VRF_COORDINATOR");
        require(upstreamCoordinator != address(0), "Invalid RISE VRF coordinator");

        vm.startBroadcast();

        adapter = new LegacyVRFAdapter(upstreamCoordinator);
        dungeon = new Delveworn(address(adapter));

        vm.stopBroadcast();

        console2.log("RISE upstream VRF coordinator:", upstreamCoordinator);
        console2.log("LegacyVRFAdapter:", address(adapter));
        console2.log("Delveworn:", address(dungeon));
    }
}
