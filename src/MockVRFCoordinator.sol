// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVRFCoordinator, IVRFConsumer} from "./Delveworn.sol";

contract MockVRFCoordinator is IVRFCoordinator {
    uint256 public nextRequestId = 1;

    mapping(uint256 => address) public requestConsumers;

    mapping(uint256 => uint32) public requestedNumberCount;

    event MockRandomnessRequested(
        uint256 indexed requestId, address indexed consumer, uint32 numberCount, uint256 seed
    );

    event MockRandomnessFulfilled(uint256 indexed requestId, address indexed consumer);

    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external override returns (uint256 requestId) {
        require(numNumbers > 0, "Must request numbers");

        requestId = nextRequestId++;

        requestConsumers[requestId] = msg.sender;

        requestedNumberCount[requestId] = numNumbers;

        emit MockRandomnessRequested(requestId, msg.sender, numNumbers, seed);
    }

    function fulfill(uint256 requestId, uint256[] calldata randomNumbers) external {
        address consumer = requestConsumers[requestId];

        require(consumer != address(0), "Unknown request");

        require(randomNumbers.length == requestedNumberCount[requestId], "Wrong number count");

        uint256[] memory numbers = new uint256[](randomNumbers.length);

        for (uint256 i = 0; i < randomNumbers.length; i++) {
            numbers[i] = randomNumbers[i];
        }

        /*
            Clear state before the
            external callback.
        */

        delete requestConsumers[requestId];

        delete requestedNumberCount[requestId];

        IVRFConsumer(consumer).rawFulfillRandomNumbers(requestId, numbers);

        emit MockRandomnessFulfilled(requestId, consumer);
    }
}
