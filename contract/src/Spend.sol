// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Spend
 * @notice Micro-borrowing middleware on Mezo (cash-buffer-first with solvency protection).
 *
 * Architecture:
 * - Pro-rata write-down of user BTC claims if the master Trove loses collateral.
 *   Uses a monotonically decreasing global factor: effectiveClaim = originalBtc * writeDownFactor / 1e18.
 * - Smart debt reduction: repaid MUSD tops the buffer to bufferThreshold first,
 *   then automatically pays down master debt (respecting Mezo minNetDebt).
 * - Wind-down mode: if the master Trove is closed by Mezo, recovered surplus is claimed,
 *   claims are written down pro-rata, users exit safely, and remaining debt is forgiven.
 * - Recovery Mode: new borrows are blocked; repayment respects Mezo CCR / MCR margins.
 * - Atomic borrow: uses a single adjustTrove mutation when refilling the buffer.
 */

// ============ Interfaces ============
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
    function getTroveInterestRate(address _borrower) external view returns (uint16);
    function getTroveStatus(address _borrower) external view returns (TroveStatus);
}

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

interface IMUSD {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract Spend {

    // ============ Immutables ============
    IBorrowerOperations public immutable borrowerOperations;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IMUSD public immutable musd;

    // ============ Admin & State ============
    address public owner;
    bool public paused;
    bool public masterOpened;
    bool public windDown;

    // ============ Safety Parameters & Limits ============
    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public constant BPS = 10_000;

    uint256 public minUserICR = 150e16;         // 150% min collateral ratio per user
    uint256 public liquidationICR = 130e16;     // 130% liquidation threshold
    uint256 public pauseICR = 220e16;           // Master ICR threshold to pause new borrows
    uint256 public minBorrow = 10e18;           // Minimum loan in MUSD
    uint256 public maxBorrow = 500e18;          // Maximum loan in MUSD
    uint256 public bufferThreshold = 500e18;    // Target minimum cash buffer
    uint256 public originationFeeBps = 30;      // 0.30%
    uint256 public userInterestRate = 4e16;     // 4% simple APR

    // ============ User Ledger ============
    struct Position {
        uint256 originalBtc;
        uint256 principal;
        uint256 startTime;
        bool active;
    }
    mapping(address => Position) public positions;
    address[] public activeBorrowers;
    mapping(address => uint256) private borrowerIndex;
    uint256 public totalUserPrincipal;
    uint256 public totalOriginalBtc;

    // ============ Collateral Accounting ============
    uint256 public writeDownFactor = DECIMAL_PRECISION;
    uint256 public grossFees;

    // ============ Reentrancy Guard ============
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
    event MasterCollateralClaimed(address indexed caller);
    event Borrowed(address indexed user, uint256 musdReceived, uint256 btcDeposited, uint256 fee, uint256 principal);
    event Repaid(address indexed user, uint256 musdPaid, uint256 btcReturned);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event MUSDWithdrawn(address indexed to, uint256 amount);
    event BTCWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool status);
    event WriteDownApplied(uint256 oldTotalBtcClaimed, uint256 newTotalBtcClaimed, uint256 masterCollateral);
    event WindDownEntered(address indexed caller);
    event ClaimedInWindDown(address indexed user, uint256 btcClaimed, uint256 principalForgiven);
    event UserLiquidated(
        address indexed user,
        uint256 principal,
        uint256 forfeitedBtc,
        uint256 userIcr,
        address indexed liquidator
    );
    event LiquidationICRUpdated(uint256 oldICR, uint256 newICR);

    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ============ Constructor ============
    constructor(address _borrowerOperations, address _troveManager, address _priceFeed, address _musd) {
        require(_borrowerOperations != address(0), "Zero BO");
        require(_troveManager != address(0), "Zero TM");
        require(_priceFeed != address(0), "Zero PF");
        require(_musd != address(0), "Zero MUSD");
        require(IMUSD(_musd).decimals() == 18, "MUSD 18 dec");
        borrowerOperations = IBorrowerOperations(_borrowerOperations);
        troveManager = ITroveManager(_troveManager);
        priceFeed = IPriceFeed(_priceFeed);
        musd = IMUSD(_musd);
        owner = msg.sender;
    }

    // ============ Owner: Master Trove Management ============

    function openMasterTrove(uint256 debtAmount, address upperHint, address lowerHint)
        external payable onlyOwner
    {
        require(!masterOpened, "Already opened");
        require(!windDown, "Wind-down");
        require(msg.value > 0, "Need BTC");
        borrowerOperations.openTrove{value: msg.value}(debtAmount, upperHint, lowerHint);
        masterOpened = true;
        emit MasterTroveOpened(debtAmount, msg.value, _getCurrentMasterRate());
    }

    function addCollateral(address upperHint, address lowerHint) external payable onlyOwner {
        require(masterOpened && !windDown, "Not open");
        require(msg.value > 0, "Need BTC");
        borrowerOperations.addColl{value: msg.value}(upperHint, lowerHint);
    }

    function increaseMasterDebt(uint256 debtIncrease, address upperHint, address lowerHint)
        external onlyOwner
    {
        require(masterOpened && !windDown, "Not open");
        require(debtIncrease > 0, "Zero");
        borrowerOperations.adjustTrove(0, debtIncrease, true, upperHint, lowerHint);
        emit MasterDebtIncreased(debtIncrease);
    }

    function decreaseMasterDebt(uint256 amount, address upperHint, address lowerHint)
        external onlyOwner
    {
        require(masterOpened && !windDown, "Not open");
        require(amount > 0, "Zero");
        uint256 maxPayable = _maxMasterPaydown();
        require(amount <= maxPayable, "Above Mezo minimum");
        require(musd.balanceOf(address(this)) >= amount, "Insufficient buffer");
        borrowerOperations.repayMUSD(amount, upperHint, lowerHint);
        emit MasterDebtDecreased(amount);
    }

    function refinanceMasterDebt(address upperHint, address lowerHint) external onlyOwner {
        require(masterOpened && !windDown, "Not open");
        uint16 oldRate = _getCurrentMasterRate();
        borrowerOperations.refinance(upperHint, lowerHint);
        emit MasterTroveRefinanced(oldRate, _getCurrentMasterRate());
    }

    /**
     * @notice Claims collateral surplus from Mezo's CollSurplusPool after redemptions or liquidations.
     */
    function claimMasterCollateral() external {
        borrowerOperations.claimCollateral();
        emit MasterCollateralClaimed(msg.sender);
    }

    function closeMasterTrove() external onlyOwner {
        require(totalUserPrincipal == 0, "Users still active");
        require(masterOpened && !windDown, "Not open");
        borrowerOperations.closeTrove();
        masterOpened = false;
    }

    // ============ Owner: Fund & Parameter Management ============

    function extractMUSD(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(totalUserPrincipal == 0, "Users still active");
        require(amount > 0 && amount <= musd.balanceOf(address(this)), "Invalid amount");
        require(musd.transfer(to, amount), "Transfer failed");
        if (amount >= grossFees) grossFees = 0; else grossFees -= amount;
        emit MUSDWithdrawn(to, amount);
    }

    function withdrawBTC(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(totalUserPrincipal == 0, "Users still active");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "BTC send failed");
        emit BTCWithdrawn(to, amount);
    }

    function withdrawFees(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(amount > 0 && amount <= grossFees, "Invalid amount");
        require(musd.balanceOf(address(this)) >= amount + bufferThreshold, "Buffer too low");
        uint256 price = priceFeed.fetchPrice();
        uint256 icr = troveManager.getCurrentICR(address(this), price);
        require(icr >= pauseICR, "Master ICR too low");
        grossFees -= amount;
        require(musd.transfer(to, amount), "Transfer failed");
        emit FeesWithdrawn(to, amount);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setMinUserICR(uint256 _icr) external onlyOwner {
        require(_icr >= 130e16 && _icr <= 300e16, "Out of bounds");
        require(_icr > liquidationICR, "Must be higher than liquidationICR");
        minUserICR = _icr;
    }

    function setLiquidationICR(uint256 _icr) external onlyOwner {
        require(_icr >= 115e16 && _icr <= 145e16, "Out of bounds");
        require(_icr < minUserICR, "Must be lower than minUserICR");
        emit LiquidationICRUpdated(liquidationICR, _icr);
        liquidationICR = _icr;
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

    // ============ Solvency & Pro-Rata Write-Down ============

    function _effectiveClaim(uint256 originalBtc) internal view returns (uint256) {
        return (originalBtc * writeDownFactor) / DECIMAL_PRECISION;
    }

    function _totalEffectiveClaims() internal view returns (uint256) {
        return (totalOriginalBtc * writeDownFactor) / DECIMAL_PRECISION;
    }

    /**
     * @notice Synchronizes the write-down factor if master Trove collateral was reduced by redemption/liquidation.
     */
    function syncWriteDown() external {
        _applyWriteDownIfNeeded();
    }

    function _applyWriteDownIfNeeded() internal {
        if (windDown || totalOriginalBtc == 0) return;
        (uint256 mColl, , , uint256 pendingColl, , ) = troveManager.getEntireDebtAndColl(address(this));
        uint256 available = mColl + pendingColl + address(this).balance;
        uint256 claimed = _totalEffectiveClaims();
        if (available >= claimed) return;
        uint256 newFactor = (available * DECIMAL_PRECISION) / totalOriginalBtc;
        if (newFactor >= writeDownFactor) return;
        writeDownFactor = newFactor;
        emit WriteDownApplied(claimed, _totalEffectiveClaims(), mColl);
    }

    /**
     * @notice Enters wind-down mode when the master Trove is closed by Mezo.
     */
    function enterWindDown() external {
        require(!windDown, "Already wind-down");
        ITroveManager.TroveStatus st = troveManager.getTroveStatus(address(this));
        require(
            st == ITroveManager.TroveStatus.closedByRedemption ||
            st == ITroveManager.TroveStatus.closedByLiquidation,
            "Trove not closed by Mezo"
        );
        try borrowerOperations.claimCollateral() {} catch {}
        _applyWriteDownIfNeeded();
        windDown = true;
        paused = true;
        masterOpened = false;
        emit WindDownEntered(msg.sender);
    }

    /**
     * @notice Allows users to claim their remaining BTC and exit if the protocol is in wind-down.
     */
    function claimInWindDown() external nonReentrant {
        require(windDown, "Not in wind-down");
        Position storage pos = positions[msg.sender];
        require(pos.active, "No position");
        uint256 payBtc = _effectiveClaim(pos.originalBtc);
        uint256 forgiven = pos.principal;
        totalUserPrincipal -= pos.principal;
        totalOriginalBtc -= pos.originalBtc;
        delete positions[msg.sender];
        _removeBorrower(msg.sender);
        if (payBtc > 0) {
            require(address(this).balance >= payBtc, "Short pool");
            (bool ok, ) = msg.sender.call{value: payBtc}("");
            require(ok, "Send failed");
        }
        emit ClaimedInWindDown(msg.sender, payBtc, forgiven);
    }

    // ============ Core: Borrow ============

    /**
     * @notice Borrow MUSD against BTC deposit.
     * @param musdAmount Amount of MUSD to borrow.
     * @param upperHint Mezo SortedTroves upper hint.
     * @param lowerHint Mezo SortedTroves lower hint.
     */
    function borrow(uint256 musdAmount, address upperHint, address lowerHint)
        external payable nonReentrant
    {
        require(!paused && !windDown, "Paused or wind-down");
        require(masterOpened, "Not opened");
        require(musdAmount >= minBorrow && musdAmount <= maxBorrow, "Amount out of range");
        require(!positions[msg.sender].active, "Position exists");

        uint256 price = priceFeed.fetchPrice();
        require(!troveManager.checkRecoveryMode(price), "Recovery mode");
        require(troveManager.getCurrentICR(address(this), price) >= pauseICR, "Master ICR too low");

        uint256 requiredBTC = (musdAmount * minUserICR) / price;
        require(msg.value >= requiredBTC, "Insufficient BTC");

        uint256 fee = (musdAmount * originationFeeBps) / BPS;
        uint256 musdToUser = musdAmount - fee;

        uint256 buffer = musd.balanceOf(address(this));
        uint256 need = musdToUser + bufferThreshold;
        if (buffer >= need) {
            borrowerOperations.addColl{value: msg.value}(upperHint, lowerHint);
        } else {
            uint256 toBorrow = need - buffer;
            toBorrow += borrowerOperations.getBorrowingFee(toBorrow);
            borrowerOperations.adjustTrove{value: msg.value}(0, toBorrow, true, upperHint, lowerHint);
            uint256 newICR = troveManager.getCurrentICR(address(this), price);
            require(newICR >= pauseICR, "ICR would fall too low");
        }

        require(musd.balanceOf(address(this)) >= musdToUser, "Buffer underflow");
        require(musd.transfer(msg.sender, musdToUser), "Transfer failed");

        grossFees += fee;
        positions[msg.sender] = Position({
            originalBtc: msg.value,
            principal: musdAmount,
            startTime: block.timestamp,
            active: true
        });
        totalUserPrincipal += musdAmount;
        totalOriginalBtc += msg.value;
        _addBorrower(msg.sender);

        emit Borrowed(msg.sender, musdToUser, msg.value, fee, musdAmount);
    }

    // ============ Core: Repay ============

    /**
     * @notice Repays outstanding loan in MUSD and withdraws remaining collateral.
     * @param upperHint Mezo SortedTroves upper hint.
     * @param lowerHint Mezo SortedTroves lower hint.
     */
    function repay(address upperHint, address lowerHint) external nonReentrant {
        require(!windDown, "Use claimInWindDown");
        require(troveManager.getTroveStatus(address(this)) == ITroveManager.TroveStatus.active, "ClosedByMezo");
        _applyWriteDownIfNeeded();

        Position storage pos = positions[msg.sender];
        require(pos.active, "No position");

        uint256 price = priceFeed.fetchPrice();
        uint256 interest = _accruedInterest(pos.principal, pos.startTime);
        uint256 totalOwed = pos.principal + interest;
        uint256 payBtc = _effectiveClaim(pos.originalBtc);

        totalUserPrincipal -= pos.principal;
        totalOriginalBtc -= pos.originalBtc;
        delete positions[msg.sender];
        _removeBorrower(msg.sender);

        require(musd.transferFrom(msg.sender, address(this), totalOwed), "TransferFrom failed");
        grossFees += interest;

        // Debt management: maintain cash buffer, use excess to reduce master Trove debt
        uint256 bufferNow = musd.balanceOf(address(this));
        if (bufferNow > bufferThreshold) {
            uint256 excess = bufferNow - bufferThreshold;
            uint256 maxPayable = _maxMasterPaydown();
            uint256 pay = pos.principal < excess ? pos.principal : excess;
            if (pay > maxPayable) {
                pay = maxPayable;
            }
            if (pay > 0) {
                borrowerOperations.repayMUSD(pay, upperHint, lowerHint);
                emit MasterDebtDecreased(pay);
            }
        }

        // Return collateral respecting Mezo margin requirements
        if (payBtc > 0) {
            (uint256 mColl, uint256 mPri, uint256 mInt, , , ) = troveManager.getEntireDebtAndColl(address(this));
            uint256 mDebtComp = mPri + mInt + borrowerOperations.MUSD_GAS_COMPENSATION();
            uint256 projColl = mColl > payBtc ? mColl - payBtc : 0;
            uint256 projICR = mDebtComp > 0 ? (projColl * price) / mDebtComp : type(uint256).max;
            uint256 minIcr = troveManager.checkRecoveryMode(price)
                ? borrowerOperations.CCR()
                : borrowerOperations.MCR();
            require(projICR >= minIcr, "Blocked by Mezo");
            borrowerOperations.withdrawColl(payBtc, upperHint, lowerHint);
        }

        if (payBtc > 0) {
            (bool ok, ) = msg.sender.call{value: payBtc}("");
            require(ok, "Send failed");
        }

        emit Repaid(msg.sender, totalOwed, payBtc);
    }

    // ============ Core: Liquidation ============

    /**
     * @notice Liquidates an underwater borrower position whose ICR has fallen below liquidationICR.
     * @dev Collateral is forfeited to the master reserve, bolstering master Trove ICR and equity.
     * @param user The address of the borrower to liquidate.
     */
    function liquidateUser(address user) external nonReentrant {
        require(!windDown, "Use claimInWindDown");
        require(troveManager.getTroveStatus(address(this)) == ITroveManager.TroveStatus.active, "ClosedByMezo");
        _applyWriteDownIfNeeded();

        Position storage pos = positions[user];
        require(pos.active, "No position");

        uint256 icr = getUserICR(user);
        require(icr < liquidationICR, "Position is healthy");

        uint256 principal = pos.principal;
        uint256 forfeitedBtc = pos.originalBtc;

        totalUserPrincipal -= principal;
        totalOriginalBtc -= forfeitedBtc;
        delete positions[user];
        _removeBorrower(user);

        emit UserLiquidated(user, principal, forfeitedBtc, icr, msg.sender);
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

    function getRequiredBTC(uint256 musdAmount) external view returns (uint256) {
        return (musdAmount * minUserICR) / priceFeed.fetchPrice();
    }

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
            uint256 originalBtc,
            uint256 currentBtcClaim,
            uint256 principal,
            uint256 accruedInterest,
            uint256 totalOwed,
            bool active
        )
    {
        Position memory pos = positions[user];
        if (!pos.active) {
            return (0, 0, 0, 0, 0, false);
        }
        uint256 interest = _accruedInterest(pos.principal, pos.startTime);
        uint256 claim = _effectiveClaim(pos.originalBtc);
        return (pos.originalBtc, claim, pos.principal, interest, pos.principal + interest, true);
    }

    function getTotalOwed(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.active) return 0;
        return pos.principal + _accruedInterest(pos.principal, pos.startTime);
    }

    function getUserICR(address user) public view returns (uint256) {
        Position memory pos = positions[user];
        if (!pos.active || pos.principal == 0) return type(uint256).max;
        uint256 price = priceFeed.fetchPrice();
        uint256 interest = _accruedInterest(pos.principal, pos.startTime);
        uint256 totalOwed = pos.principal + interest;
        uint256 claim = _effectiveClaim(pos.originalBtc);
        return (claim * price) / totalOwed;
    }

    function getActiveBorrowers() external view returns (address[] memory) {
        return activeBorrowers;
    }

    function getActiveBorrowerCount() external view returns (uint256) {
        return activeBorrowers.length;
    }

    function isInWindDown() external view returns (bool) {
        return windDown;
    }

    // ============ Internal Helpers ============

    function _addBorrower(address user) internal {
        borrowerIndex[user] = activeBorrowers.length;
        activeBorrowers.push(user);
    }

    function _removeBorrower(address user) internal {
        uint256 len = activeBorrowers.length;
        if (len == 0) return;
        uint256 idx = borrowerIndex[user];
        if (idx >= len || activeBorrowers[idx] != user) return;

        uint256 lastIdx = len - 1;
        if (idx != lastIdx) {
            address lastUser = activeBorrowers[lastIdx];
            activeBorrowers[idx] = lastUser;
            borrowerIndex[lastUser] = idx;
        }
        activeBorrowers.pop();
        delete borrowerIndex[user];
    }

    function _maxMasterPaydown() internal view returns (uint256) {
        uint256 principal = troveManager.getTrovePrincipal(address(this));
        uint256 minNet = borrowerOperations.minNetDebt();
        // Maintain a safe 10 MUSD cushion above minNetDebt (1,810 MUSD floor) so Mezo's strict > minimum check is never breached
        uint256 safeFloor = minNet + 10e18;
        if (principal > safeFloor) {
            return principal - safeFloor;
        }
        return 0;
    }

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
