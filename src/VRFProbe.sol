// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVRFCoordinatorProbe {
    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 seed
    ) external returns (uint256 requestId);
}

interface IVRFConsumerProbe {
    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external;
}

contract VRFProbe is IVRFConsumerProbe {
    IVRFCoordinatorProbe public immutable coordinator;

    uint256 public pendingRequestId;
    uint32 public pendingNumberCount;

    uint256 public lastRequestedAt;
    uint256 public lastFulfilledAt;
    uint256 public lastFulfilledRequestId;

    uint32 public lastRequestedNumberCount;
    uint32 public lastFulfilledNumberCount;

    uint256 public lastRandomNumber;
    bytes32 public lastRandomNumbersHash;

    // Kept unchanged for compatibility with the existing latency monitor.
    event ProbeRequested(
        uint256 indexed requestId,
        uint256 requestedAt
    );

    event ProbeFulfilled(
        uint256 indexed requestId,
        uint256 requestedAt,
        uint256 fulfilledAt,
        uint256 randomNumber
    );

    // Additional events for the 1–6 number test.
    event ProbeRequestedWithCount(
        uint256 indexed requestId,
        uint256 requestedAt,
        uint32 numNumbers
    );

    event ProbeFulfilledWithCount(
        uint256 indexed requestId,
        uint256 requestedAt,
        uint256 fulfilledAt,
        uint32 numNumbers,
        bytes32 randomNumbersHash
    );

    constructor(address coordinatorAddress) {
        require(coordinatorAddress != address(0), "Zero coordinator");
        coordinator = IVRFCoordinatorProbe(coordinatorAddress);
    }

    // Keeps the old behavior: request exactly 1 number.
    function request() external returns (uint256 requestId) {
        return _request(1);
    }

    // Controlled test for 1 through 6 random numbers.
    function request(uint32 numNumbers)
        external
        returns (uint256 requestId)
    {
        return _request(numNumbers);
    }

    function _request(uint32 numNumbers)
        internal
        returns (uint256 requestId)
    {
        require(pendingRequestId == 0, "Request already pending");
        require(numNumbers >= 1 && numNumbers <= 6, "Number count must be 1-6");

        uint256 seed = uint256(
            keccak256(
                abi.encode(
                    address(this),
                    msg.sender,
                    block.timestamp,
                    block.number,
                    numNumbers
                )
            )
        );

        requestId = coordinator.requestRandomNumbers(numNumbers, seed);

        pendingRequestId = requestId;
        pendingNumberCount = numNumbers;
        lastRequestedNumberCount = numNumbers;
        lastRequestedAt = block.timestamp;

        emit ProbeRequested(requestId, block.timestamp);
        emit ProbeRequestedWithCount(
            requestId,
            block.timestamp,
            numNumbers
        );
    }

    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external override {
        require(msg.sender == address(coordinator), "Only coordinator");
        require(requestId == pendingRequestId, "Request mismatch");
        require(
            randomNumbers.length == pendingNumberCount,
            "Wrong number count"
        );

        uint256 requestedAt = lastRequestedAt;
        uint32 numberCount = pendingNumberCount;
        uint256 fulfilledAt = block.timestamp;

        lastFulfilledRequestId = requestId;
        lastFulfilledNumberCount = numberCount;
        lastRandomNumber = randomNumbers[0];
        lastRandomNumbersHash = keccak256(abi.encode(randomNumbers));
        lastFulfilledAt = fulfilledAt;

        pendingRequestId = 0;
        pendingNumberCount = 0;

        emit ProbeFulfilled(
            requestId,
            requestedAt,
            fulfilledAt,
            randomNumbers[0]
        );

        emit ProbeFulfilledWithCount(
            requestId,
            requestedAt,
            fulfilledAt,
            numberCount,
            lastRandomNumbersHash
        );
    }
}
