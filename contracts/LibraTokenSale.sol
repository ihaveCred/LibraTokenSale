pragma solidity ^0.4.19;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Whitelist.sol";
import "./LibraToken.sol";

/**
* @title LibraTokenSale
* @dev LibraTokenSale is a base contract for managing the Libra token sale,
* allowing investors to purchase tokens with ether. This contract implements
* such functionality in its most fundamental form and can be extended to provide additional
* functionality and/or custom behavior.
* The external interface represents the basic interface for purchasing tokens, and conform
* the base architecture for token sales. They are *not* intended to be modified / overriden.
* The internal interface conforms the extensible and modifiable surface of token sales. Override 
* the methods to add functionality. Consider using 'super' where appropiate to concatenate
* behavior.
*/

contract LibraTokenSale is Whitelist {
    using SafeMath for uint256;

    /** Phase 1 Start/End */

    // Need to set these block times
    uint256 depositPhaseStartTime;
    uint256 depositPhaseEndTime;
    uint256 excessPhaseStartTime;

    // The token being sold
    LibraToken public token;

    // How many LBA tokens being sold: 120,000,000 LBA 
    uint256 constant public tokenSaleSupply = (10 ** 8) + (2 * (10 ** 7));

    // How many LBA units being sold: 120,000,000 LBA * (10 ** 18) decimals
    uint256 constant public tokenSaleSupplyUnits = tokenSaleSupply * (10 ** 18);

    // Address where funds are collected
    address public wallet;

    // How many token units a buyer gets per wei or LBA tokens per ETH
    // LBA units per wei = LBA tokens per ETH 
    uint256 public rate;

    // Amount of wei raised
    uint256 public totalWeiRaised;

    // Amount of wei deposited
    uint256 public totalWeiDeposited;

    // Value of public sale token supply in wei: tokenSaleSupplyUnits / rate
    uint256 public weiCap;

    // Wei cap for each whitelisted address
    uint256 public weiCapPerAddress;

    // Check if the ETH cap is set
    bool public individualWeiCapSet = false;

    // Amount of wei deposited by an address
    mapping(address => uint256) depositAmount;

    // Number of investors 
    uint256 public numInvestors = 0;

    /**
    * Event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param beneficiary who got the tokens
    * @param value weis paid for purchase
    * @param amount amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
    * Event for deposit logging
    * @param depositor who deposited the ETH
    * @param amount amount of ETH deposited
    */
    event Deposit(address indexed depositor, uint256 amount);

    /**
    * Event for returning excess wei
    * @param _from who receives return
    * @param _value amount of wei returned
    */
    event ReturnExcessETH(address indexed _from, uint256 _value);

    /**
    * @dev Reverts if not in deposit time range or if the token sale contract does not have the appropriate token balance.
    */
    modifier onlyWhileDepositPhaseOpen {
        require(block.timestamp >= depositPhaseStartTime && block.timestamp <= depositPhaseEndTime);
        require(token.balanceOf(this) == tokenSaleSupplyUnits);
        _;
    }

    /**
    * @dev Reverts if not in processing time range. 
    */
    modifier onlyWhileProcessingPhaseOpen {
        require(block.timestamp > depositPhaseEndTime && block.timestamp < excessPhaseStartTime);
        _;
    }

    /**
    * @dev Reverts if there are unprocessed tokens
    */
    modifier onlyWhileExcessPhaseOpen {

        require(block.timestamp > excessPhaseStartTime);
        _;
    }

    /**
    * @dev Reverts if the individual cap is not set
    */
    modifier OnlyIfIndividualWeiCapSet {
        require(individualWeiCapSet == true);
        _;
    }


    /**
    * @param _rate Number of token units a buyer gets per ETH 
    * @param _wallet Address where collected funds will be forwarded to
    * @param _token Address of the token being sold
    * @param _depositPhaseStartTime unix timestamp of start time for deposit phase
    * @param _depositPhaseEndTime unix timestamp of end time for deposit phase
    */
    function LibraTokenSale(
        uint256 _rate,
        address _wallet,
        ERC20 _token,
        uint256 _depositPhaseStartTime,
        uint256 _depositPhaseEndTime,
        uint256 _excessPhaseStartTime
        ) public {

        require(_rate > 0);
        require(_wallet != address(0));
        require(_token != address(0));

        rate = _rate;
        wallet = _wallet;
        token = LibraToken(_token);

        depositPhaseStartTime = _depositPhaseStartTime;
        depositPhaseEndTime = _depositPhaseEndTime;
        excessPhaseStartTime = _excessPhaseStartTime;

        weiCap = (tokenSaleSupplyUnits).div(rate); //10 ** 8 total tokens / tokens per ETH * 10 ** 18 wei/ETH
    }

    // -----------------------------------------
    // Token sale external interface
    // -----------------------------------------

    /**
    * @dev Remove from whitelist, added refund functionality
    */
    function removeAddressFromWhitelist(address _addr) onlyOwner public returns(bool success) {
        if (super.removeAddressFromWhitelist(_addr)) {
            uint256 refundAmount = depositAmount[_addr];
            depositAmount[_addr] = 0;
            _addr.transfer(refundAmount);
            return true;
        }
    }

    /**
    * @dev Update the rate for token purchase and consequently the weiCap
    */
    function updateRate(uint256 _newRate) onlyOwner onlyWhileDepositPhaseOpen public returns(bool success) {
        rate = _newRate;
        weiCap = (tokenSaleSupplyUnits).div(rate);
        return true;
    }

    /**
    * @dev Update the weiCapPerAddress for deposits
    */
    function setWeiCapPerAddress(uint256 _newWeiCapPerAddress) onlyOwner onlyWhileProcessingPhaseOpen public returns(bool success) {
        require(_newWeiCapPerAddress > 0);
        weiCapPerAddress = _newWeiCapPerAddress;
        individualWeiCapSet = true;
        return true;
    }


    /**
    * @dev fallback function ***DO NOT OVERRIDE***
    */
    function () external payable {
        deposit();
    }

    /**
    * @dev Handles user deposit internally
    */
    function deposit() public payable onlyWhileDepositPhaseOpen onlyWhitelisted {
        address user = msg.sender;
        depositAmount[user] = depositAmount[user].add(msg.value);
        totalWeiDeposited = totalWeiDeposited.add(msg.value);
        numInvestors = numInvestors.add(1);
        Deposit(user, msg.value);
    }

    /**
    * @dev Handle user withdrawal
    */
    function withdraw() external onlyWhileDepositPhaseOpen {
        address user = msg.sender;
        uint256 withdrawAmount = depositAmount[user];
        require(withdrawAmount > 0);
        depositAmount[user] = 0;
        totalWeiDeposited = totalWeiDeposited.sub(withdrawAmount);
        numInvestors = numInvestors.sub(1);
        user.transfer(withdrawAmount);
    }

    /**
    * @dev Return excess tokens and ETH
    */
    function returnExcess(address _addr) public onlyOwner onlyWhileExcessPhaseOpen OnlyIfIndividualWeiCapSet {
        
        uint256 totalExcessTokens = token.balanceOf(this);
        require(token.transfer(_addr, totalExcessTokens));
        wallet.transfer(address(this).balance);
        
    }

    /**
    * @dev low level process ***DO NOT OVERRIDE***
    * Note: Buyers can collect tokens after depositing, even after Libra Team has revoked the buyer from whitelist (after buyer's deposit)
    */
    function collectTokens() public onlyWhileProcessingPhaseOpen OnlyIfIndividualWeiCapSet {
        address user = msg.sender;
        uint256 weiAmount = depositAmount[user];
        _preValidatePurchase(user, weiAmount);
        
        totalWeiDeposited = totalWeiDeposited.sub(weiAmount);

        uint256 refund = 0;

        if(weiAmount > weiCapPerAddress){
            refund = weiAmount.sub(weiCapPerAddress);
            weiAmount = weiCapPerAddress;
        }

        // calculate tokens purchased 
        uint256 tokens = weiAmount.mul(rate);

        // update state
        totalWeiRaised = totalWeiRaised.add(weiAmount);
        

        _processPurchase(user, tokens, refund);
        TokenPurchase(user, user, weiAmount, tokens);

        _forwardFunds(weiAmount);
    }

    /**
    * @dev low level process ***DO NOT OVERRIDE***
    * Note: Owner can collect manually distribute tokens to investors, even after Libra Team has revoked the buyer from whitelist (after buyer's deposit)
    */
    function distributeTokens(address addr) public onlyOwner onlyWhileProcessingPhaseOpen OnlyIfIndividualWeiCapSet {
        require(depositAmount[addr] > 0);
        address user = addr;
        uint256 weiAmount = depositAmount[user];
        _preValidatePurchase(user, weiAmount);
        
        totalWeiDeposited = totalWeiDeposited.sub(weiAmount);

        uint256 refund = 0;

        if(depositAmount[user] > weiCapPerAddress){
            refund = weiAmount.sub(weiCapPerAddress);
        }

        weiAmount = weiAmount.sub(refund);

        // calculate tokens purchased 
        uint256 tokens = weiAmount.mul(rate);

        // update state
        totalWeiRaised = totalWeiRaised.add(weiAmount);
        

        _processPurchase(user, tokens, refund);
        TokenPurchase(user, user, weiAmount, tokens);

        _forwardFunds(weiAmount);
    }


    // -----------------------------------------
    // Internal interface (extensible)
    // -----------------------------------------

    /**
    * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use super to concatenate validations.
    * @param user Address performing the token purchase
    * @param _weiAmount Value in wei involved in the purchase
    * Note: This function also prevents people who haven't deposited from collecting tokens
    */
    function _preValidatePurchase(address user, uint256 _weiAmount) pure internal {
        require(user != address(0));
        require(_weiAmount > 0);
    }

    /**
    * @dev Source of tokens. Override this method to modify the way in which the token sale ultimately gets and sends its tokens.
    * @param user Address performing the token purchase
    * @param _tokenAmount Number of tokens to be emitted
    */
    function _deliverTokens(address user, uint256 _tokenAmount) internal {
        require(depositAmount[user] > 0); 
        depositAmount[user] = 0; // reentrancy protection 
        require(token.transfer(user, _tokenAmount));
    }

    /**
    * @dev Refunds excess ether when processing purchase
    * @param user Address performing the token purchase
    * @param _refundAmount Amount of wei to be refunded
    */
    function _refundExcess(address user, uint256 _refundAmount) internal {
        user.transfer(_refundAmount);
        ReturnExcessETH(user, _refundAmount);
    }

    /**
    * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
    * @param user Address receiving the tokens
    * @param _tokenAmount Number of tokens to be purchased
    * @param _refundAmount Wei to be refunded
    */
    function _processPurchase(address user, uint256 _tokenAmount, uint256 _refundAmount) internal {
        _deliverTokens(user, _tokenAmount);
        if (_refundAmount > 0) {
            _refundExcess(user, _refundAmount);
        }
    }

    /**
    * @dev Determines how ETH is stored/forwarded on purchases.
    * @param value amount of wei to forward
    */
    function _forwardFunds(uint256 value) internal {
        wallet.transfer(value);
    }

    // -----------------------------------------
    // Constant functions
    // -----------------------------------------

    /**
    * @dev Checks whether the phase in which the deposits are accepted has already elapsed.
    * @return Whether deposit phase has elapsed
    */
    function depositsClosed() public view returns (bool) {
        return block.timestamp > depositPhaseEndTime;
    }

    /**
    * @dev Returns the amount of wei a user has deposited
    * @return Whether deposit phase has elapsed
    */
    function getDepositAmount() public view returns (uint256) {
        return depositAmount[msg.sender];
    }
}