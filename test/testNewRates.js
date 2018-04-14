import ether from 'zeppelin-solidity/test/helpers/ether';
import { increaseTimeTo, duration } from 'zeppelin-solidity/test/helpers/increaseTime';
import EVMRevert from 'zeppelin-solidity/test/helpers/EVMRevert';
import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';

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

contract('WhitelistedCrowdsale -- New Rates', function ([_, wallet, authorized, unauthorized, auth1, auth2, auth3, auth4]) {
    const rate = 10000
    const value = ether(3);
    const tokenSupplyFirst = new BigNumber('1e26');
    const tokenSupplySecond = new BigNumber('2e25');
    const tokenSupply = tokenSupplyFirst.add(tokenSupplySecond);


    

    describe('single user whitelisting', function () {
        beforeEach(async function () {
            this.token = await LibraToken.new();

            this.crowdsale = await LibraTokenSale.new(rate, wallet, this.token.address, latestTime(), latestTime() + duration.weeks(2));
            await this.token.transfer(this.crowdsale.address, tokenSupply);
            
            await this.crowdsale.addAddressToWhitelist(authorized);
            await this.crowdsale.addAddressToWhitelist(auth1);
            await this.crowdsale.addAddressesToWhitelist([auth2, auth3, auth4]);
        });

        describe('change rate', function () {

            it('changing rate should also change weiCap', async function (){
                await this.crowdsale.updateRate(20000);
                const newRate = await this.crowdsale.rate.call();
                newRate.equals(20000).should.be.true;
                const tokenSupplyUnits = await this.crowdsale.tokenSaleSupplyUnits.call();
                const newWeiCap = ((tokenSupplyUnits).div(newRate))
                const weiCap = await this.crowdsale.weiCap.call();
                newWeiCap.equals(weiCap).should.be.true;

            })
        });

        describe('accepting deposits', function () {

            it('should reject payments to whitelisted before deposit phase starts', async function () {
                await this.crowdsale.deposit({ value: value }).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.deposit({ value: value, from: unauthorized }).should.be.rejectedWith(EVMRevert);
            });

            it('should accept deposits to whitelisted after deposit phase starts', async function () {
                await increaseTimeTo(latestTime() + duration.days(2));
                await this.crowdsale.deposit({ value: value, from: authorized }).should.be.fulfilled;
            });

            it('should reject payments to not whitelisted after deposit phase starts', async function () {
                await this.crowdsale.deposit({ value: value }).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.deposit({ value: value, from: unauthorized }).should.be.rejectedWith(EVMRevert);
            });

            it('should reject payments to addresses removed from whitelist and refund', async function () {
                await this.crowdsale.deposit({ value: value, from: authorized }).should.be.fulfilled;
                const pre = await getBalance(this.crowdsale.address);
                pre.equals(value).should.be.true;

                await this.crowdsale.removeAddressFromWhitelist(authorized);

                const post = await getBalance(this.crowdsale.address);
                post.equals(new BigNumber(0)).should.be.true;
                await this.crowdsale.deposit({ value: value, from: authorized }).should.be.rejectedWith(EVMRevert);
            });
        });

        describe('collecting tokens', function () {
            before(async function () {
                await this.crowdsale.addAddressToWhitelist(authorized);
                await this.crowdsale.addAddressesToWhitelist([auth1, auth2, auth3, auth4]);
            });

            it('should accept deposits to whitelisted (from whichever buyers)', async function () {
                await this.crowdsale.deposit({ value: value, from: authorized }).should.be.fulfilled;
            });

            it('should reject payments to not whitelisted (from whichever buyers)', async function () {
                await this.crowdsale.deposit({ value: value }).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.deposit({ value: value, from: unauthorized }).should.be.rejectedWith(EVMRevert);
            });

            it('should reject collection before end time', async function () {
                await this.crowdsale.collectTokens({ from: authorized }).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.collectTokens({ from: unauthorized }).should.be.rejectedWith(EVMRevert);
            });

            it('should accept collection after end time and return excess tokens', async function () {
                const users = [authorized, auth1, auth2, auth3, auth4];

                const balBefore = await this.token.balanceOf(this.crowdsale.address);

                for (let i = 0; i < users.length; i++) {
                    await this.crowdsale.deposit({ value: value, from: users[i] }).should.be.fulfilled;
                    const getBal = await this.crowdsale.getDepositAmount.call({from: users[i]});
                    getBal.equals(value).should.be.true;
                }

                await increaseTimeTo(latestTime() + duration.days(2) + duration.weeks(2));

                const depositOver = await this.crowdsale.depositsClosed.call();
                depositOver.should.be.true;

                await this.crowdsale.collectTokens({ from: unauthorized }).should.be.rejectedWith(EVMRevert);

                for (let i = 0; i < users.length; i++) {

                    

                    await this.crowdsale.collectTokens({ from: users[i] }).should.be.fulfilled;
                    const balance = await this.token.balanceOf(users[i]);
                    
                    
                    balance.equals(value.times(rate)).should.be.true;
                }

                const single = await this.token.balanceOf(users[0]);

                const numUsers = await users.length

                const totalBal = balBefore - ((single.times(numUsers)))

                const balance = await this.token.balanceOf(unauthorized);
                balance.equals(new BigNumber(0)).should.be.true;


                const leftoverTokens = await this.token.balanceOf(this.crowdsale.address);            
                leftoverTokens.equals(totalBal).should.be.true;

                this.crowdsale.returnExcessTokens(unauthorized);

                const contractBalance = await getBalance(this.crowdsale.address);

                contractBalance.equals(new BigNumber(0)).should.be.true;

                const newLeftoverTokens = await this.token.balanceOf(this.crowdsale.address);    
                newLeftoverTokens.equals(new BigNumber(0)).should.be.true;

                const unauthBal = await this.token.balanceOf(unauthorized);

                unauthBal.equals(totalBal).should.be.true;

            });

            it('should accurately cap individual ETH contribution', async function () {
                const users = [authorized, auth1, auth2, auth3, auth4];

                
                await this.crowdsale.deposit({ value: value, from: users[0] }).should.be.fulfilled;
                const getBal = await this.crowdsale.getDepositAmount.call({ from: users[0] });
                getBal.equals(value).should.be.true;
            
                await this.crowdsale.updateETHCapPerAddress(1);
    
                await this.crowdsale.deposit({ value: value, from: users[1] }).should.be.rejectedWith(EVMRevert);
                

            });

        });


        describe('reporting whitelisted', function () {
            it('should correctly report whitelisted addresses', async function () {
                let isAuthorized = await this.crowdsale.whitelist(authorized);
                isAuthorized.should.equal(true);

                isAuthorized = await this.crowdsale.whitelist(auth1);
                isAuthorized.should.equal(true);

                isAuthorized = await this.crowdsale.whitelist(auth2);
                isAuthorized.should.equal(true);

                isAuthorized = await this.crowdsale.whitelist(auth3);
                isAuthorized.should.equal(true);

                isAuthorized = await this.crowdsale.whitelist(auth4);
                isAuthorized.should.equal(true);

                let isntAuthorized = await this.crowdsale.whitelist(unauthorized);
                isntAuthorized.should.equal(false);
            });
        });
    });
});