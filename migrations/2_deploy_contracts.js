var LibraToken = artifacts.require("./LibraToken.sol");
var Whitelist = artifacts.require("./Whitelist.sol");
var LibraTokenSale = artifacts.require("./LibraTokenSale.sol");

module.exports = function (deployer) {
    deployer.deploy(LibraToken)
        .then(function () {
            return deployer.deploy(Whitelist);
        })
        .then(function () {
            deployer.link(Whitelist, LibraTokenSale);
            return deployer.deploy(LibraTokenSale, 10000, "0x627306090abaB3A6e1400e9345bC60c78a8BEf57", LibraToken.address, Date.now(), 0, Date.now() + 100000, 100);
    });
};
