import ether from 'zeppelin-solidity/test/helpers/ether';
import {increaseTimeTo} from 'zeppelin-solidity/test/helpers/increaseTime';

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .should();

const LibraTokenSale = artifacts.require('LibraTokenSale');
const LibraToken = artifacts.require('LibraToken');

contract('WhitelistedCrowdsale', function ([_, wallet, authorized, unauthorized, anotherAuthorized]) {
    const rate = new BigNumber('1e4').div(ether(1));
    const value = ether(42);
    const tokenSupply = new BigNumber('1e26');

    describe('single user whitelisting', function () {
        beforeEach(async function () {
            this.token = await LibraToken.new();
            this.crowdsale = await LibraTokenSale.new(rate, wallet, this.token.address, Date.now(), 0, Date.now() + 100000, 100);
            await this.token.transfer(this.crowdsale.address, tokenSupply);
            await this.crowdsale.addToWhitelist(authorized);
        });

        describe('accepting deposits', function () {
            
            it('should reject payments to whitelisted before deposit phase starts', async function () {
                await this.crowdsale.send(value).should.be.rejected;
                await this.crowdsale.send({ value: value, from: authorized }).should.be.rejected;
                await this.crowdsale.send({ value: value, from: unauthorized }).should.be.rejected;
            });
            
            it('should accept deposits to whitelisted after deposit phase starts', async function () {
                await increaseTimeTo(1525176732);
                await this.crowdsale.send({ value: value, from: authorized }).should.be.fulfilled;
            });
            
            it('should reject payments to not whitelisted after deposit phase starts', async function () {
                await this.crowdsale.send(value).should.be.rejected;
                await this.crowdsale.send({ value: value, from: unauthorized }).should.be.rejected;
            });

            it('should reject payments to addresses removed from whitelist', async function () {
                this.crowdsale.balance.should.equal(value);
                await this.crowdsale.removeFromWhitelist(authorized);
                this.crowdsale.balance.should.equal(0);
                await this.crowdsale.send({ value: value, from: authorized }).should.be.rejected;
            });
        });

    //     describe('collecting tokens', function () {
    //         it('should accept deposits to whitelisted (from whichever buyers)', async function () {
    //             await this.crowdsale.send({ value: value, from: authorized }).should.be.fulfilled;
    //         });

    //         it('should reject payments to not whitelisted (from whichever buyers)', async function () {
    //             await this.crowdsale.send(value).should.be.rejected;
    //             await this.crowdsale.send({ value: value, from: unauthorized }).should.be.rejected;
    //         });

    //         it('should reject collection before end time', async function () {
    //             await this.crowdsale.collectTokens({ value: 0, from: authorized }).should.be.rejected;
    //         });

    //         it('should accept collection after end time', async function () {
    //             await increaseTimeTo(1526299932); // 05/14/2018 12:12:12
    //             await this.crowdsale.collectTokens({ value: 0, from: authorized }).should.be.fulfilled;
    //             this.token.balanceOf(authorized).should.equal(value.times(rate));
    //         });
    //     });

    //     describe('reporting whitelisted', function () {
    //         it('should correctly report whitelisted addresses', async function () {
    //             let isAuthorized = await this.crowdsale.whitelist(authorized);
    //             isAuthorized.should.equal(true);
    //             let isntAuthorized = await this.crowdsale.whitelist(unauthorized);
    //             isntAuthorized.should.equal(false);
    //         });
    //     });
    // });

    // describe('many user whitelisting', function () {
    //     beforeEach(async function () {
    //         this.token = await LibraToken.new();
    //         this.crowdsale = await LibraTokenSale.new(rate, wallet, this.token.address);
    //         await this.token.transfer(this.crowdsale.address, tokenSupply);
    //         await this.crowdsale.addManyToWhitelist([authorized, anotherAuthorized]);
    //     });

    //     describe('accepting payments', function () {
    //         it('should accept deposits from whitelisted (from whichever buyers)', async function () {
    //             await this.crowdsale.send({ value: value, from: authorized }).should.be.fulfilled;
    //             await this.crowdsale.send(authorized, { value: value, from: unauthorized }).should.be.fulfilled;
    //             await this.crowdsale.send({ value: value, from: anotherAuthorized }).should.be.fulfilled;
    //         });

    //         it('should reject payments to not whitelisted (with whichever buyers)', async function () {
    //             await this.crowdsale.send(value).should.be.rejected;
    //             await this.crowdsale.send({ value: value, from: unauthorized }).should.be.rejected;
    //             await this.crowdsale.send({ value: value, from: authorized }).should.be.rejected;
    //         });

    //         it('should reject payments to addresses removed from whitelist', async function () {
    //             await this.crowdsale.removeFromWhitelist(anotherAuthorized);
    //             await this.crowdsale.buyTokens(authorized, { value: value, from: authorized }).should.be.fulfilled;
    //             await this.crowdsale.buyTokens(anotherAuthorized, { value: value, from: authorized }).should.be.rejected;
    //         });
    //     });

    //     describe('reporting whitelisted', function () {
    //         it('should correctly report whitelisted addresses', async function () {
    //             let isAuthorized = await this.crowdsale.whitelist(authorized);
    //             isAuthorized.should.equal(true);
    //             let isAnotherAuthorized = await this.crowdsale.whitelist(anotherAuthorized);
    //             isAnotherAuthorized.should.equal(true);
    //             let isntAuthorized = await this.crowdsale.whitelist(unauthorized);
    //             isntAuthorized.should.equal(false);
    //         });
    //     });
    });
});