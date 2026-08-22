// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessAdapter, IRandomnessConsumer} from "../interfaces/IRandomnessAdapter.sol";

interface IChainlinkV25Wrapper {
    function calculateRequestPriceNative(uint32 callbackGasLimit, uint32 numWords) external view returns (uint256);

    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes calldata extraArgs
    ) external payable returns (uint256 requestId);
}

/// @notice Provider adapter for Chainlink VRF v2.5 Wrapper direct funding using native gas token.
/// @dev The adapter is intentionally chain-agnostic: deploy it with the wrapper address for the target chain.
///      Fund the adapter before requests. The owner sets the single authorized RiseDungeon consumer after deployment.
contract ChainlinkV25DirectFundingAdapter is IRandomnessAdapter {
    bytes4 private constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    address public immutable owner;
    IChainlinkV25Wrapper public immutable wrapper;
    uint32 public immutable callbackGasLimit;
    uint16 public immutable requestConfirmations;

    address public consumer;

    mapping(uint256 => bool) public pendingRequests;

    event ConsumerSet(address indexed consumer);
    event AdapterFunded(address indexed sender, uint256 amount);
    event AdapterRandomnessRequested(uint256 indexed requestId, address indexed consumer, uint32 numberCount, uint256 paid);
    event AdapterRandomnessFulfilled(uint256 indexed requestId, address indexed consumer);
    event NativeWithdrawn(address indexed recipient, uint256 amount);

    error OnlyOwner();
    error OnlyConsumer();
    error OnlyWrapper();
    error ConsumerAlreadySet();
    error InvalidAddress();
    error InvalidConfig();
    error UnknownRequest();
    error InsufficientAdapterBalance(uint256 required, uint256 available);
    error NativeTransferFailed();

    constructor(address wrapperAddress, uint32 callbackGasLimit_, uint16 requestConfirmations_) {
        if (wrapperAddress == address(0)) revert InvalidAddress();
        if (callbackGasLimit_ == 0 || requestConfirmations_ == 0) revert InvalidConfig();

        owner = msg.sender;
        wrapper = IChainlinkV25Wrapper(wrapperAddress);
        callbackGasLimit = callbackGasLimit_;
        requestConfirmations = requestConfirmations_;
    }

    receive() external payable {
        emit AdapterFunded(msg.sender, msg.value);
    }

    function setConsumer(address consumerAddress) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (consumer != address(0)) revert ConsumerAlreadySet();
        if (consumerAddress == address(0)) revert InvalidAddress();

        consumer = consumerAddress;
        emit ConsumerSet(consumerAddress);
    }

    function quote(uint32 numNumbers) public view returns (uint256) {
        if (numNumbers == 0) revert InvalidConfig();
        return wrapper.calculateRequestPriceNative(callbackGasLimit, numNumbers);
    }

    function requestRandomNumbers(uint32 numNumbers, uint256) external override returns (uint256 requestId) {
        if (msg.sender != consumer || consumer == address(0)) revert OnlyConsumer();
        if (numNumbers == 0) revert InvalidConfig();

        uint256 requestPrice = quote(numNumbers);
        uint256 available = address(this).balance;
        if (available < requestPrice) revert InsufficientAdapterBalance(requestPrice, available);

        bytes memory extraArgs = abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, true);

        requestId = wrapper.requestRandomWordsInNative{value: requestPrice}(
            callbackGasLimit, requestConfirmations, numNumbers, extraArgs
        );
        if (requestId == 0 || pendingRequests[requestId]) revert UnknownRequest();

        pendingRequests[requestId] = true;

        emit AdapterRandomnessRequested(requestId, msg.sender, numNumbers, requestPrice);
    }

    /// @notice Chainlink wrapper callback entrypoint.
    /// @dev Matches VRFV2PlusWrapperConsumerBase.rawFulfillRandomWords ABI.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(wrapper)) revert OnlyWrapper();
        if (!pendingRequests[requestId]) revert UnknownRequest();

        delete pendingRequests[requestId];

        IRandomnessConsumer(consumer).rawFulfillRandomNumbers(requestId, randomWords);

        emit AdapterRandomnessFulfilled(requestId, consumer);
    }

    function withdrawNative(address payable recipient, uint256 amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (recipient == address(0)) revert InvalidAddress();

        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();

        emit NativeWithdrawn(recipient, amount);
    }
}
