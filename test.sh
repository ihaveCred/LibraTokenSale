docker run -d -p 8545:8545 trufflesuite/ganache-cli:latest
truffle test
# docker logs $(docker ps -q)
docker stop $(docker ps -q)