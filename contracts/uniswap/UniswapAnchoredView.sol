// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "../PriceOracleData.sol";
import "./UniswapConfig.sol";
import "./UniswapLib.sol";
import "./Structs.sol";

contract UniswapAnchoredView is UniswapConfig {
    using FixedPoint for *;

    /// @notice the number of wei in 1 ETH
    uint256 public constant ETH_BASE_UNIT = 1e18;

    /// @notice a common scaling factor to maintain precision
    uint256 public constant EXP_SCALE = 1e18;

    /// @notice the price oracle data contract
    PriceOracleData public immutable priceData;

    bytes32 private constant ETH_HASH = keccak256(abi.encodePacked("ETH"));
    bytes32 private constant ROTATE_HASH = keccak256(abi.encodePacked("rotate"));

    /// @notice the Open Oracle Reporter
    address public immutable reporter;

    /// @notice the highest ratio of the new price to the anchor price that will still trigger the price to be updated
    uint256 public immutable upperBoundAnchorRatio;

    /// @notice the lowest ratio of the new price to the anchor price that will still trigger the price to be updated
    uint256 public immutable lowerBoundAnchorRatio;

    /// @notice the minimum amount of time in seconds required for the old uniswap price accumulator to be replaced
    uint256 public immutable anchorPeriod;

    /// @notice official prices by symbol hash
    mapping(bytes32 => uint256) public prices;

    /// @notice circuit breaker for using anchor price oracle directly, ignoring reporter
    bool public reporterInvalidated;

    /// @notice the old observation for each symbolHash
    mapping(bytes32 => Observation) public oldObservations;

    /// @notice the new observation for each symbolHash
    mapping(bytes32 => Observation) public newObservations;

    /// @notice the event emitted when new prices are posted but the stored price is not updated due to the anchor
    event PriceGuarded(string symbol, uint256 reporter, uint256 anchor);

    /// @notice the event emitted when the stored price is updated
    event PriceUpdated(string symbol, uint256 price);

    /// @notice the event emitted when anchor price is updated
    event AnchorPriceUpdated(string symbol, uint256 anchorPrice, uint256 oldTimestamp, uint256 newTimestamp);

    /// @notice the event emitted when the uniswap window changes
    event UniswapWindowUpdated(
        bytes32 indexed symbolHash,
        uint256 oldTimestamp,
        uint256 newTimestamp,
        uint256 oldPrice,
        uint256 newPrice
    );

    /// @notice the event emitted when reporter invalidates itself
    event ReporterInvalidated(address reporter);

    /**
     * @notice construct a uniswap anchored view for a set of token configurations
     * @dev note that to avoid immature TWAPs, the system must run for at least a single anchorPeriod before using.
     * @param reporter_ the reporter whose prices are to be used
     * @param anchorToleranceMantissa_ the percentage tolerance that the reporter may deviate from the uniswap anchor
     * @param anchorPeriod_ the minimum amount of time required for the old uniswap price accumulator to be replaced
     * @param configs the static token configurations which define what prices are supported and how
     */
    constructor(
        PriceOracleData priceData_,
        address reporter_,
        uint256 anchorToleranceMantissa_,
        uint256 anchorPeriod_,
        TokenConfig[] memory configs
    ) UniswapConfig(configs) {
        priceData = priceData_;
        reporter = reporter_;
        anchorPeriod = anchorPeriod_;

        // Allow the tolerance to be whatever the deployer chooses, but prevent under/overflow (and prices from being 0)
        upperBoundAnchorRatio = anchorToleranceMantissa_ > type(uint256).max - 100e16
            ? type(uint256).max
            : 100e16 + anchorToleranceMantissa_;
        lowerBoundAnchorRatio = anchorToleranceMantissa_ < 100e16 ? 100e16 - anchorToleranceMantissa_ : 1;

        for (uint256 i = 0; i < configs.length; i++) {
            TokenConfig memory config = configs[i];
            require(config.baseUnit > 0, "baseUnit must be greater than zero");
            address uniswapMarket = config.uniswapMarket;
            if (config.priceSource == PriceSource.REPORTER) {
                require(uniswapMarket != address(0), "Reported prices must have an anchor");
                bytes32 symbolHash = config.symbolHash;
                uint256 cumulativePrice = currentCumulativePrice(config);
                oldObservations[symbolHash].timestamp = block.timestamp; // solhint-disable-line
                newObservations[symbolHash].timestamp = block.timestamp; // solhint-disable-line
                oldObservations[symbolHash].acc = cumulativePrice;
                newObservations[symbolHash].acc = cumulativePrice;
                emit UniswapWindowUpdated(
                    symbolHash,
                    block.timestamp, // solhint-disable-line
                    block.timestamp, // solhint-disable-line
                    cumulativePrice,
                    cumulativePrice
                );
            } else {
                require(uniswapMarket == address(0), "Only reported prices utilize an anchor");
            }
        }
    }

    /**
     * @notice Get the official price for a symbol
     * @param symbol the symbol to fetch the price of
     * @return currentPrice Price denominated in USD, with 6 decimals
     */
    function price(string memory symbol) external view returns (uint256 currentPrice) {
        TokenConfig memory config = getTokenConfigBySymbol(symbol);
        return priceInternal(config);
    }

    function priceInternal(TokenConfig memory config) internal view returns (uint256 currentPrice) {
        if (config.priceSource == PriceSource.REPORTER) return prices[config.symbolHash];
        if (config.priceSource == PriceSource.FIXED_USD) return config.fixedPrice;
        if (config.priceSource == PriceSource.FIXED_ETH) {
            uint256 usdPerEth = prices[ETH_HASH];
            require(usdPerEth > 0, "ETH price not set, cannot convert to dollars");
            return mul(usdPerEth, config.fixedPrice) / ETH_BASE_UNIT;
        }
    }

    /**
     * @notice Get the underlying price of a cToken
     * @dev Implements the PriceOracle interface for Compound v2.
     * @param cToken the cToken address for price retrieval
     * @return Price denominated in USD, with 18 decimals, for the given cToken address
     */
    function getUnderlyingPrice(address cToken) external view returns (uint256) {
        TokenConfig memory config = getTokenConfigByCToken(cToken);
        // Comptroller needs prices in the format: ${raw price} * 1e(36 - baseUnit)
        // Since the prices in this view have 6 decimals, we must scale them by 1e(36 - 6 - baseUnit)
        return mul(1e30, priceInternal(config)) / config.baseUnit;
    }

    /**
     * @notice Post open oracle reporter prices, and recalculate stored price by comparing to anchor
     * @dev We let anyone pay to post anything, but only prices from configured reporter will be stored in the view.
     * @param messages the messages to post to the oracle
     * @param signatures the signatures for the corresponding messages
     * @param symbols the symbols to compare to anchor for authoritative reading
     */
    function postPrices(
        bytes[] calldata messages,
        bytes[] calldata signatures,
        string[] calldata symbols
    ) external {
        require(messages.length == signatures.length, "Messages and signatures must be 1:1");

        // Save the prices
        for (uint256 i = 0; i < messages.length; i++) {
            priceData.put(messages[i], signatures[i]);
        }

        uint256 ethPrice = fetchEthPrice();

        // Try to update the view storage
        for (uint256 i = 0; i < symbols.length; i++) {
            postPriceInternal(symbols[i], ethPrice);
        }
    }

    function postPriceInternal(string memory symbol, uint256 ethPrice) internal {
        TokenConfig memory config = getTokenConfigBySymbol(symbol);
        require(config.priceSource == PriceSource.REPORTER, "Only reporter prices get posted");

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        uint256 reporterPrice = priceData.getPrice(reporter, symbol);
        uint256 anchorPrice;
        if (symbolHash == ETH_HASH) {
            anchorPrice = ethPrice;
        } else {
            anchorPrice = fetchAnchorPrice(symbol, config, ethPrice);
        }

        if (reporterInvalidated) {
            prices[symbolHash] = anchorPrice;
            emit PriceUpdated(symbol, anchorPrice);
        } else if (isWithinAnchor(reporterPrice, anchorPrice)) {
            prices[symbolHash] = reporterPrice;
            emit PriceUpdated(symbol, reporterPrice);
        } else {
            emit PriceGuarded(symbol, reporterPrice, anchorPrice);
        }
    }

    function isWithinAnchor(uint256 reporterPrice, uint256 anchorPrice) internal view returns (bool) {
        if (reporterPrice > 0) {
            uint256 anchorRatio = mul(anchorPrice, 100e16) / reporterPrice;
            return anchorRatio <= upperBoundAnchorRatio && anchorRatio >= lowerBoundAnchorRatio;
        }
        return false;
    }

    /**
     * @dev Fetches the current token/eth price accumulator from uniswap.
     */
    function currentCumulativePrice(TokenConfig memory config) internal view returns (uint256) {
        (uint256 cumulativePrice0, uint256 cumulativePrice1, ) = UniswapV2OracleLibrary
            .currentCumulativePrices(config.uniswapMarket);
        if (config.isUniswapReversed) {
            return cumulativePrice1;
        } else {
            return cumulativePrice0;
        }
    }

    /**
     * @dev Fetches the current eth/usd price from uniswap, with 6 decimals of precision.
     *  Conversion factor is 1e18 for eth/usdc market, since we decode uniswap price statically with 18 decimals.
     */
    function fetchEthPrice() internal returns (uint256) {
        return fetchAnchorPrice("ETH", getTokenConfigBySymbolHash(ETH_HASH), ETH_BASE_UNIT);
    }

    /**
     * @dev Fetches the current token/usd price from uniswap, with 6 decimals of precision.
     * @param conversionFactor 1e18 if seeking the ETH price, and a 6 decimal ETH-USDC price in the case of other assets
     */
    function fetchAnchorPrice(
        string memory symbol,
        TokenConfig memory config,
        uint256 conversionFactor
    ) internal virtual returns (uint256) {
        (uint256 nowCumulativePrice, uint256 oldCumulativePrice, uint256 oldTimestamp) = pokeWindowValues(
            config
        );

        uint256 timeElapsed = block.timestamp - oldTimestamp; // solhint-disable-line

        // Calculate uniswap time-weighted average price
        // Underflow is a property of the accumulators: https://uniswap.org/audit.html#orgc9b3190
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((nowCumulativePrice - oldCumulativePrice) / timeElapsed)
        );
        uint256 rawUniswapPriceMantissa = priceAverage.decode112with18();
        uint256 unscaledPriceMantissa = mul(rawUniswapPriceMantissa, conversionFactor);
        uint256 anchorPrice;

        // Adjust rawUniswapPrice according to the units of the non-ETH asset
        // In the case of ETH, we would have to scale by 1e6 / USDC_UNITS, but since baseUnit2 is 1e6 (USDC), it cancels

        // In the case of non-ETH tokens
        // a. pokeWindowValues already handled uniswap reversed cases, so priceAverage will always be Token/ETH TWAP price.
        // b. conversionFactor = ETH price * 1e6
        // unscaledPriceMantissa = priceAverage(token/ETH TWAP price) * EXP_SCALE * conversionFactor
        // so ->
        // anchorPrice = priceAverage * tokenBaseUnit / ETH_BASE_UNIT * ETH_price * 1e6
        //             = priceAverage * conversionFactor * tokenBaseUnit / ETH_BASE_UNIT
        //             = unscaledPriceMantissa / EXP_SCALE * tokenBaseUnit / ETH_BASE_UNIT
        anchorPrice = mul(unscaledPriceMantissa, config.baseUnit) / ETH_BASE_UNIT / EXP_SCALE;

        emit AnchorPriceUpdated(symbol, anchorPrice, oldTimestamp, block.timestamp); // solhint-disable-line

        return anchorPrice;
    }

    /**
     * @dev Get time-weighted average prices for a token at the current timestamp.
     *  Update new and old observations of lagging window if period elapsed.
     */
    function pokeWindowValues(TokenConfig memory config)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        bytes32 symbolHash = config.symbolHash;
        uint256 cumulativePrice = currentCumulativePrice(config);

        Observation memory newObservation = newObservations[symbolHash];

        // Update new and old observations if elapsed time is greater than or equal to anchor period
        uint256 timeElapsed = block.timestamp - newObservation.timestamp; // solhint-disable-line
        if (timeElapsed >= anchorPeriod) {
            oldObservations[symbolHash].timestamp = newObservation.timestamp;
            oldObservations[symbolHash].acc = newObservation.acc;

            newObservations[symbolHash].timestamp = block.timestamp; // solhint-disable-line
            newObservations[symbolHash].acc = cumulativePrice;
            emit UniswapWindowUpdated(
                config.symbolHash,
                newObservation.timestamp,
                block.timestamp, // solhint-disable-line
                newObservation.acc,
                cumulativePrice
            );
        }
        return (cumulativePrice, oldObservations[symbolHash].acc, oldObservations[symbolHash].timestamp);
    }

    /**
     * @notice Invalidate the reporter, and fall back to using anchor directly in all cases
     * @dev Only the reporter may sign a message which allows it to invalidate itself.
     *  To be used in cases of emergency, if the reporter thinks their key may be compromised.
     * @param message the data that was presumably signed
     * @param signature the fingerprint of the data + private key
     */
    function invalidateReporter(bytes memory message, bytes memory signature) external {
        (string memory decodedMessage, ) = abi.decode(message, (string, address));
        require(
            keccak256(abi.encodePacked(decodedMessage)) == ROTATE_HASH,
            "Invalid message must be 'rotate'"
        );
        require(source(message, signature) == reporter, "Invalidation message must come from the reporter");
        reporterInvalidated = true;
        emit ReporterInvalidated(reporter);
    }

    /**
     * @notice Recovers the source address which signed a message
     * @dev Comparing to a claimed address would add nothing,
     *  as the caller could simply perform the recover and claim that address.
     * @param message the data that was presumably signed
     * @param signature the fingerprint of the data + private key
     * @return the source address which signed the message, presumably
     */
    function source(bytes memory message, bytes memory signature) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = abi.decode(signature, (bytes32, bytes32, uint8));
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(message)));
        return ecrecover(hash, v, r, s);
    }

    /// @dev Overflow proof multiplication
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "multiplication overflow");
        return c;
    }
}
