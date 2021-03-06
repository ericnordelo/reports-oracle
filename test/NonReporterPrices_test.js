const PriceOracleData = artifacts.require('PriceOracleData');
const UniswapAnchoredView = artifacts.require('UniswapAnchoredView');
const MockUniswapTokenPair = artifacts.require('MockUniswapTokenPair');

const { time } = require('@openzeppelin/test-helpers');

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function keccak256(str) {
  return web3.utils.keccak256(str);
}

function uint(n) {
  return web3.utils.toBN(n).toString();
}

const PriceSource = {
  FIXED_ETH: 0,
  FIXED_USD: 1,
  REPORTER: 2,
};

describe('UniswapAnchoredView', () => {
  it('handles fixed_usd prices', async () => {
    const USDC = {
      cToken: address(1),
      underlying: address(2),
      symbolHash: keccak256('USDC'),
      baseUnit: uint(1e6),
      priceSource: PriceSource.FIXED_USD,
      fixedPrice: uint(1e6),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };
    const USDT = {
      cToken: address(3),
      underlying: address(4),
      symbolHash: keccak256('USDT'),
      baseUnit: uint(1e6),
      priceSource: PriceSource.FIXED_USD,
      fixedPrice: uint(1e6),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };

    const priceData = await PriceOracleData.new();
    const oracle = await UniswapAnchoredView.new(priceData.address, address(0), 0, 0, [USDC, USDT]);

    expect((await oracle.price('USDC')).toNumber()).to.be.equal(1e6);
    expect((await oracle.price('USDT')).toNumber()).to.be.equal(1e6);
  });

  it('reverts fixed_eth prices if no ETH price', async () => {
    const SAI = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('SAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: uint(5285551943761727),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };

    const priceData = await PriceOracleData.new();
    const oracle = await UniswapAnchoredView.new(priceData.address, address(0), 0, 0, [SAI]);

    await expect(oracle.price('SAI')).to.be.revertedWith('ETH price not set, cannot convert to dollars');
  });

  it('reverts if ETH has no uniswap market', async () => {
    // This test for some reason is breaking coverage in CI, skip for now
    const ETH = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('ETH'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: address(0),
      isUniswapReversed: true,
    };
    const SAI = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('SAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: uint(5285551943761727),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };

    const priceData = await PriceOracleData.new();

    await expect(UniswapAnchoredView.new(priceData.address, address(0), 0, 0, [ETH, SAI])).to.be.revertedWith(
      'Reported prices must have an anchor'
    );
  });

  it('reverts if non-reporter has a uniswap market', async () => {
    const ETH = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('ETH'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: 14,
      uniswapMarket: address(112),
      isUniswapReversed: true,
    };
    const SAI = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('SAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: uint(5285551943761727),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };

    const priceData = await PriceOracleData.new();

    await expect(UniswapAnchoredView.new(priceData.address, address(0), 0, 0, [ETH, SAI])).to.be.revertedWith(
      'Only reported prices utilize an anchor'
    );
  });

  it('handles fixed_eth prices', async () => {
    const usdc_eth_pair = await MockUniswapTokenPair.new(
      '1865335786147',
      '8202340665419053945756',
      '1593755855',
      '119785032308978310142960133641565753500432674230537',
      '5820053774558372823476814618189'
    );

    const reporter = '0xfCEAdAFab14d46e20144F48824d0C09B1a03F2BC';

    const messages = [
      '0x0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000005efebe9800000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000d84ec180000000000000000000000000000000000000000000000000000000000000006707269636573000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000',
    ];

    const signatures = [
      '0xb8ba87c37228468f9d107a97eeb92ebd49a50993669cab1737fea77e5b884f2591affbf4058bcfa29e38756021deeafaeeab7a5c4f5ce584c7d1e12346c88d4e000000000000000000000000000000000000000000000000000000000000001b',
    ];

    const ETH = {
      cToken: address(5),
      underlying: address(6),
      symbolHash: keccak256('ETH'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: usdc_eth_pair.address,
      isUniswapReversed: true,
    };
    const SAI = {
      cToken: address(7),
      underlying: address(8),
      symbolHash: keccak256('SAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: uint(5285551943761727),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    };

    const priceData = await PriceOracleData.new();
    const oracle = await UniswapAnchoredView.new(priceData.address, reporter, uint(20e16), 60, [ETH, SAI]);

    await expect(oracle.price('SAI')).to.be.revertedWith('ETH price not set, cannot convert to dollars');

    await time.increase(30 * 60);
    await oracle.postPrices(messages, signatures, ['ETH']);

    expect((await oracle.price('ETH')).toNumber()).to.be.equal(226815000);
    expect((await oracle.price('SAI')).toNumber()).to.be.equal(1198842);
  });
});
