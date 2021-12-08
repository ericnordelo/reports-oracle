const MockCToken = artifacts.require('MockCToken');
const UniswapConfig = artifacts.require('UniswapConfig');

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function keccak256(str) {
  return web3.utils.keccak256(str);
}

function uint(n) {
  return web3.utils.toBN(n).toString();
}

describe('UniswapConfig', () => {
  it('basically works', async () => {
    const unlistedButUnderlying = await MockCToken.new(address(4));
    const unlistedNorUnderlying = await MockCToken.new(address(5));
    const contract = await UniswapConfig.new([
      {
        cToken: address(1),
        underlying: address(0),
        symbolHash: keccak256('ETH'),
        baseUnit: uint(1e18),
        priceSource: 0,
        fixedPrice: 0,
        uniswapMarket: address(6),
        isUniswapReversed: false,
      },
      {
        cToken: address(2),
        underlying: address(3),
        symbolHash: keccak256('BTC'),
        baseUnit: uint(1e18),
        priceSource: 1,
        fixedPrice: 1,
        uniswapMarket: address(7),
        isUniswapReversed: true,
      },
      {
        cToken: unlistedButUnderlying.address,
        underlying: address(4),
        symbolHash: keccak256('REP'),
        baseUnit: uint(1e18),
        priceSource: 1,
        fixedPrice: 1,
        uniswapMarket: address(7),
        isUniswapReversed: true,
      },
    ]);

    const cfg0 = await contract.getTokenConfig(0);
    const cfg1 = await contract.getTokenConfig(1);
    const cfg2 = await contract.getTokenConfig(2);

    const cfgETH = await contract.getTokenConfigBySymbol('ETH');
    const cfgBTC = await contract.getTokenConfigBySymbol('BTC');

    const cfgCT0 = await contract.getTokenConfigByCToken(address(1));
    const cfgCT1 = await contract.getTokenConfigByCToken(address(2));
    const cfgU2 = await contract.getTokenConfigByCToken(unlistedButUnderlying.address);

    expect(cfg0).to.be.eql(cfgETH);
    expect(cfgCT0).to.be.eql(cfgETH);
    expect(cfg0).not.to.be.eql(cfg1);
    expect(cfg1).to.be.eql(cfgBTC);
    expect(cfgCT1).to.be.eql(cfgBTC);
    expect(cfgU2).to.be.eql(cfg2);
    expect(cfgCT1).to.be.eql(cfgBTC);

    await expect(contract.getTokenConfig(3)).to.be.revertedWith('Token config not found');
    await expect(contract.getTokenConfigBySymbol('COMP')).to.be.revertedWith('Token config not found');
    await expect(contract.getTokenConfigByCToken(address(3))).to.be.reverted;
    await expect(contract.getTokenConfigByCToken(unlistedNorUnderlying.address)).to.be.revertedWith(
      'Token config not found'
    );
  });

  it('returns configs exactly as specified', async () => {
    const symbols = Array(5)
      .fill(0)
      .map((_, i) => String.fromCharCode('a'.charCodeAt(0) + i));
    const configs = symbols.map((symbol, i) => {
      return {
        cToken: address(i + 1),
        underlying: address(i),
        symbolHash: keccak256(symbol),
        baseUnit: uint(1e6),
        priceSource: 0,
        fixedPrice: 1,
        uniswapMarket: address(i + 50),
        isUniswapReversed: i % 2 == 0,
      };
    });
    const contract = await UniswapConfig.new(configs);

    await Promise.all(
      configs.map(async (config, i) => {
        const cfgByIndex = await contract.getTokenConfig(i);
        const cfgBySymbol = await contract.getTokenConfigBySymbol(symbols[i]);
        const cfgByCToken = await contract.getTokenConfigByCToken(address(i + 1));
        const cfgByUnderlying = await contract.getTokenConfigByUnderlying(address(i));

        expect({
          cToken: cfgByIndex.cToken.toLowerCase(),
          underlying: cfgByIndex.underlying.toLowerCase(),
          symbolHash: cfgByIndex.symbolHash,
          baseUnit: cfgByIndex.baseUnit,
          priceSource: cfgByIndex.priceSource,
          fixedPrice: cfgByIndex.fixedPrice,
          uniswapMarket: cfgByIndex.uniswapMarket.toLowerCase(),
          isUniswapReversed: cfgByIndex.isUniswapReversed,
        }).to.be.eql({
          cToken: config.cToken,
          underlying: config.underlying,
          symbolHash: config.symbolHash,
          baseUnit: `${config.baseUnit}`,
          priceSource: `${config.priceSource}`,
          fixedPrice: `${config.fixedPrice}`,
          uniswapMarket: config.uniswapMarket,
          isUniswapReversed: config.isUniswapReversed,
        });

        expect(cfgByIndex).to.be.eql(cfgBySymbol);
        expect(cfgBySymbol).to.be.eql(cfgByCToken);
        expect(cfgByUnderlying).to.be.eql(cfgBySymbol);
      })
    );
  });
});
