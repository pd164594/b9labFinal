var FundingHub = artifacts.require("./contracts/FundingHub.sol");

module.exports = function(deployer) {
  deployer.deploy(FundingHub); 
}