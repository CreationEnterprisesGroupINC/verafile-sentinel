// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    function getRevocation(
        bytes32 originalDigest
    ) external view returns (RevocationRecord memory) {
        return revocations[originalDigest];
    }

    function isRevoked(
        bytes32 originalDigest
    ) external view returns (bool) {
        return revocations[originalDigest].exists;
    }
}
