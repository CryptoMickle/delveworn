// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVRFCoordinatorProbe {
    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external returns (uint256 requestId);
}

interface IVRFConsumerProbe {
    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external;
}

contract VRFProbe is IVRFConsumerProbe {
    IVRFCoordinatorProbe public immutable coordinator;

    uint256 public pendingRequestId;
    uint256 public lastRequestedAt;
    uint256 public lastFulfilledAt;
    uint256 public lastFulfilledRequestId;
    uint256 public lastRandomNumber;

    event ProbeRequested(uint256 indexed requestId, uint256 requestedAt);
    event ProbeFulfilled(uint256 indexed requestId, uint256 requestedAt, uint256 fulfilledAt, uint256 randomNumber);

    constructor(address coordinatorAddress) {
        require(coordinatorAddress != address(0), "Zero coordinator");
        coordinator = IVRFCoordinatorProbe(coordinatorAddress);
    }

    function request() external returns (uint256 requestId) {
        require(pendingRequestId == 0, "Request already pending");

        uint256 seed = uint256(keccak256(abi.encode(address(this), msg.sender, block.timestamp, block.number)));

        requestId = coordinator.requestRandomNumbers(1, seed);

        pendingRequestId = requestId;
        lastRequestedAt = block.timestamp;

        emit ProbeRequested(requestId, block.timestamp);
    }

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external override {
        require(msg.sender == address(coordinator), "Only coordinator");
        require(requestId == pendingRequestId, "Request mismatch");
        require(randomNumbers.length == 1, "Wrong number count");

        lastFulfilledRequestId = requestId;
        lastRandomNumber = randomNumbers[0];
        lastFulfilledAt = block.timestamp;
        pendingRequestId = 0;

        emit ProbeFulfilled(requestId, lastRequestedAt, block.timestamp, randomNumbers[0]);
    }
}
