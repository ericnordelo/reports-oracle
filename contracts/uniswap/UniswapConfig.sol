// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "../interfaces/IcERC20.sol";
import "./Structs.sol";

contract UniswapConfig {
    /**
     * @dev describe how to interpret the fixedPrice in the TokenConfig.
     */
    enum PriceSource {
        FIXED_ETH, // implies the fixedPrice is a constant multiple of the ETH price (which varies)
        FIXED_USD, // implies the fixedPrice is a constant multiple of the USD price (which is 1)
        REPORTER // implies the price is set by the reporter
    }

    /**
     * @dev describe how the USD price should be determined for an asset.
     *      There should be 1 TokenConfig object for each supported asset, passed in the constructor.
     */
    struct TokenConfig {
        address cToken;
        address underlying;
        bytes32 symbolHash;
        uint256 baseUnit;
        PriceSource priceSource;
        uint256 fixedPrice;
        address uniswapMarket;
        bool isUniswapReversed;
    }

    /**
     * @notice the max number of tokens this contract is hardcoded to support
     * @dev do not change this variable without updating all the fields throughout the contract.
     */
    uint256 public constant MAX_TOKENS = 6;

    /// @notice the number of tokens this contract actually supports
    uint256 public immutable numTokens;

    address internal immutable cToken00;
    address internal immutable cToken01;
    address internal immutable cToken02;
    address internal immutable cToken03;
    address internal immutable cToken04;
    address internal immutable cToken05;

    address internal immutable underlying00;
    address internal immutable underlying01;
    address internal immutable underlying02;
    address internal immutable underlying03;
    address internal immutable underlying04;
    address internal immutable underlying05;

    bytes32 internal immutable symbolHash00;
    bytes32 internal immutable symbolHash01;
    bytes32 internal immutable symbolHash02;
    bytes32 internal immutable symbolHash03;
    bytes32 internal immutable symbolHash04;
    bytes32 internal immutable symbolHash05;

    uint256 internal immutable baseUnit00;
    uint256 internal immutable baseUnit01;
    uint256 internal immutable baseUnit02;
    uint256 internal immutable baseUnit03;
    uint256 internal immutable baseUnit04;
    uint256 internal immutable baseUnit05;

    PriceSource internal immutable priceSource00;
    PriceSource internal immutable priceSource01;
    PriceSource internal immutable priceSource02;
    PriceSource internal immutable priceSource03;
    PriceSource internal immutable priceSource04;
    PriceSource internal immutable priceSource05;

    uint256 internal immutable fixedPrice00;
    uint256 internal immutable fixedPrice01;
    uint256 internal immutable fixedPrice02;
    uint256 internal immutable fixedPrice03;
    uint256 internal immutable fixedPrice04;
    uint256 internal immutable fixedPrice05;

    address internal immutable uniswapMarket00;
    address internal immutable uniswapMarket01;
    address internal immutable uniswapMarket02;
    address internal immutable uniswapMarket03;
    address internal immutable uniswapMarket04;
    address internal immutable uniswapMarket05;

    bool internal immutable isUniswapReversed00;
    bool internal immutable isUniswapReversed01;
    bool internal immutable isUniswapReversed02;
    bool internal immutable isUniswapReversed03;
    bool internal immutable isUniswapReversed04;
    bool internal immutable isUniswapReversed05;

    /**
     * @notice construct an immutable store of configs into the contract data
     * @param configs the configs for the supported assets
     */
    constructor(TokenConfig[] memory configs) {
        require(configs.length <= MAX_TOKENS, "Too many configs");
        numTokens = configs.length;

        cToken00 = get(configs, 0).cToken;
        cToken01 = get(configs, 1).cToken;
        cToken02 = get(configs, 2).cToken;
        cToken03 = get(configs, 3).cToken;
        cToken04 = get(configs, 4).cToken;
        cToken05 = get(configs, 5).cToken;

        underlying00 = get(configs, 0).underlying;
        underlying01 = get(configs, 1).underlying;
        underlying02 = get(configs, 2).underlying;
        underlying03 = get(configs, 3).underlying;
        underlying04 = get(configs, 4).underlying;
        underlying05 = get(configs, 5).underlying;

        symbolHash00 = get(configs, 0).symbolHash;
        symbolHash01 = get(configs, 1).symbolHash;
        symbolHash02 = get(configs, 2).symbolHash;
        symbolHash03 = get(configs, 3).symbolHash;
        symbolHash04 = get(configs, 4).symbolHash;
        symbolHash05 = get(configs, 5).symbolHash;

        baseUnit00 = get(configs, 0).baseUnit;
        baseUnit01 = get(configs, 1).baseUnit;
        baseUnit02 = get(configs, 2).baseUnit;
        baseUnit03 = get(configs, 3).baseUnit;
        baseUnit04 = get(configs, 4).baseUnit;
        baseUnit05 = get(configs, 5).baseUnit;

        priceSource00 = get(configs, 0).priceSource;
        priceSource01 = get(configs, 1).priceSource;
        priceSource02 = get(configs, 2).priceSource;
        priceSource03 = get(configs, 3).priceSource;
        priceSource04 = get(configs, 4).priceSource;
        priceSource05 = get(configs, 5).priceSource;

        fixedPrice00 = get(configs, 0).fixedPrice;
        fixedPrice01 = get(configs, 1).fixedPrice;
        fixedPrice02 = get(configs, 2).fixedPrice;
        fixedPrice03 = get(configs, 3).fixedPrice;
        fixedPrice04 = get(configs, 4).fixedPrice;
        fixedPrice05 = get(configs, 5).fixedPrice;

        uniswapMarket00 = get(configs, 0).uniswapMarket;
        uniswapMarket01 = get(configs, 1).uniswapMarket;
        uniswapMarket02 = get(configs, 2).uniswapMarket;
        uniswapMarket03 = get(configs, 3).uniswapMarket;
        uniswapMarket04 = get(configs, 4).uniswapMarket;
        uniswapMarket05 = get(configs, 5).uniswapMarket;

        isUniswapReversed00 = get(configs, 0).isUniswapReversed;
        isUniswapReversed01 = get(configs, 1).isUniswapReversed;
        isUniswapReversed02 = get(configs, 2).isUniswapReversed;
        isUniswapReversed03 = get(configs, 3).isUniswapReversed;
        isUniswapReversed04 = get(configs, 4).isUniswapReversed;
        isUniswapReversed05 = get(configs, 5).isUniswapReversed;
    }

    function get(TokenConfig[] memory configs, uint256 i) internal pure returns (TokenConfig memory) {
        if (i < configs.length) return configs[i];
        return
            TokenConfig({
                cToken: address(0),
                underlying: address(0),
                symbolHash: bytes32(0),
                baseUnit: uint256(0),
                priceSource: PriceSource(0),
                fixedPrice: uint256(0),
                uniswapMarket: address(0),
                isUniswapReversed: false
            });
    }

    function getCTokenIndex(address cToken) internal view returns (uint256) {
        if (cToken == cToken00) return 0;
        if (cToken == cToken01) return 1;
        if (cToken == cToken02) return 2;
        if (cToken == cToken03) return 3;
        if (cToken == cToken04) return 4;
        if (cToken == cToken05) return 5;

        return type(uint256).max;
    }

    function getUnderlyingIndex(address underlying) internal view returns (uint256) {
        if (underlying == underlying00) return 0;
        if (underlying == underlying01) return 1;
        if (underlying == underlying02) return 2;
        if (underlying == underlying03) return 3;
        if (underlying == underlying04) return 4;
        if (underlying == underlying05) return 5;

        return type(uint256).max;
    }

    function getSymbolHashIndex(bytes32 symbolHash) internal view returns (uint256) {
        if (symbolHash == symbolHash00) return 0;
        if (symbolHash == symbolHash01) return 1;
        if (symbolHash == symbolHash02) return 2;
        if (symbolHash == symbolHash03) return 3;
        if (symbolHash == symbolHash04) return 4;
        if (symbolHash == symbolHash05) return 5;

        return type(uint256).max;
    }

    /**
     * @notice get the i-th config, according to the order they were passed in originally
     * @param i the index of the config to get
     * @return config the config object
     */
    function getTokenConfig(uint256 i) public view returns (TokenConfig memory config) {
        require(i < numTokens, "Token config not found");

        if (i == 0)
            return
                TokenConfig({
                    cToken: cToken00,
                    underlying: underlying00,
                    symbolHash: symbolHash00,
                    baseUnit: baseUnit00,
                    priceSource: priceSource00,
                    fixedPrice: fixedPrice00,
                    uniswapMarket: uniswapMarket00,
                    isUniswapReversed: isUniswapReversed00
                });
        if (i == 1)
            return
                TokenConfig({
                    cToken: cToken01,
                    underlying: underlying01,
                    symbolHash: symbolHash01,
                    baseUnit: baseUnit01,
                    priceSource: priceSource01,
                    fixedPrice: fixedPrice01,
                    uniswapMarket: uniswapMarket01,
                    isUniswapReversed: isUniswapReversed01
                });
        if (i == 2)
            return
                TokenConfig({
                    cToken: cToken02,
                    underlying: underlying02,
                    symbolHash: symbolHash02,
                    baseUnit: baseUnit02,
                    priceSource: priceSource02,
                    fixedPrice: fixedPrice02,
                    uniswapMarket: uniswapMarket02,
                    isUniswapReversed: isUniswapReversed02
                });
        if (i == 3)
            return
                TokenConfig({
                    cToken: cToken03,
                    underlying: underlying03,
                    symbolHash: symbolHash03,
                    baseUnit: baseUnit03,
                    priceSource: priceSource03,
                    fixedPrice: fixedPrice03,
                    uniswapMarket: uniswapMarket03,
                    isUniswapReversed: isUniswapReversed03
                });
        if (i == 4)
            return
                TokenConfig({
                    cToken: cToken04,
                    underlying: underlying04,
                    symbolHash: symbolHash04,
                    baseUnit: baseUnit04,
                    priceSource: priceSource04,
                    fixedPrice: fixedPrice04,
                    uniswapMarket: uniswapMarket04,
                    isUniswapReversed: isUniswapReversed04
                });
        if (i == 5)
            return
                TokenConfig({
                    cToken: cToken05,
                    underlying: underlying05,
                    symbolHash: symbolHash05,
                    baseUnit: baseUnit05,
                    priceSource: priceSource05,
                    fixedPrice: fixedPrice05,
                    uniswapMarket: uniswapMarket05,
                    isUniswapReversed: isUniswapReversed05
                });
    }

    /**
     * @notice get the config for symbol
     * @param symbol the symbol of the config to get
     * @return the config object
     */
    function getTokenConfigBySymbol(string memory symbol) public view returns (TokenConfig memory) {
        return getTokenConfigBySymbolHash(keccak256(abi.encodePacked(symbol)));
    }

    /**
     * @notice get the config for the symbolHash
     * @param symbolHash the keccack256 of the symbol of the config to get
     * @return the config object
     */
    function getTokenConfigBySymbolHash(bytes32 symbolHash) public view returns (TokenConfig memory) {
        uint256 index = getSymbolHashIndex(symbolHash);
        if (index != type(uint256).max) {
            return getTokenConfig(index);
        }

        revert("Token config not found");
    }

    /**
     * @notice get the config for the cToken
     * @dev If a config for the cToken is not found, falls back to searching for the underlying.
     * @param cToken the address of the cToken of the config to get
     * @return the config object
     */
    function getTokenConfigByCToken(address cToken) public view returns (TokenConfig memory) {
        uint256 index = getCTokenIndex(cToken);
        if (index != type(uint256).max) {
            return getTokenConfig(index);
        }

        return getTokenConfigByUnderlying(IcERC20(cToken).underlying());
    }

    /**
     * @notice get the config for an underlying asset
     * @param underlying the address of the underlying asset of the config to get
     * @return the config object
     */
    function getTokenConfigByUnderlying(address underlying) public view returns (TokenConfig memory) {
        uint256 index = getUnderlyingIndex(underlying);
        if (index != type(uint256).max) {
            return getTokenConfig(index);
        }

        revert("Token config not found");
    }
}
