// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {RiseDungeon} from "../src/RiseDungeon.sol";
import {ChainlinkV25DirectFundingAdapter} from "../src/adapters/ChainlinkV25DirectFundingAdapter.sol";

contract DeploySomniaShannon is Script {
    address internal constant DEFAULT_VRF_WRAPPER = 0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2;

    function run()
        external
        returns (ChainlinkV25DirectFundingAdapter adapter, RiseDungeon dungeon)
    {
        address wrapper = vm.envOr("SOMNIA_SHANNON_VRF_WRAPPER", DEFAULT_VRF_WRAPPER);
        uint32 callbackGasLimit = uint32(vm.envOr("SOMNIA_VRF_CALLBACK_GAS_LIMIT", uint256(500_000)));
        uint16 requestConfirmations = uint16(vm.envOr("SOMNIA_VRF_REQUEST_CONFIRMATIONS", uint256(3)));
        uint256 prefundWei = vm.envOr("SOMNIA_VRF_PREFUND_WEI", uint256(0));

        vm.startBroadcast();

        adapter = new ChainlinkV25DirectFundingAdapter(
            wrapper,
            callbackGasLimit,
            requestConfirmations
        );

        dungeon = new RiseDungeon(address(adapter));
        adapter.setConsumer(address(dungeon));

        if (prefundWei > 0) {
            (bool success,) = address(adapter).call{value: prefundWei}("");
            require(success, "Adapter prefund failed");
        }

        vm.stopBroadcast();
    }
}
