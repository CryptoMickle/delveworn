// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {DevRandomnessAdapter} from "../src/adapters/DevRandomnessAdapter.sol";

contract DevRandomnessAdapterTest is Test {
    DevRandomnessAdapter internal adapter;

    uint256 internal fulfilledRequestId;
    uint256[] internal fulfilledWords;

    function setUp() public {
        adapter = new DevRandomnessAdapter();
        adapter.setConsumer(address(this));
    }

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(adapter), "only adapter");
        fulfilledRequestId = requestId;
        fulfilledWords = randomWords;
    }

    function testRequestTracksSeedAndNumberCount() public {
        uint256 requestId = adapter.requestRandomNumbers(3, 12345);

        assertEq(requestId, 1);
        assertTrue(adapter.pendingRequests(requestId));

        (uint32 numberCount, uint256 seed, bool pending) = adapter.requests(requestId);
        assertEq(numberCount, 3);
        assertEq(seed, 12345);
        assertTrue(pending);
    }

    function testDeterministicFulfillmentClearsRequestAndForwardsWords() public {
        uint256 requestId = adapter.requestRandomNumbers(2, 777);

        uint256 expected0 = uint256(keccak256(abi.encode(uint256(777), requestId, uint256(0))));
        uint256 expected1 = uint256(keccak256(abi.encode(uint256(777), requestId, uint256(1))));

        uint256[] memory returnedWords = adapter.fulfill(requestId);

        assertFalse(adapter.pendingRequests(requestId));
        assertEq(fulfilledRequestId, requestId);
        assertEq(fulfilledWords.length, 2);
        assertEq(fulfilledWords[0], expected0);
        assertEq(fulfilledWords[1], expected1);
        assertEq(returnedWords[0], expected0);
        assertEq(returnedWords[1], expected1);
    }

    function testExplicitWordsSupportExactScenarioReproduction() public {
        uint256 requestId = adapter.requestRandomNumbers(3, 0);

        uint256[] memory words = new uint256[](3);
        words[0] = 11;
        words[1] = 22;
        words[2] = 33;

        adapter.fulfillWithWords(requestId, words);

        assertFalse(adapter.pendingRequests(requestId));
        assertEq(fulfilledRequestId, requestId);
        assertEq(fulfilledWords[0], 11);
        assertEq(fulfilledWords[1], 22);
        assertEq(fulfilledWords[2], 33);
    }

    function testOnlyConfiguredConsumerCanRequest() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DevRandomnessAdapter.OnlyConsumer.selector);
        adapter.requestRandomNumbers(1, 0);
    }

    function testOnlyOwnerCanFulfill() public {
        uint256 requestId = adapter.requestRandomNumbers(1, 0);

        vm.prank(address(0xBEEF));
        vm.expectRevert(DevRandomnessAdapter.OnlyOwner.selector);
        adapter.fulfill(requestId);
    }

    function testWrongExplicitWordCountRevertsWithoutConsumingRequest() public {
        uint256 requestId = adapter.requestRandomNumbers(2, 0);
        uint256[] memory words = new uint256[](1);
        words[0] = 1;

        vm.expectRevert(abi.encodeWithSelector(DevRandomnessAdapter.WrongNumberCount.selector, 2, 1));
        adapter.fulfillWithWords(requestId, words);

        assertTrue(adapter.pendingRequests(requestId));
    }

    function testConsumerCanOnlyBeSetOnce() public {
        vm.expectRevert(DevRandomnessAdapter.ConsumerAlreadySet.selector);
        adapter.setConsumer(address(0xBEEF));
    }
}

contract DevRandomnessAdapterIntegrationTest is Test {
    DevRandomnessAdapter internal adapter;
    Delveworn internal dungeon;

    address internal player = address(0xA11CE);

    function setUp() public {
        adapter = new DevRandomnessAdapter();
        dungeon = new Delveworn(address(adapter));
        adapter.setConsumer(address(dungeon));
    }

    function testTwoPhaseFulfillmentAdvancesRealDelvewornRun() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);
        assertGt(requestId, 0);
        assertTrue(adapter.pendingRequests(requestId));

        adapter.fulfill(requestId);

        assertEq(dungeon.pendingRequestId(player), 0);
        assertFalse(adapter.pendingRequests(requestId));

        Delveworn.Player memory state = dungeon.getPlayer(player);
        assertTrue(state.active);
        assertEq(state.roomsCleared, 0);
        assertGt(state.monsterHp, 0);
    }
}
