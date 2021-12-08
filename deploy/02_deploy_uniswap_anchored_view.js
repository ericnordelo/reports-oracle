const { networkConfig } = require('../helper-hardhat-config');

module.exports = async ({ getNamedAccounts, deployments, network, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  let priceData = await ethers.getContract('PriceOracleData');
  let pair = await ethers.getContract('USDCETHPair');

  const oracleConfig = networkConfig[chainId].config;

  // ! IN PRODUCTION REPORTER SHOULD BE CHANGED
  let reporter = deployer;

  if (network.tags.local || network.tags.testnet) {
    for (const tokenConfig of oracleConfig.tokenConfigs) {
      tokenConfig.uniswapMarket = pair.address;
    }
  }

  await deploy('UniswapAnchoredView', {
    from: deployer,
    log: true,
    args: [priceData.address, reporter, ...Object.values(oracleConfig)],
  });
};

module.exports.tags = ['uniswap_anchored_view'];
module.exports.dependencies = ['price_oracle_data', 'usdc_eth_pair_mock'];
