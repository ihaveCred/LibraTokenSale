const HDWalletProvider = require('truffle-hdwallet-provider');
const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

module.exports = {
  networks: {
    development: {
      provider: new HDWalletProvider(mnemonic, 'http://127.0.0.1:7545/', 0),
      network_id: "*" // Match any network id,
    }
  }
};