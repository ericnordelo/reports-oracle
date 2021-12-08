const PriceOracleData = artifacts.require('PriceOracleData');
const MockUniswapTokenPair = artifacts.require('MockUniswapTokenPair');
const UniswapAnchoredView = artifacts.require('UniswapAnchoredView');
const MockUniswapAnchoredView = artifacts.require('MockUniswapAnchoredView');

const { expectEvent, time } = require('@openzeppelin/test-helpers');

const {
  uint,
  keccak256,
  now,
  numToHex,
  address,
  sendRPC,
  fixed,
  encode,
  sign,
  encodeRotationMessage,
} = require('./helpers');

const PriceSource = {
  FIXED_ETH: 0,
  FIXED_USD: 1,
  REPORTER: 2,
};
const REPORTER_PV_KEY = '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10';
const FIXED_ETH_AMOUNT = 0.005e18;

async function setup({ isMockedView, freeze }) {
  const reporter = web3.eth.accounts.privateKeyToAccount(REPORTER_PV_KEY);
  const anchorMantissa = numToHex(1e17);
  const priceData = await PriceOracleData.new();
  const anchorPeriod = 60;
  const timestamp = Math.floor(Date.now() / 1000);

  if (freeze) {
    await sendRPC(web3, 'evm_freezeTime', [timestamp]);
  } else {
    await sendRPC(web3, 'evm_mine', [timestamp]);
  }

  const mockPair = await MockUniswapTokenPair.new(
    fixed(1.8e12),
    fixed(8.2e21),
    fixed(1.6e9),
    fixed(1.19e50),
    fixed(5.8e30)
  );

  // Initialize REP pair with values from mainnet
  const mockRepPair = await MockUniswapTokenPair.new(
    fixed(4e22),
    fixed(3e21),
    fixed(1.6e9),
    fixed(1.32e39),
    fixed(3.15e41)
  );

  const cToken = {
    ETH: address(1),
    DAI: address(2),
    REP: address(3),
    USDT: address(4),
    SAI: address(5),
    WBTC: address(6),
  };
  const dummyAddress = address(0);
  const tokenConfigs = [
    {
      cToken: cToken.ETH,
      underlying: dummyAddress,
      symbolHash: keccak256('ETH'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: mockPair.address,
      isUniswapReversed: true,
    },
    {
      cToken: cToken.DAI,
      underlying: dummyAddress,
      symbolHash: keccak256('DAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: mockPair.address,
      isUniswapReversed: false,
    },
    {
      cToken: cToken.REP,
      underlying: dummyAddress,
      symbolHash: keccak256('REP'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: mockRepPair.address,
      isUniswapReversed: false,
    },
    {
      cToken: cToken.USDT,
      underlying: dummyAddress,
      symbolHash: keccak256('USDT'),
      baseUnit: uint(1e6),
      priceSource: PriceSource.FIXED_USD,
      fixedPrice: uint(1e6),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    },
    {
      cToken: cToken.SAI,
      underlying: dummyAddress,
      symbolHash: keccak256('SAI'),
      baseUnit: uint(1e18),
      priceSource: PriceSource.FIXED_ETH,
      fixedPrice: uint(FIXED_ETH_AMOUNT),
      uniswapMarket: address(0),
      isUniswapReversed: false,
    },
    {
      cToken: cToken.WBTC,
      underlying: dummyAddress,
      symbolHash: keccak256('BTC'),
      baseUnit: uint(1e8),
      priceSource: PriceSource.REPORTER,
      fixedPrice: 0,
      uniswapMarket: mockPair.address,
      isUniswapReversed: false,
    },
  ];

  let uniswapAnchoredView;
  if (isMockedView) {
    uniswapAnchoredView = await MockUniswapAnchoredView.new(
      priceData.address,
      reporter.address,
      anchorMantissa,
      anchorPeriod,
      tokenConfigs
    );
  } else {
    uniswapAnchoredView = await UniswapAnchoredView.new(
      priceData.address,
      reporter.address,
      anchorMantissa,
      anchorPeriod,
      tokenConfigs
    );
  }

  function postPrices(timestamp, prices2dArr, symbols, signer = reporter) {
    let { messages, signatures } = prices2dArr.reduce(
      ({ messages, signatures }, prices) => {
        const signedMessages = sign(encode('prices', timestamp, prices), signer.privateKey);

        return signedMessages.reduce(
          ({ messages, signatures }, { message, signature }) => {
            return {
              messages: [...messages, message],
              signatures: [...signatures, signature],
            };
          },
          { messages, signatures }
        );
      },
      { messages: [], signatures: [] }
    );

    return uniswapAnchoredView.postPrices(messages, signatures, symbols);
  }

  return {
    anchorMantissa,
    anchorPeriod,
    cToken,
    mockPair,
    postPrices,
    priceData,
    reporter,
    timestamp,
    tokenConfigs,
    uniswapAnchoredView,
  };
}

describe('UniswapAnchoredView', () => {
  let cToken;
  let reporter;
  let anchorMantissa;
  let priceData;
  let anchorPeriod;
  let uniswapAnchoredView;
  let tokenConfigs;
  let postPrices;
  let mockPair;
  let timestamp;

  describe('postPrices', () => {
    beforeEach(async () => {
      ({ anchorMantissa, postPrices, priceData, reporter, uniswapAnchoredView } = await setup({ isMockedView: true }));
    });

    it('should not update view if sender is not reporter', async () => {
      const timestamp = now() - 5;
      const nonSource = web3.eth.accounts.privateKeyToAccount(
        '0x666ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      await uniswapAnchoredView.setAnchorPrice('ETH', 91e6);
      await postPrices(timestamp, [[['ETH', 91]]], ['ETH'], reporter);

      const tx = await postPrices(timestamp, [[['ETH', 95]]], ['ETH'], nonSource);
      expectEvent.notEmitted(tx, 'PriceGuarded');

      expect((await uniswapAnchoredView.prices(keccak256('ETH'))).toString()).to.be.equal(uint(91e6));
    });

    it('should update view if ETH price is within anchor bounds', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 91e6);
      const tx = await postPrices(timestamp, [[['ETH', 91]]], ['ETH']);

      expectEvent.notEmitted(tx, 'PriceGuarded');
      expectEvent(tx, 'PriceUpdated', { price: uint(91e6), symbol: 'ETH' });

      expect((await uniswapAnchoredView.prices(keccak256('ETH'))).toString()).to.be.equal(uint(91e6));
      expect((await priceData.getPrice(reporter.address, 'ETH')).toString()).to.be.equal(uint(91e6));
    });

    it('should update view if ERC20 price is within anchor bounds', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('REP', 17e6);
      const tx = await postPrices(timestamp, [[['REP', 17]]], ['REP']);

      expectEvent.notEmitted(tx, 'PriceGuarded');
      expectEvent(tx, 'PriceUpdated', { price: uint(17e6), symbol: 'REP' });

      expect((await uniswapAnchoredView.prices(keccak256('REP'))).toString()).to.be.equal(uint(17e6));
      expect((await priceData.getPrice(reporter.address, 'REP')).toString()).to.be.equal(uint(17e6));
    });

    it('should not update view if ETH price is below anchor bounds', async () => {
      // anchorMantissa is 1e17, so 10% tolerance
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 89.9e6);
      const tx = await postPrices(timestamp, [[['ETH', 100]]], ['ETH']);

      expectEvent.notEmitted(tx, 'PriceUpdated');
      expectEvent(tx, 'PriceGuarded', { reporter: uint(100e6), anchor: uint(89.9e6), symbol: 'ETH' });

      expect((await uniswapAnchoredView.prices(keccak256('ETH'))).toString()).to.be.equal(uint(0));
      expect((await priceData.getPrice(reporter.address, 'ETH')).toString()).to.be.equal(uint(100e6));
    });

    it('should not update view if ERC20 price is below anchor bounds', async () => {
      const timestamp = now() - 5;
      // anchorMantissa is 1e17, so 10% tolerance
      await uniswapAnchoredView.setAnchorPrice('REP', 15e6);
      const tx = await postPrices(timestamp, [[['REP', 17]]], ['REP']);

      expectEvent(tx, 'PriceGuarded', { reporter: uint(17e6), anchor: uint(15e6), symbol: 'REP' });

      expect((await uniswapAnchoredView.prices(keccak256('REP'))).toString()).to.be.equal(uint(0));
      expect((await priceData.getPrice(reporter.address, 'REP')).toString()).to.be.equal(uint(17e6));
    });

    it('should not update view if ETH price is above anchor bounds', async () => {
      // anchorMantissa is 1e17, so 10% tolerance
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 110.1e6);
      const tx = await postPrices(timestamp, [[['ETH', 100]]], ['ETH']);

      expectEvent.notEmitted(tx, 'PriceUpdated');
      expectEvent(tx, 'PriceGuarded', { reporter: uint(100e6), anchor: uint(110.1e6), symbol: 'ETH' });

      expect((await uniswapAnchoredView.prices(keccak256('ETH'))).toString()).to.be.equal(uint(0));
      expect((await priceData.getPrice(reporter.address, 'ETH')).toString()).to.be.equal(uint(100e6));
    });

    it('should not update view if ERC20 price is above anchor bounds', async () => {
      const timestamp = now() - 5;
      // anchorMantissa is 1e17, so 10% tolerance
      await uniswapAnchoredView.setAnchorPrice('REP', 19e6);
      const tx = await postPrices(timestamp, [[['REP', 17]]], ['REP']);

      expectEvent(tx, 'PriceGuarded', { reporter: uint(17e6), anchor: uint(19e6), symbol: 'REP' });

      expect((await uniswapAnchoredView.prices(keccak256('REP'))).toString()).to.be.equal(uint(0));
      expect((await priceData.getPrice(reporter.address, 'REP')).toString()).to.be.equal(uint(17e6));
    });

    it('should revert on posting arrays of messages and signatures with different lengths', async () => {
      await expect(uniswapAnchoredView.postPrices(['0xabc'], ['0x123', '0x123'], [])).to.be.revertedWith(
        'Messages and signatures must be 1:1'
      );

      await expect(uniswapAnchoredView.postPrices(['0xabc', '0xabc'], ['0x123'], [])).to.be.revertedWith(
        'Messages and signatures must be 1:1'
      );
    });

    it('should revert on posting arrays with invalid symbols', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('REP', 91e6);

      await expect(postPrices(timestamp, [[['ETH', 91]]], ['HOHO'])).to.be.revertedWith('Token config not found');

      await expect(postPrices(timestamp, [[['HOHO', 91]]], ['HOHO'])).to.be.revertedWith('Token config not found');

      await expect(
        postPrices(
          timestamp,
          [
            [
              ['ETH', 91],
              ['WBTC', 1000],
            ],
          ],
          ['ETH', 'HOHO']
        )
      ).to.be.revertedWith('Token config not found');
    });

    it('should revert on posting FIXED_USD prices', async () => {
      await expect(postPrices(now() - 5, [[['USDT', 1]]], ['USDT'])).to.be.revertedWith(
        'Only reporter prices get posted'
      );
    });

    it('should revert on posting FIXED_ETH prices', async () => {
      await expect(postPrices(now() - 5, [[['SAI', 1]]], ['SAI'])).to.be.revertedWith(
        'Only reporter prices get posted'
      );
    });
  });

  describe('getUnderlyingPrice', () => {
    // everything must return 1e36 - underlying units

    beforeEach(async () => {
      ({ cToken, postPrices, uniswapAnchoredView } = await setup({ isMockedView: true }));
    });

    it('should work correctly for USDT fixed USD price source', async () => {
      // 1 * (1e(36 - 6)) = 1e30
      let expected = new web3.utils.BN('10').pow(web3.utils.toBN('30'));
      let underlyingPrice = await uniswapAnchoredView.getUnderlyingPrice(cToken.USDT);
      expect(underlyingPrice.toString()).to.be.equal(expected.toString());
    });

    it('should return fixed ETH amount if SAI', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 200e6);
      const tx = await postPrices(timestamp, [[['ETH', 200]]], ['ETH']);

      // priceInternal:      returns 200e6 * 0.005e18 / 1e18 = 1e6
      // getUnderlyingPrice:         1e30 * 1e6 / 1e18 = 1e18
      let underlyingPrice = await uniswapAnchoredView.getUnderlyingPrice(cToken.SAI);
      expect(underlyingPrice.toString()).to.be.equal(uint(1e18));
    });

    it('should return reported ETH price', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 200e6);
      const tx = await postPrices(timestamp, [[['ETH', 200]]], ['ETH']);

      // priceInternal:      returns 200e6
      // getUnderlyingPrice: 1e30 * 200e6 / 1e18 = 200e18
      let underlyingPrice = await uniswapAnchoredView.getUnderlyingPrice(cToken.ETH);
      expect(underlyingPrice.toString()).to.be.equal(uint(200e18));
    });

    it('should return reported WBTC price', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 200e6);
      await uniswapAnchoredView.setAnchorPrice('BTC', 10000e6);

      const tx = await postPrices(
        timestamp,
        [
          [
            ['ETH', 200],
            ['BTC', 10000],
          ],
        ],
        ['ETH', 'BTC']
      );
      const btcPrice = await uniswapAnchoredView.prices(keccak256('BTC'));

      expect(btcPrice.toString()).to.be.equal(uint(10000e6));

      // priceInternal:      returns 10000e6
      // getUnderlyingPrice: 1e30 * 10000e6 / 1e8 = 1e32
      let expected = new web3.utils.BN('10').pow(web3.utils.toBN('32'));
      let underlyingPrice = await uniswapAnchoredView.getUnderlyingPrice(cToken.WBTC);
      expect(underlyingPrice.toString()).to.be.equal(expected.toString());
    });
  });

  describe('pokeWindowValues', () => {
    beforeEach(async () => {
      ({ mockPair, anchorPeriod, uniswapAnchoredView, postPrices, tokenConfigs, timestamp } = await setup({
        isMockedView: false,
        freeze: true,
      }));
    });

    it('should not update window values if not enough time elapsed', async () => {
      await time.increase(anchorPeriod - 5);

      const tx = await postPrices(timestamp, [[['ETH', 227]]], ['ETH']);

      expectEvent.notEmitted(tx, 'UniswapWindowUpdated');
    });

    it('should update window values if enough time elapsed', async () => {
      const ethHash = keccak256('ETH');
      const newObs1 = await uniswapAnchoredView.newObservations(ethHash);
      const oldObs1 = await uniswapAnchoredView.oldObservations(ethHash);

      let timestampLater = (await time.latest()).toNumber() + anchorPeriod;
      await time.increase(anchorPeriod);

      const tx1 = await postPrices(timestampLater, [[['ETH', 227]]], ['ETH']);

      expectEvent.notEmitted(tx1, 'PriceGuarded');
      let log = expectEvent(tx1, 'AnchorPriceUpdated', {});
      const updateEvent = log.args;
      expect(+updateEvent.newTimestamp).to.be.greaterThan(+updateEvent.oldTimestamp);

      // on the first update, we expect the new observation to change
      const newObs2 = await uniswapAnchoredView.newObservations(ethHash);
      const oldObs2 = await uniswapAnchoredView.oldObservations(ethHash);

      assert.isTrue(newObs2.acc > newObs1.acc);
      assert.isTrue(newObs2.timestamp > newObs1.timestamp);
      expect(oldObs2.acc.toString()).to.be.equal(oldObs1.acc.toString());
      expect(oldObs2.timestamp.toString()).to.be.equal(oldObs1.timestamp.toString());

      let timestampEvenLater = timestampLater + anchorPeriod;
      await time.increase(anchorPeriod);

      const tx2 = await postPrices(timestampEvenLater, [[['ETH', 201]]], ['ETH']);

      log = expectEvent(tx2, 'UniswapWindowUpdated', {});
      const windowUpdate = log.args;

      expect(windowUpdate.symbolHash).to.be.equal(ethHash);
      expect(timestampEvenLater).to.be.greaterThan(windowUpdate.oldTimestamp.toNumber());
      assert.isTrue(windowUpdate.newPrice > windowUpdate.oldPrice); // accumulator should always go up

      // // this time, both should change
      const newObs3 = await uniswapAnchoredView.newObservations(ethHash);
      const oldObs3 = await uniswapAnchoredView.oldObservations(ethHash);

      assert.isTrue(newObs3.acc > newObs2.acc);
      assert.isTrue(newObs3.acc > newObs2.timestamp);
      // old becomes last new
      expect(oldObs3.acc.toString()).to.be.equal(newObs2.acc.toString());
      expect(oldObs3.timestamp.toString()).to.be.equal(newObs2.timestamp.toString());

      log = expectEvent(tx2, 'AnchorPriceUpdated', {});
      const anchorPriceUpdated = log.args;

      expect(anchorPriceUpdated.symbol).to.be.equal('ETH');
      expect(anchorPriceUpdated.newTimestamp.toNumber()).to.be.greaterThan(anchorPriceUpdated.oldTimestamp.toNumber());
      expect(oldObs3.timestamp.toString()).to.be.equal(anchorPriceUpdated.oldTimestamp.toString());
    });
  });

  describe('constructor', () => {
    it('should prevent bounds from under/overflow', async () => {
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      const priceData = await PriceOracleData.new();
      const anchorPeriod = 30,
        configs = [];
      const UINT256_MAX = (1n << 256n) - 1n,
        exp = (a, b) => BigInt(a) * 10n ** BigInt(b);

      const anchorMantissa1 = exp(100, 16);
      const view1 = await UniswapAnchoredView.new(
        priceData.address,
        reporter.address,
        anchorMantissa1,
        anchorPeriod,
        configs
      );
      expect((await view1.upperBoundAnchorRatio()).toString()).to.be.equal(uint(2e18));
      expect((await view1.lowerBoundAnchorRatio()).toNumber()).to.be.equal(1);

      const anchorMantissa2 = UINT256_MAX - exp(99, 16);
      const view2 = await UniswapAnchoredView.new(
        priceData.address,
        reporter.address,
        anchorMantissa2,
        anchorPeriod,
        configs
      );
      expect((await view2.upperBoundAnchorRatio()).toString()).to.be.equal(UINT256_MAX.toString());
      expect((await view2.lowerBoundAnchorRatio()).toNumber()).to.be.equal(1);
    });

    it('should fail if baseUnit == 0', async () => {
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      const priceData = await PriceOracleData.new();
      const anchorMantissa = numToHex(1e17);

      const dummyAddress = address(0);
      const mockPair = await MockUniswapTokenPair.new(
        fixed(1.8e12),
        fixed(8.2e21),
        fixed(1.6e9),
        fixed(1.19e50),
        fixed(5.8e30)
      );
      const tokenConfigs = [
        // Set dummy address as a uniswap market address
        {
          cToken: address(1),
          underlying: dummyAddress,
          symbolHash: keccak256('ETH'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: mockPair.address,
          isUniswapReversed: true,
        },
        {
          cToken: address(2),
          underlying: dummyAddress,
          symbolHash: keccak256('DAI'),
          baseUnit: 0,
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: mockPair.address,
          isUniswapReversed: false,
        },
        {
          cToken: address(3),
          underlying: dummyAddress,
          symbolHash: keccak256('REP'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: mockPair.address,
          isUniswapReversed: false,
        },
      ];
      await expect(
        UniswapAnchoredView.new(priceData.address, reporter.address, anchorMantissa, 30, tokenConfigs)
      ).to.be.revertedWith('baseUnit must be greater than zero');
    });

    it('should fail if uniswap market is not defined', async () => {
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      const priceData = await PriceOracleData.new();
      const anchorMantissa = numToHex(1e17);

      const dummyAddress = address(0);
      const tokenConfigs = [
        // Set dummy address as a uniswap market address
        {
          cToken: address(1),
          underlying: dummyAddress,
          symbolHash: keccak256('ETH'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: dummyAddress,
          isUniswapReversed: true,
        },
        {
          cToken: address(2),
          underlying: dummyAddress,
          symbolHash: keccak256('DAI'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: address(4),
          isUniswapReversed: false,
        },
        {
          cToken: address(3),
          underlying: dummyAddress,
          symbolHash: keccak256('REP'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.REPORTER,
          fixedPrice: 0,
          uniswapMarket: address(5),
          isUniswapReversed: false,
        },
      ];
      await expect(
        UniswapAnchoredView.new(priceData.address, reporter.address, anchorMantissa, 30, tokenConfigs)
      ).to.be.revertedWith('Reported prices must have an anchor');
    });

    it('should fail if non-reporter price utilizes an anchor', async () => {
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      const priceData = await PriceOracleData.new();
      const anchorMantissa = numToHex(1e17);

      const dummyAddress = address(0);
      const tokenConfigs1 = [
        {
          cToken: address(2),
          underlying: dummyAddress,
          symbolHash: keccak256('USDT'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.FIXED_USD,
          fixedPrice: 0,
          uniswapMarket: address(5),
          isUniswapReversed: false,
        },
      ];
      await expect(
        UniswapAnchoredView.new(priceData.address, reporter.address, anchorMantissa, 30, tokenConfigs1)
      ).to.be.revertedWith('Only reported prices utilize an anchor');

      const tokenConfigs2 = [
        {
          cToken: address(2),
          underlying: dummyAddress,
          symbolHash: keccak256('USDT'),
          baseUnit: uint(1e18),
          priceSource: PriceSource.FIXED_ETH,
          fixedPrice: 0,
          uniswapMarket: address(5),
          isUniswapReversed: false,
        },
      ];
      await expect(
        UniswapAnchoredView.new(priceData.address, reporter.address, anchorMantissa, 30, tokenConfigs2)
      ).to.be.revertedWith('Only reported prices utilize an anchor');
    });

    it('basic scenario, successfully initialize observations initial state', async () => {
      ({
        reporter,
        anchorMantissa,
        priceData,
        anchorPeriod,
        uniswapAnchoredView,
        tokenConfigs,
        postPrices,
        cToken,
        mockPair,
      } = await setup({ isMockedView: true }));

      expect(await uniswapAnchoredView.reporter()).to.be.equal(reporter.address);
      expect((await uniswapAnchoredView.anchorPeriod()).toNumber()).to.be.equal(anchorPeriod);
      expect((await uniswapAnchoredView.upperBoundAnchorRatio()).toString()).to.be.equal(
        (BigInt(web3.utils.hexToNumberString(anchorMantissa)) + 10n ** BigInt(18)).toString()
      );

      expect((await uniswapAnchoredView.lowerBoundAnchorRatio()).toString()).to.be.equal(
        (10n ** BigInt(18) - BigInt(web3.utils.hexToNumberString(anchorMantissa))).toString()
      );

      await Promise.all(
        tokenConfigs.map(async (config) => {
          const oldObservation = await uniswapAnchoredView.oldObservations(config.uniswapMarket);
          const newObservation = await uniswapAnchoredView.newObservations(config.uniswapMarket);
          expect(oldObservation.timestamp.toNumber()).to.be.equal(newObservation.timestamp.toNumber());
          expect(oldObservation.acc.toString()).to.be.equal(newObservation.acc.toString());
          if (config.priceSource != PriceSource.REPORTER) {
            expect(oldObservation.acc.toNumber()).to.be.equal(0);
            expect(newObservation.acc.toNumber()).to.be.equal(0);
            expect(oldObservation.timestamp.toNumber()).to.be.equal(0);
            expect(newObservation.timestamp.toNumber()).to.be.equal(0);
          }
        })
      );
    });
  });

  describe('invalidateReporter', () => {
    beforeEach(async () => {
      ({ uniswapAnchoredView, postPrices } = await setup({ isMockedView: true }));
    });

    it('reverts if given wrong message', async () => {
      const rotationTarget = '0xAbcdef0123456789000000000000000000000005';
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      let encoded = web3.eth.abi.encodeParameters(['string', 'address'], ['stay still', rotationTarget]);
      const [signed] = sign(encoded, reporter.privateKey);

      await expect(uniswapAnchoredView.invalidateReporter(encoded, signed.signature)).to.be.revertedWith(
        "Invalid message must be 'rotate'"
      );
    });

    it('reverts if given wrong signature', async () => {
      const rotationTarget = '0xAbcdef0123456789000000000000000000000005';
      let encoded = encodeRotationMessage(rotationTarget);
      // sign rotation message with wrong key
      const [signed] = sign(encoded, '0x666ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10');

      await expect(uniswapAnchoredView.invalidateReporter(encoded, signed.signature)).to.be.revertedWith(
        'Invalidation message must come from the reporter'
      );
    });

    it('basic scenario, sets reporterInvalidated and emits ReporterInvalidated event', async () => {
      const rotationTarget = '0xAbcdef0123456789000000000000000000000005';
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      let encoded = web3.eth.abi.encodeParameters(['string', 'address'], ['rotate', rotationTarget]);
      const [signed] = sign(encoded, reporter.privateKey);

      // Check that reporterInvalidated variable is properly set
      expect(await uniswapAnchoredView.reporterInvalidated()).to.be.equal(false);
      const tx = await uniswapAnchoredView.invalidateReporter(encoded, signed.signature);
      expect(await uniswapAnchoredView.reporterInvalidated()).to.be.equal(true);

      // Check that event is emitted
      expectEvent(tx, 'ReporterInvalidated', { reporter: reporter.address });
    });

    it('basic scenario, return anchor price after reporter is invalidated', async () => {
      const timestamp = now() - 5;
      await uniswapAnchoredView.setAnchorPrice('ETH', 200e6);
      await uniswapAnchoredView.setAnchorPrice('BTC', 10000e6);

      await postPrices(
        timestamp,
        [
          [
            ['ETH', 201],
            ['BTC', 10001],
          ],
        ],
        ['ETH', 'BTC']
      );

      // Check that prices = posted prices
      const wbtcPrice1 = await uniswapAnchoredView.prices(keccak256('BTC'));
      const ethPrice1 = await uniswapAnchoredView.prices(keccak256('ETH'));
      expect(wbtcPrice1.toNumber()).to.be.equal(10001e6);
      expect(ethPrice1.toNumber()).to.be.equal(201e6);

      const rotationTarget = '0xAbcdef0123456789000000000000000000000005';
      const reporter = web3.eth.accounts.privateKeyToAccount(
        '0x177ee777e72b8c042e05ef41d1db0f17f1fcb0e8150b37cfad6993e4373bdf10'
      );
      let encoded = web3.eth.abi.encodeParameters(['string', 'address'], ['rotate', rotationTarget]);
      const [signed] = sign(encoded, reporter.privateKey);

      await uniswapAnchoredView.invalidateReporter(encoded, signed.signature);
      await postPrices(
        timestamp,
        [
          [
            ['ETH', 201],
            ['BTC', 10001],
          ],
        ],
        ['ETH', 'BTC']
      );

      // Check that prices = anchor prices
      const wbtcPrice2 = await uniswapAnchoredView.prices(keccak256('BTC'));
      const ethPrice2 = await uniswapAnchoredView.prices(keccak256('ETH'));
      expect(wbtcPrice2.toNumber()).to.be.equal(10000e6);
      expect(ethPrice2.toNumber()).to.be.equal(200e6);
    });
  });
});
