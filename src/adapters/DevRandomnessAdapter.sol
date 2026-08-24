// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessAdapter, IRandomnessConsumer} from "../interfaces/IRandomnessAdapter.sol";

/// @notice Deterministic randomness adapter for local development, simulations and balance testing.
/// @dev DEV/TEST ONLY. This adapter is intentionally operator-controlled and must never be used as a production
///      randomness source. Requests are fulfilled in a second transaction so Delveworn has time to persist its
///      pending request state before the callback arrives, matching the asynchronous semantics of production VRF.
contract DevRandomnessAdapter is IRandomnessAdapter {
    struct Request {
        uint32 numberCount;
        uint256 seed;
        bool pending;
    }

    address public immutable owner;
    address public consumer;
    uint256 public nextRequestId = 1;

    mapping(uint256 => Request) public requests;
    mapping(uint256 => bool) public pendingRequests;

    event ConsumerSet(address indexed consumer);
    event DevRandomnessRequested(
        uint256 indexed requestId, address indexed consumer, uint32 numberCount, uint256 seed
    );
    event DevRandomnessFulfilled(uint256 indexed requestId, address indexed consumer, bool customWords);

    error OnlyOwner();
    error OnlyConsumer();
    error ConsumerAlreadySet();
    error InvalidAddress();
    error InvalidConfig();
    error UnknownRequest();
    error WrongNumberCount(uint256 expected, uint256 actual);

    constructor() {
        owner = msg.sender;
    }

    function setConsumer(address consumerAddress) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (consumer != address(0)) revert ConsumerAlreadySet();
        if (consumerAddress == address(0)) revert InvalidAddress();

        consumer = consumerAddress;
        emit ConsumerSet(consumerAddress);
    }

    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external override returns (uint256 requestId) {
        if (msg.sender != consumer || consumer == address(0)) revert OnlyConsumer();
        if (numNumbers == 0) revert InvalidConfig();

        requestId = nextRequestId++;
        requests[requestId] = Request({numberCount: numNumbers, seed: seed, pending: true});
        pendingRequests[requestId] = true;

        emit DevRandomnessRequested(requestId, msg.sender, numNumbers, seed);
    }

    /// @notice Fulfill a pending request with deterministic words derived only from stored request data.
    /// @dev The same request state always yields the same words. Owner-only keeps public test deployments from
    ///      being advanced by arbitrary users while retaining deterministic, dependency-free development runs.
    function fulfill(uint256 requestId) external returns (uint256[] memory randomNumbers) {
        if (msg.sender != owner) revert OnlyOwner();

        Request memory request = _consumeRequest(requestId);
        randomNumbers = new uint256[](request.numberCount);

        for (uint256 i = 0; i < request.numberCount; i++) {
            randomNumbers[i] = uint256(keccak256(abi.encode(request.seed, requestId, i)));
        }

        IRandomnessConsumer(consumer).rawFulfillRandomNumbers(requestId, randomNumbers);
        emit DevRandomnessFulfilled(requestId, consumer, false);
    }

    /// @notice Fulfill with explicit words to reproduce exact scenarios in tests and balance simulations.
    function fulfillWithWords(uint256 requestId, uint256[] calldata randomNumbers) external {
        if (msg.sender != owner) revert OnlyOwner();

        Request memory request = requests[requestId];
        if (!request.pending || !pendingRequests[requestId]) revert UnknownRequest();
        if (randomNumbers.length != request.numberCount) {
            revert WrongNumberCount(request.numberCount, randomNumbers.length);
        }

        _clearRequest(requestId);

        uint256[] memory words = new uint256[](randomNumbers.length);
        for (uint256 i = 0; i < randomNumbers.length; i++) {
            words[i] = randomNumbers[i];
        }

        IRandomnessConsumer(consumer).rawFulfillRandomNumbers(requestId, words);
        emit DevRandomnessFulfilled(requestId, consumer, true);
    }

    function _consumeRequest(uint256 requestId) internal returns (Request memory request) {
        request = requests[requestId];
        if (!request.pending || !pendingRequests[requestId]) revert UnknownRequest();
        _clearRequest(requestId);
    }

    function _clearRequest(uint256 requestId) internal {
        delete requests[requestId];
        delete pendingRequests[requestId];
    }
}
