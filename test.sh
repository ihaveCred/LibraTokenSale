docker run -d -p 8545:8545 trufflesuite/ganache-cli:latest -e 50000
truffle test
# docker logs $(docker ps -q)
docker stop $(docker ps -q)