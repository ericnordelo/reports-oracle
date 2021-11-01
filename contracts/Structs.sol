// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @dev The fundamental unit of storage for a reporter source
 * @param timestamp the timestamp of the report
 * @param price the reported price
 */
struct Report {
    uint64 timestamp;
    uint64 price;
}
