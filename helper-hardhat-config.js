const { time } = require('@openzeppelin/test-helpers');

const PriceSource = {
  FIXED_ETH: 0,
  FIXED_USD: 1,
  REPORTER: 2,
};

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

const networkConfig = {
  1337: {
    name: 'localhost',
  },
  31337: {
    name: 'hardhat',
    config: {
      anchorMantissa: String(1e17), // 10 percent
      anchorPeriod: time.duration.hours(1).toString(),
      tokenConfigs: [
        {
          cToken: address(1),
          underlying: address(1),
          symbolHash: web3.utils.keccak256('ETH'),
          baseUnit: String(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: address(9),
          isUniswapReversed: true,
        },
      ],
    },
  },
  56: {
    name: 'bsc',
  },
  4: {
    name: 'rinkeby',
  },
  80001: {
    name: 'mumbai',
  },
  137: {
    name: 'polygon',
  },
};

module.exports = {
  networkConfig,
};
