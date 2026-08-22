// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {RiseDungeon} from "../src/RiseDungeon.sol";
import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";
import {LegacyVRFAdapter} from "../src/adapters/LegacyVRFAdapter.sol";

contract LegacyVRFAdapterTest is Test {
    RiseDungeon dungeon;
    MockVRFCoordinator upstream;
    LegacyVRFAdapter adapter;

    address player = address(0xBEEF);

    function setUp() public {
        upstream = new MockVRFCoordinator();
        adapter = new LegacyVRFAdapter(address(upstream));
        dungeon = new RiseDungeon(address(adapter));
    }

    function testRoutesRequestAndFulfillmentThroughAdapter() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);

        assertGt(requestId, 0);
        assertEq(adapter.requestConsumers(requestId), address(dungeon));
        assertEq(upstream.requestConsumers(requestId), address(adapter));

        uint256[] memory numbers = new uint256[](1);
        numbers[0] = 7;
        upstream.fulfill(requestId, numbers);

        assertEq(dungeon.pendingRequestId(player), 0);
        assertEq(adapter.requestConsumers(requestId), address(0));

        RiseDungeon.Player memory p = dungeon.getPlayer(player);
        assertGt(p.monsterHp, 0);
    }

    function testRejectsDirectFulfillment() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);
        uint256[] memory numbers = new uint256[](1);
        numbers[0] = 1;

        vm.expectRevert("Only upstream coordinator");
        adapter.rawFulfillRandomNumbers(requestId, numbers);
    }
}
