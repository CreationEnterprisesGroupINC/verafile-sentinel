// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ObservationCommitment
/// @notice Minimal reference contract for recording OCP digest commitments.
/// @dev OCP defines the verification boundary; this contract only emits commitments.
contract ObservationCommitment {
    event Recorded(bytes32 indexed digest, address indexed recorder);

    function record(bytes32 digest) external {
        emit Recorded(digest, msg.sender);
    }
}
