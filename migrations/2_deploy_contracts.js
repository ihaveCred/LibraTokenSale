var LibraToken = artifacts.require("./LibraToken.sol");
var Crowdsale = artifacts.require("./LibraTokenSol.sol");

module.exports = function (deployer) {
    deployer.deploy(LibraToken).then(function () {
        return deployer.deploy(Crowdsale, 800, "0x627306090abaB3A6e1400e9345bC60c78a8BEf57", LibraToken.address);
    });
};
