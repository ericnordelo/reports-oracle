// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

contract TestOverflow {
    function testOverflow() public pure {
        uint128 sum = uint128(type(uint64).max) + uint128(type(uint64).max);
        require(sum == 36893488147419103230, "overflows"); // (2^64 -1)*2
        uint64 half = uint64(sum / 2);
        require(half == 18446744073709551615, "overflow2"); // 2 ^ 64 - 1
    }
}
