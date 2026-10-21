// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
/**
 * @title Spend
 * @notice Wave 1 Micro-Borrowing Middleware for Mezo (Cash-buffer-first)
 *
 * Design:
 * - Contract owns one Mezo Trove.
 * - Users deposit BTC and receive small MUSD.
 * - Cash buffer is used first.
 * - New Mezo debt is created only when needed to keep buffer >= threshold after the user is paid.
 * - On user repay, MUSD stays in the cash buffer (never reduces master debt).
 * - Owner is the only one allowed to reduce master Trove debt (must stay above Mezo minimum).
 * - Exact BTC quantity the user deposited is returned on repay.
 * - Basic per-user min/max, simple interest, pause that still allows repay.
 *
 * === VERIFIED 2026-10-20 (matsnet, chainId 31611) ===
 * Addresses verified against the official mezo-org/musd-contracts v1.1.0 deployment artifacts and
 * live RPC https://rpc.test.mezo.org:
 *   BorrowerOperations : 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5   (TransparentUpgradableProxy)
 *   TroveManager       : 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0
 *   PriceFeed          : 0x86bCF0841622a5dAC14A313a15f96A95421b9366
 *   MUSD               : 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503   (OpenZeppelin ERC20Permit v5.2.0, 18 dec)
 *   HintHelpers        : 0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6
 *   SortedTroves       : 0x722E4D24FD6Ff8b0AC679450F3D91294607268fA
 *   InterestRateManager: 0xD4D6c36A592A2c5e86035A6bca1d57747a567f37
 *
 * Live protocol values: minNetDebt()=1800 MUSD, MUSD_GAS_COMPENSATION()=200 MUSD,
 *   borrowingRate()=0.1%, MCR=110%, CCR=150%, InterestRateManager.interestRate()=100 bps (1.00%).
 *
 * Units:
 * - MUSD / debt / collateral are 18-decimal fixed point.
 * - PriceFeed.fetchPrice() returns USD-per-BTC at 1e18 precision.
 * - ICR (getCurrentICR and the math here) is 1e18 precision -> 1.5e18 == 150%.
 * - NICR (SortedTroves hints) is 1e20 precision.
 *
 * Integration notes (verified behaviour):
 * - User repay() pulls MUSD via transferFrom: the user must first
 *   MUSD.approve(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503, spend, type(uint256).max).
 *   Allowance IS consumed by transferFrom unless the approved value is uint256.max.
 * - BorrowerOperations.repayMUSD()/closeTrove() BURN this contract's MUSD balance directly:
 *   no approval/transferFrom is involved for master debt repayment.
 * - Every trove operation needs (upperHint, lowerHint). Compute off-chain:
 *   nicr = btcUnits * 1e20 / (debtAmount + fee + 200e18);
 *   (hint,,) = HintHelpers.getApproxHint(nicr, 15, 42);
 *   (upper, lower) = SortedTroves.findInsertPosition(nicr, hint, hint);
 */
interface IBorrowerOperations {
    function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) external payable;
    function addColl(address _upperHint, address _lowerHint) external payable;
    function withdrawColl(uint256 _amount, address _upperHint, address _lowerHint) external;
    function withdrawMUSD(uint256 _amount, address _upperHint, address _lowerHint) external;
    function repayMUSD(uint256 _amount, address _upperHint, address _lowerHint) external;
    function adjustTrove(
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable;
    function closeTrove() external;
    function refinance(address _upperHint, address _lowerHint) external;
    function claimCollateral() external;
    // --- Views (dashboards/monitoring) ---
    function getBorrowingFee(uint256 _debt) external view returns (uint256);
    function minNetDebt() external view returns (uint256);
    function borrowingRate() external view returns (uint256);
    function MUSD_GAS_COMPENSATION() external view returns (uint256);
    function MCR() external view returns (uint256);
    function CCR() external view returns (uint256);
}
interface ITroveManager {
    enum TroveStatus { nonExistent, active, closedByOwner, closedByLiquidation, closedByRedemption }
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function getNominalICR(address _borrower) external view returns (uint256);
    function getTCR(uint256 _price) external view returns (uint256);
    function checkRecoveryMode(uint256 _price) external view returns (bool);
    function getEntireDebtAndColl(address _borrower)
        external view returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );
    function getTroveColl(address _borrower) external view returns (uint256);
    function getTrovePrincipal(address _borrower) external view returns (uint256);
    function getTroveInterestOwed(address _borrower) external view returns (uint256);
    function getTroveInterestRate(address _borrower) external view returns (uint16); // bps
    function getTroveLastInterestUpdateTime(address _borrower) external view returns (uint256);
    function getTroveMaxBorrowingCapacity(address _borrower) external view returns (uint256);
    function getTroveStatus(address _borrower) external view returns (TroveStatus);
    function getTroveOwnersCount() external view returns (uint256);
    function getTroveFromTroveOwnersArray(uint256 _index) external view returns (address);
}
interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}
interface IInterestRateManager {
    function interestRate() external view returns (uint16); // bps, fixed at open
}
interface IHintHelpers {
    /// @dev OFF-CHAIN view used by the app to compute hints before a trove operation.
    ///      Returns the nearest list node to `_CR` (nicr, 1e20 precision).
    ///      Use `hintAddress` as BOTH hints: SortedTroves.findInsertPosition(nicr, hint, hint).
    function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed)
        external view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed);
}
interface ISortedTroves {
    function findInsertPosition(uint256 nicr, address upperHint, address lowerHint)
        external view returns (address upper, address lower);
    function validInsertPosition(uint256 nicr, address upperHint, address lowerHint)
        external view returns (bool);
}
interface IMUSD {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    /// @dev EIP-2612 gasless allowance: ANYONE may relay this after `owner` signs off-chain.
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function decimals() external view returns (uint8);
}
contract Spend {
    // ============ Mezo ============
    IBorrowerOperations public immutable borrowerOperations;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IMUSD public immutable musd;
    // ============ Admin ============
    address public owner;
    bool public paused;
    bool public masterOpened;
    // ============ Safety & Limits ============
    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public minUserICR = 150e16;          // 150%
    uint256 public pauseICR = 220e16;            // pause new borrows below this (master ICR)
    uint256 public minBorrow = 10e18;            // 10 MUSD
    uint256 public maxBorrow = 500e18;           // 500 MUSD
    uint256 public bufferThreshold = 500e18;     // keep buffer at or above this after user is paid
    uint256 public originationFeeBps = 30;       // 0.30%
    uint256 public constant BPS = 10_000;
    uint256 public userInterestRate = 4e16;      // 4% APR simple (1e18 precision)
    // ============ User state ============
    struct Position {
        uint256 btcContributed; // exact BTC quantity deposited (1e18 per BTC)
        uint256 principal;      // MUSD principal owed
        uint256 startTime;      // for simple interest
        bool active;
    }
    mapping(address => Position) public positions;
    uint256 public totalUserPrincipal;
    // Gross protocol revenue (origination fees + user interest). Not net of Mezo interest.
    uint256 public grossFees;
    // Rate captured when the master trove was opened (for the ops ledger; live value via getMasterInterestRateBps).
    uint16 public masterOpenedRateBps;
    // ============ Reentrancy ============
    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "Reentrant");
        locked = 2;
        _;
        locked = 1;
    }
    // ============ Events ============
    event MasterTroveOpened(uint256 debtAmount, uint256 collateral, uint16 interestRateBps);
    event MasterDebtIncreased(uint256 amount);
    event MasterDebtDecreased(uint256 amount);
    event MasterTroveRefinanced(uint16 oldRateBps, uint16 newRateBps);
    event MasterCollateralClaimed();
    event Borrowed(address indexed user, uint256 musdReceived, uint256 btcDeposited, uint256 fee, uint256 principal);
    event Repaid(address indexed user, uint256 musdPaid, uint256 btcReturned);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event MUSDWithdrawn(address indexed to, uint256 amount);
    event BTCWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool status);
    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    // ============ Constructor ============
    constructor(
        address _borrowerOperations,
        address _troveManager,
        address _priceFeed,
        address _musd
    ) {
        require(_borrowerOperations != address(0), "Zero BO");
        require(_troveManager != address(0), "Zero TM");
        require(_priceFeed != address(0), "Zero PF");
        require(_musd != address(0), "Zero MUSD");
        require(IMUSD(_musd).decimals() == 18, "MUSD must be 18 decimals");
        borrowerOperations = IBorrowerOperations(_borrowerOperations);
        troveManager = ITroveManager(_troveManager);
        priceFeed = IPriceFeed(_priceFeed);
        musd = IMUSD(_musd);
        owner = msg.sender;
    }
    // ============ Owner: Master Trove lifecycle ============
    /**
     * @notice Open the master Trove. Mints `debtAmount` MUSD to this contract (cash buffer seed).
     * @dev Mezo charges 0.1% fee + 200 MUSD gas comp ON TOP of `debtAmount`; the trove debt is
     *      debtAmount + fee + 200e18 and ICR is checked against that composite debt.
     *      Request debtAmount = desired starting buffer (e.g. 2000e18).
     */
    function openMasterTrove(
        uint256 debtAmount,
        address upperHint,
        address lowerHint
    ) external payable onlyOwner {
        require(!masterOpened, "Already opened");
        require(msg.value > 0, "Need BTC");
        borrowerOperations.openTrove{value: msg.value}(debtAmount, upperHint, lowerHint);
        masterOpened = true;
        masterOpenedRateBps = _getCurrentMasterRate();
        emit MasterTroveOpened(debtAmount, msg.value, masterOpenedRateBps);
    }
    function addCollateral(address upperHint, address lowerHint) external payable onlyOwner {
        require(masterOpened, "Not opened");
        require(msg.value > 0, "Need BTC");
        borrowerOperations.addColl{value: msg.value}(upperHint, lowerHint);
    }
    /**
     * @notice Increase master debt (used when intentionally topping up capacity).
     * @dev maxBorrowingCapacity does NOT rise with collateral deposits (verified in Mezo's
     *      _adjustTrove: only refinance() and collateral withdrawals touch it). If this reverts
     *      with "exceeds maxBorrowingCapacity", call refinanceMasterDebt() first.
     */
    function increaseMasterDebt(
        uint256 debtIncrease,
        address upperHint,
        address lowerHint
    ) external onlyOwner {
        require(masterOpened, "Not opened");
        require(debtIncrease > 0, "Zero");
        borrowerOperations.adjustTrove(0, debtIncrease, true, upperHint, lowerHint);
        emit MasterDebtIncreased(debtIncrease);
    }
    /**
     * @notice Reduce master debt. Only owner.
     * @dev Must leave the Trove above Mezo's minNetDebt (1,800 MUSD today) and never repay the
     *      last 200 MUSD gas compensation (repayMUSD reverts past it). MUSD is BURNED from this
     *      contract's balance — no approve/transferFrom needed (verified).
     */
    function decreaseMasterDebt(
        uint256 amount,
        address upperHint,
        address lowerHint
    ) external onlyOwner {
        require(masterOpened, "Not opened");
        require(amount > 0, "Zero");
        require(musd.balanceOf(address(this)) >= amount, "Insufficient buffer");
        borrowerOperations.repayMUSD(amount, upperHint, lowerHint);
        emit MasterDebtDecreased(amount);
    }
    /**
     * @notice Refresh the fixed master interest rate and reset maxBorrowingCapacity.
     * @dev Mezo fixes the trove rate at open; refinance() re-prices to the current
     *      InterestRateManager.interestRate() and re-derives the borrowing cap.
     */
    function refinanceMasterDebt(address upperHint, address lowerHint) external onlyOwner {
        require(masterOpened, "Not opened");
        uint16 oldRate = _getCurrentMasterRate();
        borrowerOperations.refinance(upperHint, lowerHint);
        emit MasterTroveRefinanced(oldRate, _getCurrentMasterRate());
    }
    /**
     * @notice Recover collateral stranded in Mezo's CollSurplusPool by redemptions/liquidations.
     */
    function claimMasterCollateral() external onlyOwner {
        borrowerOperations.claimCollateral();
        emit MasterCollateralClaimed();
    }
    /**
     * @notice Close the master Trove completely.
     * @dev Only when no users remain. Before calling, this contract must hold >= principal +
     *      accrued interest + 200 MUSD gas comp (send extra MUSD if needed); all is BURNED on close.
     *      Collateral returns as native BTC -> extract with withdrawBTC.
     */
    function closeMasterTrove() external onlyOwner {
        require(totalUserPrincipal == 0, "Users still active");
        require(masterOpened, "Not opened");
        borrowerOperations.closeTrove();
        masterOpened = false;
    }
    /**
     * @notice Withdraw any remaining MUSD after all users have repaid and the Trove is closed (or emptied).
     * @dev Only when no user positions remain. Also clears grossFees accounting.
     *      (Renamed from the old withdrawMUSD to avoid colliding with Mezo's BorrowerOperations.withdrawMUSD.)
     */
    function extractMUSD(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(totalUserPrincipal == 0, "Users still active");
        require(amount > 0 && amount <= musd.balanceOf(address(this)), "Invalid amount");
        require(musd.transfer(to, amount), "Transfer failed");
        if (amount >= grossFees) {
            grossFees = 0;
        } else {
            grossFees -= amount;
        }
        emit MUSDWithdrawn(to, amount);
    }
    /**
     * @notice Withdraw native BTC that sits in the contract (e.g. after closeMasterTrove).
     */
    function withdrawBTC(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(totalUserPrincipal == 0, "Users still active");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "BTC send failed");
        emit BTCWithdrawn(to, amount);
    }
    // ============ Owner: Parameters (bounded) ============
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    function setMinUserICR(uint256 _icr) external onlyOwner {
        require(_icr >= 130e16 && _icr <= 300e16, "Out of bounds");
        minUserICR = _icr;
    }
    function setPauseICR(uint256 _icr) external onlyOwner {
        require(_icr >= 150e16 && _icr <= 400e16, "Out of bounds");
        pauseICR = _icr;
    }
    function setBorrowLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min >= 1e18 && _max <= 2000e18 && _min < _max, "Invalid limits");
        minBorrow = _min;
        maxBorrow = _max;
    }
    function setBufferThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold >= 100e18 && _threshold <= 5000e18, "Out of bounds");
        bufferThreshold = _threshold;
    }
    function setOriginationFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 200, "Max 2%");
        originationFeeBps = _bps;
    }
    function setUserInterestRate(uint256 _rate) external onlyOwner {
        require(_rate <= 20e16, "Max 20%");
        userInterestRate = _rate;
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    /**
     * @notice Withdraw gross fees (origination + user interest) while the system is live.
     * @dev Guarded: buffer must stay at/above threshold and master ICR must be healthy.
     *      After the Trove is closed, use extractMUSD instead.
     */
    function withdrawFees(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(amount > 0 && amount <= grossFees, "Invalid amount");
        uint256 buffer = musd.balanceOf(address(this));
        require(buffer >= amount + bufferThreshold, "Would drop buffer below threshold");
        uint256 price = priceFeed.fetchPrice();
        uint256 icr = troveManager.getCurrentICR(address(this), price);
        require(icr >= pauseICR, "Master ICR too low");
        grossFees -= amount;
        require(musd.transfer(to, amount), "Transfer failed");
        emit FeesWithdrawn(to, amount);
    }
    // ============ Core: Borrow ============
    /**
     * @notice Deposit BTC and borrow small MUSD.
     * @param musdAmount Desired principal (before fee). Must be within min/max.
     * @param upperHint / lowerHint From SortedTroves.findInsertPosition for
     *        nicr = msg.value * 1e20 / (musdAmount + fee + 200e18) (app-side, off-chain).
     * @dev The APP should quote getRequiredBTC(musdAmount) and ask the user to send a small
     *      margin above it (+1%) because price can move between quote and block.
     */
    function borrow(
        uint256 musdAmount,
        address upperHint,
        address lowerHint
    ) external payable nonReentrant {
        require(!paused, "Paused");
        require(masterOpened, "Not opened");
        require(musdAmount >= minBorrow && musdAmount <= maxBorrow, "Amount out of range");
        require(!positions[msg.sender].active, "Position exists");
        uint256 price = priceFeed.fetchPrice();
        uint256 masterICR = troveManager.getCurrentICR(address(this), price);
        require(masterICR >= pauseICR, "Master ICR too low");
        // Required BTC at minUserICR (both 1e18 precision; formula verified unit-correct).
        uint256 requiredBTC = (musdAmount * minUserICR) / price;
        require(msg.value >= requiredBTC, "Insufficient BTC");
        uint256 fee = (musdAmount * originationFeeBps) / BPS;
        uint256 musdToUser = musdAmount - fee;
        // Deposit all BTC into master Trove
        borrowerOperations.addColl{value: msg.value}(upperHint, lowerHint);
        // Ensure buffer will still be >= threshold AFTER paying the user
        uint256 buffer = musd.balanceOf(address(this));
        uint256 required = musdToUser + bufferThreshold;
        if (buffer < required) {
            uint256 toBorrow = required - buffer;
            // adjustTrove mints EXACTLY `toBorrow` MUSD to this contract (verified).
            borrowerOperations.adjustTrove(0, toBorrow, true, upperHint, lowerHint);
            uint256 newICR = troveManager.getCurrentICR(address(this), price);
            require(newICR >= pauseICR, "ICR would fall too low");
        }
        require(musd.balanceOf(address(this)) >= musdToUser, "Buffer underflow");
        require(musd.transfer(msg.sender, musdToUser), "Transfer failed");
        // Record fee as gross revenue (collected when user later repays)
        grossFees += fee;
        positions[msg.sender] = Position({
            btcContributed: msg.value,
            principal: musdAmount,
            startTime: block.timestamp,
            active: true
        });
        totalUserPrincipal += musdAmount;
        emit Borrowed(msg.sender, musdToUser, msg.value, fee, musdAmount);
    }
    // ============ Core: Repay ============
    /**
     * @notice Repay full position and receive original BTC quantity back.
     * @dev Repaid MUSD (principal + interest) stays in the cash buffer.
     *      Master Trove debt is NOT reduced here.
     *      IMPORTANT: before the first repay, the user must call
     *      MUSD.approve(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503, spend, type(uint256).max)
     *      (infinite allowance, NOT consumed by transferFrom). Approving the exact current
     *      totalOwed risks reverting when interest accrues between approval and block.
     */
    function repay(address upperHint, address lowerHint) external nonReentrant {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No position");
        uint256 principal = pos.principal;
        uint256 btcToReturn = pos.btcContributed;
        uint256 interest = _accruedInterest(principal, pos.startTime);
        uint256 totalOwed = principal + interest;
        // Effects first
        totalUserPrincipal -= principal;
        delete positions[msg.sender];
        // Pull MUSD from user
        require(musd.transferFrom(msg.sender, address(this), totalOwed), "TransferFrom failed");
        // Interest becomes gross revenue
        grossFees += interest;
        // Withdraw exact BTC quantity and send to user
        borrowerOperations.withdrawColl(btcToReturn, upperHint, lowerHint);
        (bool ok, ) = msg.sender.call{value: btcToReturn}("");
        require(ok, "BTC send failed");
        emit Repaid(msg.sender, totalOwed, btcToReturn);
    }
    // ============ Views ============
    function getMasterICR() external view returns (uint256) {
        uint256 price = priceFeed.fetchPrice();
        return troveManager.getCurrentICR(address(this), price);
    }
    function getMasterTCR() external view returns (uint256) {
        return troveManager.getTCR(priceFeed.fetchPrice());
    }
    function isRecoveryMode() external view returns (bool) {
        return troveManager.checkRecoveryMode(priceFeed.fetchPrice());
    }
    function getCashBuffer() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }
    function getPrice() external view returns (uint256) {
        return priceFeed.fetchPrice();
    }
    /**
     * @notice BTC the user must send to borrow `musdAmount` at the current price (1e18 units).
     * @dev App should add a +1% margin on top for block-to-block price drift.
     */
    function getRequiredBTC(uint256 musdAmount) external view returns (uint256) {
        return (musdAmount * minUserICR) / priceFeed.fetchPrice();
    }
    /**
     * @notice Full master trove state: collateral, debt (principal + interest), pending rewards.
     */
    function getMasterTroveState()
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        )
    {
        return troveManager.getEntireDebtAndColl(address(this));
    }
    function getMasterInterestRateBps() external view returns (uint16) {
        return troveManager.getTroveInterestRate(address(this));
    }
    function getMasterBorrowingFee(uint256 debt) external view returns (uint256) {
        return borrowerOperations.getBorrowingFee(debt);
    }
    function getMasterMinNetDebt() external view returns (uint256) {
        return borrowerOperations.minNetDebt();
    }
    function getUserPosition(address user)
        external
        view
        returns (
            uint256 btcContributed,
            uint256 principal,
            uint256 accruedInterest,
            uint256 totalOwed,
            bool active
        )
    {
        Position memory pos = positions[user];
        if (!pos.active) {
            return (0, 0, 0, 0, false);
        }
        uint256 interest = _accruedInterest(pos.principal, pos.startTime);
        return (pos.btcContributed, pos.principal, interest, pos.principal + interest, true);
    }
    function getTotalOwed(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.active) return 0;
        return pos.principal + _accruedInterest(pos.principal, pos.startTime);
    }
    function getUserICR(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.active || pos.principal == 0) return type(uint256).max;
        uint256 price = priceFeed.fetchPrice();
        uint256 interest = _accruedInterest(pos.principal, pos.startTime);
        uint256 totalOwed = pos.principal + interest;
        return (pos.btcContributed * price) / totalOwed;
    }
    // ============ Internal ============
    function _getCurrentMasterRate() internal view returns (uint16) {
        return troveManager.getTroveInterestRate(address(this));
    }
    function _accruedInterest(uint256 principal, uint256 startTime) internal view returns (uint256) {
        if (principal == 0 || startTime == 0) return 0;
        uint256 elapsed = block.timestamp - startTime;
        return (principal * userInterestRate * elapsed) / (365 days * DECIMAL_PRECISION);
    }
    receive() external payable {}
}