// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

/**
 * @title library to verify signatures on-chain
 */
library Signature {
    /**
     * @notice recovers the source address which signed a message
     * @dev comparing to a claimed address would add nothing,
     *      as the caller could simply perform the recover and claim that address.
     *
     * @param message the data that was presumably signed
     * @param signature the fingerprint of the data + private key
     * @return the source address which signed the message, presumably
     */
    function getSigner(bytes memory message, bytes memory signature) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = abi.decode(signature, (bytes32, bytes32, uint8));
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(message)));
        return ecrecover(hash, v, r, s);
    }

    /**
     * @notice decodes the message from the reporter
     * @param message the data that was signed
     * @param signature the fingerprint of the data + private key
     * @return signer the source address which signed the message
     * @return timestamp the timestamp of the report
     * @return key the currency symbol
     * @return value the reported price
     */
    function decode(bytes calldata message, bytes calldata signature)
        internal
        pure
        returns (
            address signer,
            uint64 timestamp,
            string memory key,
            uint64 value
        )
    {
        // recover the source address
        signer = getSigner(message, signature);

        // decode the message and check the kind
        string memory kind;
        (kind, timestamp, key, value) = abi.decode(message, (string, uint64, string, uint64));

        require(
            keccak256(abi.encodePacked(kind)) == keccak256(abi.encodePacked("prices")),
            "Kind of data must be 'prices'"
        );

        return (signer, timestamp, key, value);
    }
}
