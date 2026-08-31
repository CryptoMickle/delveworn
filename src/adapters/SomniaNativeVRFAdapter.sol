// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessAdapter, IRandomnessConsumer} from "../interfaces/IRandomnessAdapter.sol";
import {ISomniaVRFCoordinator} from "../interfaces/ISomniaVRFCoordinator.sol";

/// @notice Provider adapter for Somnia's Reactivity-native, drand-mixed VRF.
/// @dev Requests always use verifiable entropy so the same adapter configuration is safe on
///      Shannon testnet and Somnia mainnet. The provider-neutral seed is intentionally ignored.
contract SomniaNativeVRFAdapter is IRandomnessAdapter {
    uint32 public constant MAX_CALLBACK_GAS_LIMIT = 2_500_000;
    uint16 public constant MIN_COMMIT_DELAY_BLOCKS = 16;
    uint16 public constant MAX_COMMIT_DELAY_BLOCKS = 200;
    uint32 public constant MAX_NUM_WORDS = 500;

    address public immutable owner;
    ISomniaVRFCoordinator public immutable coordinator;
    uint32 public immutable callbackGasLimit;
    uint16 public immutable commitDelayBlocks;

    address public consumer;

    mapping(uint256 => bool) public pendingRequests;

    event ConsumerSet(address indexed consumer);
    event AdapterRandomnessRequested(uint256 indexed requestId, address indexed consumer, uint32 numberCount);
    event AdapterRandomnessFulfilled(uint256 indexed requestId, address indexed consumer);

    error OnlyOwner();
    error OnlyConsumer();
    error OnlyCoordinator();
    error ConsumerAlreadySet();
    error InvalidAddress();
    error InvalidConfig();
    error InvalidNumberCount();
    error UnknownRequest();

    constructor(address coordinatorAddress, uint32 callbackGasLimit_, uint16 commitDelayBlocks_) {
        if (coordinatorAddress == address(0) || coordinatorAddress.code.length == 0) revert InvalidAddress();
        if (callbackGasLimit_ == 0 || callbackGasLimit_ > MAX_CALLBACK_GAS_LIMIT) revert InvalidConfig();
        if (commitDelayBlocks_ < MIN_COMMIT_DELAY_BLOCKS || commitDelayBlocks_ > MAX_COMMIT_DELAY_BLOCKS) {
            revert InvalidConfig();
        }

        owner = msg.sender;
        coordinator = ISomniaVRFCoordinator(coordinatorAddress);
        callbackGasLimit = callbackGasLimit_;
        commitDelayBlocks = commitDelayBlocks_;
    }

    function setConsumer(address consumerAddress) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (consumer != address(0)) revert ConsumerAlreadySet();
        if (consumerAddress == address(0) || consumerAddress.code.length == 0) revert InvalidAddress();

        consumer = consumerAddress;
        emit ConsumerSet(consumerAddress);
    }

    function requestRandomNumbers(uint32 numNumbers, uint256) external override returns (uint256 requestId) {
        if (msg.sender != consumer || consumer == address(0)) revert OnlyConsumer();
        if (numNumbers == 0 || numNumbers > MAX_NUM_WORDS) revert InvalidNumberCount();

        requestId = coordinator.requestRandomWords(
            ISomniaVRFCoordinator.RandomWordsRequest({
                callbackGasLimit: callbackGasLimit,
                commitDelayBlocks: commitDelayBlocks,
                numWords: numNumbers,
                useVerifiableEntropy: true
            })
        );

        if (requestId == 0 || pendingRequests[requestId]) revert UnknownRequest();
        pendingRequests[requestId] = true;

        emit AdapterRandomnessRequested(requestId, msg.sender, numNumbers);
    }

    /// @notice Somnia native VRF callback entrypoint.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(coordinator)) revert OnlyCoordinator();
        if (!pendingRequests[requestId]) revert UnknownRequest();

        delete pendingRequests[requestId];

        IRandomnessConsumer(consumer).rawFulfillRandomNumbers(requestId, randomWords);

        emit AdapterRandomnessFulfilled(requestId, consumer);
    }
}
