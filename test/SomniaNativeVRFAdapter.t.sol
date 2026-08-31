// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {SomniaNativeVRFAdapter} from "../src/adapters/SomniaNativeVRFAdapter.sol";
import {ISomniaVRFCoordinator} from "../src/interfaces/ISomniaVRFCoordinator.sol";

contract MockSomniaVRFCoordinator is ISomniaVRFCoordinator {
    uint256 public nextRequestId = 1;

    address public lastRequester;
    RandomWordsRequest public lastRequest;

    mapping(uint256 => RandomWordsRequest) internal requests;

    function requestRandomWords(RandomWordsRequest calldata request) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        lastRequester = msg.sender;
        lastRequest = request;
        requests[requestId] = request;
    }

    function fulfill(address adapter, uint256 requestId, uint256[] memory randomWords) external {
        SomniaNativeVRFAdapter(adapter).rawFulfillRandomWords(requestId, randomWords);
    }

    function fulfillWithConfiguredGas(address adapter, uint256 requestId, uint256[] memory randomWords)
        external
        returns (bool success, uint256 gasUsed, bytes memory returnData)
    {
        uint256 gasBefore = gasleft();
        (success, returnData) = adapter.call{gas: requests[requestId].callbackGasLimit}(
            abi.encodeCall(SomniaNativeVRFAdapter.rawFulfillRandomWords, (requestId, randomWords))
        );
        gasUsed = gasBefore - gasleft();
    }
}

contract SomniaNativeVRFAdapterTest is Test {
    MockSomniaVRFCoordinator internal coordinator;
    SomniaNativeVRFAdapter internal adapter;

    uint256 internal fulfilledRequestId;
    uint256[] internal fulfilledWords;

    function setUp() public {
        coordinator = new MockSomniaVRFCoordinator();
        adapter = new SomniaNativeVRFAdapter(address(coordinator), 2_500_000, 16);
        adapter.setConsumer(address(this));
    }

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(adapter), "only adapter");
        fulfilledRequestId = requestId;
        fulfilledWords = randomWords;
    }

    function testRequestUsesVerifiableSomniaConfigAndTracksPendingRequest() public {
        uint256 requestId = adapter.requestRandomNumbers(5, 12345);

        assertEq(requestId, 1);
        assertTrue(adapter.pendingRequests(requestId));
        assertEq(coordinator.lastRequester(), address(adapter));

        (uint32 callbackGasLimit, uint16 commitDelayBlocks, uint32 numWords, bool useVerifiableEntropy) =
            coordinator.lastRequest();

        assertEq(callbackGasLimit, 2_500_000);
        assertEq(commitDelayBlocks, 16);
        assertEq(numWords, 5);
        assertTrue(useVerifiableEntropy);
    }

    function testCoordinatorFulfillmentForwardsToConsumer() public {
        uint256 requestId = adapter.requestRandomNumbers(2, 0);

        uint256[] memory words = new uint256[](2);
        words[0] = 111;
        words[1] = 222;

        coordinator.fulfill(address(adapter), requestId, words);

        assertFalse(adapter.pendingRequests(requestId));
        assertEq(fulfilledRequestId, requestId);
        assertEq(fulfilledWords.length, 2);
        assertEq(fulfilledWords[0], 111);
        assertEq(fulfilledWords[1], 222);
    }

    function testOnlyConfiguredConsumerCanRequest() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(SomniaNativeVRFAdapter.OnlyConsumer.selector);
        adapter.requestRandomNumbers(1, 0);
    }

    function testRejectsInvalidNumberCounts() public {
        vm.expectRevert(SomniaNativeVRFAdapter.InvalidNumberCount.selector);
        adapter.requestRandomNumbers(0, 0);

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidNumberCount.selector);
        adapter.requestRandomNumbers(501, 0);
    }

    function testOnlyCoordinatorCanFulfill() public {
        uint256 requestId = adapter.requestRandomNumbers(1, 0);
        uint256[] memory words = _one(1);

        vm.expectRevert(SomniaNativeVRFAdapter.OnlyCoordinator.selector);
        adapter.rawFulfillRandomWords(requestId, words);
    }

    function testConsumerCanOnlyBeSetOnce() public {
        vm.expectRevert(SomniaNativeVRFAdapter.ConsumerAlreadySet.selector);
        adapter.setConsumer(address(0xBEEF));
    }

    function testOnlyOwnerCanSetConsumer() public {
        SomniaNativeVRFAdapter unconfigured = new SomniaNativeVRFAdapter(address(coordinator), 2_500_000, 16);

        vm.prank(address(0xBEEF));
        vm.expectRevert(SomniaNativeVRFAdapter.OnlyOwner.selector);
        unconfigured.setConsumer(address(this));
    }

    function testRejectsZeroAddresses() public {
        vm.expectRevert(SomniaNativeVRFAdapter.InvalidAddress.selector);
        new SomniaNativeVRFAdapter(address(0), 2_500_000, 16);

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidAddress.selector);
        new SomniaNativeVRFAdapter(address(0xBEEF), 2_500_000, 16);

        SomniaNativeVRFAdapter unconfigured = new SomniaNativeVRFAdapter(address(coordinator), 2_500_000, 16);
        vm.expectRevert(SomniaNativeVRFAdapter.InvalidAddress.selector);
        unconfigured.setConsumer(address(0));

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidAddress.selector);
        unconfigured.setConsumer(address(0xBEEF));
    }

    function testConstructorRejectsProviderValuesOutsideNativeBounds() public {
        vm.expectRevert(SomniaNativeVRFAdapter.InvalidConfig.selector);
        new SomniaNativeVRFAdapter(address(coordinator), 0, 16);

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidConfig.selector);
        new SomniaNativeVRFAdapter(address(coordinator), 2_500_001, 16);

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidConfig.selector);
        new SomniaNativeVRFAdapter(address(coordinator), 2_500_000, 15);

        vm.expectRevert(SomniaNativeVRFAdapter.InvalidConfig.selector);
        new SomniaNativeVRFAdapter(address(coordinator), 2_500_000, 201);
    }

    function _one(uint256 value) internal pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = value;
    }
}

contract SomniaNativeVRFDelvewornIntegrationTest is Test {
    uint32 internal constant CALLBACK_GAS_LIMIT = 2_500_000;

    address internal player = address(0xA11CE);

    MockSomniaVRFCoordinator internal coordinator;
    SomniaNativeVRFAdapter internal adapter;
    Delveworn internal dungeon;

    function setUp() public {
        coordinator = new MockSomniaVRFCoordinator();
        adapter = new SomniaNativeVRFAdapter(address(coordinator), CALLBACK_GAS_LIMIT, 16);
        dungeon = new Delveworn(address(adapter));
        adapter.setConsumer(address(dungeon));
    }

    function testMonsterCallbackCompletesThroughNativeGasLimit() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);
        (bool success, uint256 gasUsed,) = coordinator.fulfillWithConfiguredGas(address(adapter), requestId, _one(42));

        assertTrue(success);
        assertLt(gasUsed, CALLBACK_GAS_LIMIT);
        assertEq(dungeon.pendingRequestId(player), 0);
        assertGt(dungeon.getPlayer(player).monsterHp, 0);
    }

    function testBossRelicCallbackCompletesThroughNativeGasLimit() public {
        _startWithMonster();

        for (uint256 room = 1; room <= 9; room++) {
            _killCurrentMonsterWithArmorLoot();

            if (room < 9) {
                vm.prank(player);
                dungeon.enterNextRoom();
                _fulfillCurrent(_one(0));
            }
        }

        assertTrue(dungeon.campAvailable(player));

        vm.prank(player);
        dungeon.enterNextRoom();
        _fulfillCurrent(_one(0));

        while (dungeon.getPlayer(player).monsterHp > 24) {
            _attackAndFulfill(_five(4, 0, 0, 95, 99_999));
        }

        vm.prank(player);
        dungeon.attack();

        uint256 finalRequestId = dungeon.pendingRequestId(player);
        (bool success, uint256 gasUsed,) =
            coordinator.fulfillWithConfiguredGas(address(adapter), finalRequestId, _five(4, 0, 0, 95, 99_999));

        assertTrue(success);
        assertLt(gasUsed, CALLBACK_GAS_LIMIT);
        assertEq(dungeon.pendingRequestId(player), 0);
        assertEq(dungeon.getPlayer(player).roomsCleared, 10);
        assertTrue(dungeon.relicOfferAvailable(player));
    }

    function testTimedOutNativeRequestCanBeRetriedAndFulfilled() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 abandonedRequestId = dungeon.pendingRequestId(player);
        uint256 requestedAt = dungeon.pendingRequestTimestamp(player);
        vm.warp(requestedAt + dungeon.VRF_TIMEOUT());

        vm.prank(player);
        uint256 retryRequestId = dungeon.retryRandomness();

        assertGt(retryRequestId, abandonedRequestId);
        assertEq(dungeon.pendingRequestId(player), retryRequestId);
        assertTrue(adapter.pendingRequests(abandonedRequestId));
        assertTrue(adapter.pendingRequests(retryRequestId));

        (bool success, uint256 gasUsed,) =
            coordinator.fulfillWithConfiguredGas(address(adapter), retryRequestId, _one(42));

        assertTrue(success);
        assertLt(gasUsed, CALLBACK_GAS_LIMIT);
        assertFalse(adapter.pendingRequests(retryRequestId));
        assertEq(dungeon.pendingRequestId(player), 0);
        assertGt(dungeon.getPlayer(player).monsterHp, 0);

        (bool staleSuccess,,) = coordinator.fulfillWithConfiguredGas(address(adapter), abandonedRequestId, _one(99));
        assertFalse(staleSuccess);
        assertTrue(adapter.pendingRequests(abandonedRequestId));
    }

    function _startWithMonster() internal {
        vm.prank(player);
        dungeon.startGame();
        _fulfillCurrent(_one(0));
    }

    function _killCurrentMonsterWithArmorLoot() internal {
        while (dungeon.getPlayer(player).monsterHp > 0) {
            _attackAndFulfill(_five(2, 0, 0, 95, 0));
        }
    }

    function _attackAndFulfill(uint256[] memory words) internal {
        vm.prank(player);
        dungeon.attack();
        _fulfillCurrent(words);
    }

    function _fulfillCurrent(uint256[] memory words) internal {
        uint256 requestId = dungeon.pendingRequestId(player);
        assertGt(requestId, 0);
        coordinator.fulfill(address(adapter), requestId, words);
    }

    function _one(uint256 value) internal pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = value;
    }

    function _five(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        internal
        pure
        returns (uint256[] memory words)
    {
        words = new uint256[](5);
        words[0] = a;
        words[1] = b;
        words[2] = c;
        words[3] = d;
        words[4] = e;
    }
}
