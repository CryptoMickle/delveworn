// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Provider-neutral request boundary consumed by Delveworn.
/// @dev Provider-specific adapters implement this ABI and translate it to their upstream randomness service.
interface IRandomnessAdapter {
    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external returns (uint256 requestId);
}

/// @notice Provider-neutral callback boundary implemented by Delveworn consumers.
interface IRandomnessConsumer {
    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external;
}
