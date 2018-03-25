require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill');

module.exports = {
  mocha: {
    useColors: true
  },
  networks: {
    development: {
      host: "localhost",
      port: 9545,
      network_id: "*" // Match any network id
    }
  }
};