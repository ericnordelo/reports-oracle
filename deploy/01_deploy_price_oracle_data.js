module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('PriceOracleData', {
    from: deployer,
    log: true,
    args: [],
  });
};

module.exports.tags = ['price_oracle_data'];
