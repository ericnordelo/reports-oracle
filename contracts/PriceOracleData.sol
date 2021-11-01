// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "./Signature.sol";
import "./Structs.sol";

/**
 * @title the price oracle data contract
 * @notice values stored in this contract should represent a USD price with 6 decimals precision
 */
contract PriceOracleData {
    using Signature for bytes;

    /**
     * @dev the most recent authenticated data from all sources.
     *      this is private because dynamic mapping keys preclude auto-generated getters.
     */
    mapping(address => mapping(string => Report)) private data;

    /// @notice the event emitted when a source writes to its storage
    event PriceUpdated(address indexed source, string key, uint64 timestamp, uint64 value);

    /// @notice the event emitted when the timestamp on a price is invalid and it is not written to storage
    event UpdateFailed(uint64 priorTimestamp, uint256 messageTimestamp, uint256 blockTimestamp);

    /**
     * @notice write a bunch of signed reports to the authenticated storage mapping
     * @param message_ the payload containing the timestamp, and (key, value) pairs
     * @param signature_ the cryptographic signature of the message payload, authorizing the source to write
     * @return keys the keys that were written
     */
    function put(bytes calldata message_, bytes calldata signature_) external returns (string memory keys) {
        (address source, uint64 timestamp, string memory key, uint64 value) = message_.decode(signature_);
        return putInternal(source, timestamp, key, value);
    }

    function putInternal(
        address source_,
        uint64 timestamp_,
        string memory key_,
        uint64 value_
    ) internal returns (string memory) {
        // only update if newer than stored, according to source
        Report storage prior = data[source_][key_];

        if (
            // solhint-disable-next-line not-rely-on-time
            timestamp_ > prior.timestamp && timestamp_ < block.timestamp + 60 minutes && source_ != address(0)
        ) {
            data[source_][key_] = Report(timestamp_, value_);
            emit PriceUpdated(source_, key_, timestamp_, value_);
        } else {
            // solhint-disable-next-line not-rely-on-time
            emit UpdateFailed(prior.timestamp, timestamp_, block.timestamp);
        }

        return key_;
    }

    /**
     * @notice read a single key from an authenticated source
     * @param source_ the verifiable author of the data
     * @param key_ the selector for the value to return
     * @return timestamp the claimed Unix timestamp for the data
     * @return price the price value
     */
    function get(address source_, string calldata key_)
        external
        view
        returns (uint64 timestamp, uint64 price)
    {
        Report storage report = data[source_][key_];
        return (report.timestamp, report.price);
    }

    /**
     * @notice read only the value for a single key from an authenticated source
     * @param source_ the verifiable author of the data
     * @param key_ the selector for the value to return
     * @return price the price value (defaults to 0)
     */
    function getPrice(address source_, string calldata key_) external view returns (uint64 price) {
        return data[source_][key_].price;
    }
}
