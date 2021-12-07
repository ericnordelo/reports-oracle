// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "../../contracts/uniswap/UniswapAnchoredView.sol";

contract MockUniswapAnchoredView is UniswapAnchoredView {
    mapping(bytes32 => uint256) public anchorPrices;

    constructor(
        PriceOracleData priceData_,
        address reporter_,
        uint256 anchorToleranceMantissa_,
        uint256 anchorPeriod_,
        TokenConfig[] memory configs
    ) UniswapAnchoredView(priceData_, reporter_, anchorToleranceMantissa_, anchorPeriod_, configs) {}

    function setAnchorPrice(string memory symbol, uint256 price) external {
        anchorPrices[keccak256(abi.encodePacked(symbol))] = price;
    }

    function fetchAnchorPrice(
        string memory _symbol,
        TokenConfig memory config,
        uint256 _conversionFactor
    ) internal view override returns (uint256) {
        _symbol; // Shh
        _conversionFactor; // Shh
        return anchorPrices[config.symbolHash];
    }
}
