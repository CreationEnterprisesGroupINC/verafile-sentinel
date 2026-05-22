// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OCPRevocation
/// @notice Additive revocation commitment layer for the Observation Commitment Protocol.
/// @dev Revocation authority is verified at the verification layer, not the commitment layer.
///      Any address may publish a revocation commitment. Verifiers are responsible for
///      evaluating whether the revoker address corresponds to the original committer.
///      This is consistent with OCP's philosophy of pushing semantics to the verification layer.

contract OCPRevocation {

    event RevocationCommitted(
        bytes32 indexed originalDigest,
        bytes32 indexed revocationDigest,
        address indexed revoker,
        uint256 timestamp
    );

    struct RevocationRecord {
        bytes32 revocationDigest;
        address revoker;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => RevocationRecord) public revocations;

    /// @notice Publish a revocation commitment referencing a prior OCP digest.
    /// @dev Does not verify revoker authority. Authority verification is the
    ///      responsibility of the verifier layer per OCP's verification boundary.
    /// @param originalDigest The digest of the original OCP commitment being revoked.
    /// @param revocationDigest The digest of the revocation payload.
    function commitRevocation(
        bytes32 originalDigest,
        bytes32 revocationDigest
    ) external {
        require(!revocations[originalDigest].exists, "already revoked");

        revocations[originalDigest] = RevocationRecord({
            revocationDigest: revocationDigest,
            revoker: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit RevocationCommitted(
            originalDigest,
            revocationDigest,
            msg.sender,
            block.timestamp
        );
    }

    /// @notice Retrieve the full revocation record for a given original digest.
    /// @param originalDigest The digest to query.
    /// @return The RevocationRecord struct. exists will be false if no revocation exists.
    function getRevocation(
        bytes32 originalDigest
    ) external view returns (RevocationRecord memory) {
        return revocations[originalDigest];
    }

    /// @notice Check whether a revocation commitment exists for a given digest.
    /// @param originalDigest The digest to query.
    /// @return True if a revocation commitment exists.
    function isRevoked(
        bytes32 originalDigest
    ) external view returns (bool) {
        return revocations[originalDigest].exists;
    }
}
