// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkV25DirectFundingAdapter} from "../src/adapters/ChainlinkV25DirectFundingAdapter.sol";

contract MockChainlinkV25Wrapper {
    uint256 public price = 0.01 ether;
    uint256 public nextRequestId = 1;

    uint32 public lastCallbackGasLimit;
    uint16 public lastRequestConfirmations;
    uint32 public lastNumWords;
    bytes public lastExtraArgs;
    uint256 public lastPayment;

    function calculateRequestPriceNative(uint32, uint32) external view returns (uint256) {
        return price;
    }

    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes calldata extraArgs
    ) external payable returns (uint256 requestId) {
        require(msg.value == price, "wrong payment");

        lastCallbackGasLimit = callbackGasLimit;
        lastRequestConfirmations = requestConfirmations;
        lastNumWords = numWords;
        lastExtraArgs = extraArgs;
        lastPayment = msg.value;

        requestId = nextRequestId++;
    }

    function fulfill(address adapter, uint256 requestId, uint256[] calldata randomWords) external {
        ChainlinkV25DirectFundingAdapter(payable(adapter)).rawFulfillRandomWords(requestId, randomWords);
    }
}

contract ChainlinkV25DirectFundingAdapterTest is Test {
    MockChainlinkV25Wrapper internal wrapper;
    ChainlinkV25DirectFundingAdapter internal adapter;

    uint256 internal fulfilledRequestId;
    uint256[] internal fulfilledWords;

    function setUp() public {
        wrapper = new MockChainlinkV25Wrapper();
        adapter = new ChainlinkV25DirectFundingAdapter(address(wrapper), 500_000, 3);
        adapter.setConsumer(address(this));
        vm.deal(address(adapter), 1 ether);
    }

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(adapter), "only adapter");
        fulfilledRequestId = requestId;
        fulfilledWords = randomWords;
    }

    function testRequestUsesNativeWrapperAndTracksPendingRequest() public {
        uint256 requestId = adapter.requestRandomNumbers(3, 12345);

        assertEq(requestId, 1);
        assertTrue(adapter.pendingRequests(requestId));
        assertEq(wrapper.lastCallbackGasLimit(), 500_000);
        assertEq(wrapper.lastRequestConfirmations(), 3);
        assertEq(wrapper.lastNumWords(), 3);
        assertEq(wrapper.lastPayment(), 0.01 ether);
        assertEq(address(adapter).balance, 0.99 ether);
        assertGt(wrapper.lastExtraArgs().length, 4);
    }

    function testWrapperFulfillmentForwardsToConsumer() public {
        uint256 requestId = adapter.requestRandomNumbers(2, 0);

        uint256[] memory words = new uint256[](2);
        words[0] = 111;
        words[1] = 222;

        wrapper.fulfill(address(adapter), requestId, words);

        assertFalse(adapter.pendingRequests(requestId));
        assertEq(fulfilledRequestId, requestId);
        assertEq(fulfilledWords.length, 2);
        assertEq(fulfilledWords[0], 111);
        assertEq(fulfilledWords[1], 222);
    }

    function testOnlyConfiguredConsumerCanRequest() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(ChainlinkV25DirectFundingAdapter.OnlyConsumer.selector);
        adapter.requestRandomNumbers(1, 0);
    }

    function testRequestRevertsWhenAdapterBalanceIsInsufficient() public {
        vm.deal(address(adapter), 0);

        vm.expectRevert(
            abi.encodeWithSelector(ChainlinkV25DirectFundingAdapter.InsufficientAdapterBalance.selector, 0.01 ether, 0)
        );
        adapter.requestRandomNumbers(1, 0);
    }

    function testOnlyWrapperCanFulfill() public {
        uint256 requestId = adapter.requestRandomNumbers(1, 0);
        uint256[] memory words = new uint256[](1);
        words[0] = 1;

        vm.expectRevert(ChainlinkV25DirectFundingAdapter.OnlyWrapper.selector);
        adapter.rawFulfillRandomWords(requestId, words);
    }

    function testConsumerCanOnlyBeSetOnce() public {
        vm.expectRevert(ChainlinkV25DirectFundingAdapter.ConsumerAlreadySet.selector);
        adapter.setConsumer(address(0xBEEF));
    }
}
