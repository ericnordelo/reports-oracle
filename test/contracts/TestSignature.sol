// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "../../contracts/Signature.sol";

contract TestSignature {
    using Signature for bytes;

    function getSigner(bytes memory message, bytes memory signature) external pure returns (address) {
        return message.getSigner(signature);
    }

    function decode(bytes calldata message, bytes calldata signature)
        external
        pure
        returns (
            address signer,
            uint64 timestamp,
            string memory key,
            uint64 value
        )
    {
        return message.decode(signature);
    }
}
