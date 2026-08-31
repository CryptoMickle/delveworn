// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for Somnia's Reactivity-native VRF coordinator.
interface ISomniaVRFCoordinator {
    struct RandomWordsRequest {
        uint32 callbackGasLimit;
        uint16 commitDelayBlocks;
        uint32 numWords;
        bool useVerifiableEntropy;
    }

    function requestRandomWords(RandomWordsRequest calldata request) external returns (uint256 requestId);
}
