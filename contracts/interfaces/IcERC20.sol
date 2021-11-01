// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

interface IcERC20 {
    function underlying() external view returns (address);
}
