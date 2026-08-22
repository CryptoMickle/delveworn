// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessAdapter, IRandomnessConsumer} from "../interfaces/IRandomnessAdapter.sol";

/// @notice Compatibility adapter between Rise Dungeon core and a legacy VRF-style coordinator.
/// @dev The adapter owns the chain/provider-specific callback boundary and no longer imports game core types.
contract LegacyVRFAdapter is IRandomnessAdapter, IRandomnessConsumer {
    IRandomnessAdapter public immutable upstreamCoordinator;

    mapping(uint256 => address) public requestConsumers;

    event AdapterRandomnessRequested(
        uint256 indexed requestId, address indexed consumer, address indexed upstreamCoordinator, uint32 numberCount
    );

    event AdapterRandomnessFulfilled(uint256 indexed requestId, address indexed consumer);

    constructor(address upstreamCoordinatorAddress) {
        require(upstreamCoordinatorAddress != address(0), "Invalid upstream coordinator");
        upstreamCoordinator = IRandomnessAdapter(upstreamCoordinatorAddress);
    }

    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external override returns (uint256 requestId) {
        require(numNumbers > 0, "Must request numbers");

        requestId = upstreamCoordinator.requestRandomNumbers(numNumbers, seed);
        require(requestId != 0, "Invalid request id");
        require(requestConsumers[requestId] == address(0), "Duplicate request id");

        requestConsumers[requestId] = msg.sender;

        emit AdapterRandomnessRequested(requestId, msg.sender, address(upstreamCoordinator), numNumbers);
    }

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external override {
        require(msg.sender == address(upstreamCoordinator), "Only upstream coordinator");

        address consumer = requestConsumers[requestId];
        require(consumer != address(0), "Unknown request");

        delete requestConsumers[requestId];

        IRandomnessConsumer(consumer).rawFulfillRandomNumbers(requestId, randomNumbers);

        emit AdapterRandomnessFulfilled(requestId, consumer);
    }
}
