// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {SomniaNativeVRFAdapter} from "../src/adapters/SomniaNativeVRFAdapter.sol";

contract DeploySomniaShannon is Script {
    address internal constant DEFAULT_VRF_COORDINATOR = 0x0834459256bBB8D2EFEe23dc6C3F1722266182dD;
    uint256 internal constant MAX_CALLBACK_GAS_LIMIT = 2_500_000;
    uint256 internal constant MIN_COMMIT_DELAY_BLOCKS = 16;
    uint256 internal constant MAX_COMMIT_DELAY_BLOCKS = 200;

    function run() external returns (SomniaNativeVRFAdapter adapter, Delveworn dungeon) {
        address coordinator = vm.envOr("SOMNIA_SHANNON_VRF_COORDINATOR", DEFAULT_VRF_COORDINATOR);
        uint256 callbackGasLimitValue = vm.envOr("SOMNIA_VRF_CALLBACK_GAS_LIMIT", uint256(2_500_000));
        uint256 commitDelayBlocksValue = vm.envOr("SOMNIA_VRF_COMMIT_DELAY_BLOCKS", uint256(16));

        require(coordinator != address(0), "Invalid Somnia VRF coordinator");
        require(
            callbackGasLimitValue > 0 && callbackGasLimitValue <= MAX_CALLBACK_GAS_LIMIT, "Invalid callback gas limit"
        );
        require(
            commitDelayBlocksValue >= MIN_COMMIT_DELAY_BLOCKS && commitDelayBlocksValue <= MAX_COMMIT_DELAY_BLOCKS,
            "Invalid commit delay"
        );

        uint32 callbackGasLimit = uint32(callbackGasLimitValue);
        uint16 commitDelayBlocks = uint16(commitDelayBlocksValue);

        vm.startBroadcast();

        adapter = new SomniaNativeVRFAdapter(coordinator, callbackGasLimit, commitDelayBlocks);

        dungeon = new Delveworn(address(adapter));
        adapter.setConsumer(address(dungeon));

        vm.stopBroadcast();

        console2.log("Somnia native VRF coordinator:", coordinator);
        console2.log("Somnia native VRF adapter:", address(adapter));
        console2.log("Delveworn:", address(dungeon));
        console2.log("Callback gas limit:", callbackGasLimit);
        console2.log("Commit delay blocks:", commitDelayBlocks);
    }
}
