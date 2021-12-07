// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

// @dev mock version of v1 price oracle, allowing manually setting return values
contract ProxyPriceOracle {
    mapping(address => uint256) public prices;

    function setUnderlyingPrice(address ctoken, uint256 price) external {
        prices[ctoken] = price;
    }

    function getUnderlyingPrice(address ctoken) external view returns (uint256) {
        return prices[ctoken];
    }
}

contract MockAnchorOracle {
    struct Anchor {
        // floor(block.number / NUM_BLOCKS_PER_PERIOD) + 1
        uint256 period;
        // Price in ETH, scaled by 10**18
        uint256 priceMantissa;
    }
    mapping(address => uint256) public assetPrices;

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    function setUnderlyingPrice(MockCToken asset, uint256 price) external {
        assetPrices[asset.underlying()] = price;
    }

    uint256 public constant NUM_BLOCKS_PER_PERIOD = 240;

    mapping(address => Anchor) public anchors;

    function setAnchorPeriod(address asset, uint256 period) external {
        // dont care about anchor price, only period
        anchors[asset] = Anchor({period: period, priceMantissa: 1e18});
    }
}

contract MockCToken {
    address public underlying;

    constructor(address underlying_) {
        underlying = underlying_;
    }
}
