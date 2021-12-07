module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  if (network.tags.local || network.tags.testnet) {
    await deploy('USDCETHPair', {
      contract: 'MockUniswapTokenPair',
      from: deployer,
      log: true,
      args: [
        '1865335786147',
        '8202340665419053945756',
        '1593755855',
        '119785032308978310142960133641565753500432674230537',
        '5820053774558372823476814618189',
      ],
    });
  }
};

module.exports.tags = ['usdc_eth_pair_mock'];
