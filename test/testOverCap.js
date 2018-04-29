import ether from 'zeppelin-solidity/test/helpers/ether';
import { increaseTimeTo, duration } from 'zeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';
import EVMRevert from 'zeppelin-solidity/test/helpers/EVMRevert';
import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .should();

const LibraTokenSale = artifacts.require('LibraTokenSale');
const LibraToken = artifacts.require('LibraToken');

const promisify = (inner) =>
    new Promise((resolve, reject) =>
        inner((err, res) => {
            if (err) { reject(err) }
            resolve(res);
        })
    );

const getBalance = (account, at) =>
    promisify(cb => web3.eth.getBalance(account, at, cb));

contract('WhitelistedCrowdsale -- Over Cap', function ([_, wallet, authorized, unauthorized, auth1, auth2, auth3, auth4]) {
    const rate = new BigNumber("10000");
    const value = ether(10000);
    const tokenSupply = new BigNumber('4e25');

    describe('single user whitelisting', function () {
        beforeEach(async function () {
            this.token = await LibraToken.new(); 
            this.crowdsale = await LibraTokenSale.new(rate, wallet, this.token.address, latestTime(), latestTime() + duration.weeks(2), latestTime() + duration.weeks(4));
            await this.token.transfer(this.crowdsale.address, tokenSupply);
            
            await this.crowdsale.addAddressToWhitelist(authorized);
            await this.crowdsale.addAddressToWhitelist(auth1);
            await this.crowdsale.addAddressesToWhitelist([auth2, auth3, auth4]);
        });

        describe('collecting tokens above cap', function () {

            it('should accept collection after end time with total deposit above cap', async function () {

                const users = [authorized, auth1, auth2, auth3, auth4];

                for (let i = 0; i < users.length; i++) {
                    await this.crowdsale.deposit({ value: value, from: users[i] }).should.be.fulfilled;
                }
            
                await increaseTimeTo(latestTime() + duration.days(2) + duration.weeks(2));
                
                const weiCap = await this.crowdsale.weiCap.call();
                const numUsers = new BigNumber("5");
                const distribution = weiCap.dividedBy(numUsers);

                await this.crowdsale.setWeiCapPerAddress(distribution).should.be.fulfilled;

                await this.crowdsale.collectTokens({ from: unauthorized }).should.be.rejectedWith(EVMRevert);

                for (let i = 0; i < users.length; i++) {

                    await this.crowdsale.distributeTokens(users[i]).should.be.fulfilled;
                    const balance = await this.token.balanceOf(users[i]);

                    const individualWeiCap = await this.crowdsale.weiCapPerAddress.call();

                    const tokens = await individualWeiCap.times(rate);

                    balance.equals(tokens).should.be.true;

                }

                const balance = await this.token.balanceOf(unauthorized);
                balance.equals(new BigNumber(0)).should.be.true;



                const CrowsaleBalance = await this.token.balanceOf(this.crowdsale.address);

                const contractBalance = await getBalance(this.crowdsale.address);


                CrowsaleBalance.equals(new BigNumber(0)).should.be.true;

                contractBalance.equals(new BigNumber(0)).should.be.true;

            });
        });

    });
});