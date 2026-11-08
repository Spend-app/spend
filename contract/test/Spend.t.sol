// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Spend.sol";

// ============ Mocks for Mezo ============

contract MockMUSD is IMUSD {
    string public name = "Mezo USD";
    string public symbol = "MUSD";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "Low bal");
        balanceOf[from] -= amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Low bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "Low allowance");
            allowance[from][msg.sender] -= amount;
        }
        require(balanceOf[from] >= amount, "Low bal");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract MockPriceFeed is IPriceFeed {
    uint256 public price = 50_000e18; // $50,000 per BTC

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}

contract MockTroveManager is ITroveManager {
    TroveStatus public status = TroveStatus.active;
    uint256 public coll;
    uint256 public principal;
    uint256 public interest;
    uint16 public rateBps = 100; // 1%
    bool public isRecovery = false;

    function setTrove(uint256 _coll, uint256 _principal) external {
        coll = _coll;
        principal = _principal;
    }

    function setStatus(TroveStatus _status) external {
        status = _status;
    }

    function setRecoveryMode(bool _isRec) external {
        isRecovery = _isRec;
    }

    function getCurrentICR(address, uint256 _price) external view returns (uint256) {
        if (principal == 0) return type(uint256).max;
        return (coll * _price) / (principal + 200e18);
    }

    function getNominalICR(address) external view returns (uint256) {
        if (principal == 0) return type(uint256).max;
        return (coll * 1e20) / (principal + 200e18);
    }

    function getTCR(uint256) external pure returns (uint256) {
        return 200e16; // 200%
    }

    function checkRecoveryMode(uint256) external view returns (bool) {
        return isRecovery;
    }

    function getEntireDebtAndColl(address) external view returns (
        uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        return (coll, principal, interest, 0, 0, 0);
    }

    function getTroveColl(address) external view returns (uint256) {
        return coll;
    }

    function getTrovePrincipal(address) external view returns (uint256) {
        return principal;
    }

    function getTroveInterestOwed(address) external view returns (uint256) {
        return interest;
    }

    function getTroveInterestRate(address) external view returns (uint16) {
        return rateBps;
    }

    function getTroveStatus(address) external view returns (TroveStatus) {
        return status;
    }
}

contract MockBorrowerOperations is IBorrowerOperations {
    MockTroveManager public tm;
    MockMUSD public musd;

    uint256 public constant MCR = 110e16; // 110%
    uint256 public constant CCR = 150e16; // 150%
    uint256 public constant minNetDebt = 1800e18;
    uint256 public constant MUSD_GAS_COMPENSATION = 200e18;
    uint256 public constant borrowingRate = 1e15; // 0.1%

    constructor(address _tm, address _musd) {
        tm = MockTroveManager(_tm);
        musd = MockMUSD(_musd);
    }

    function openTrove(uint256 _debtAmount, address, address) external payable {
        tm.setTrove(msg.value, _debtAmount);
        musd.mint(msg.sender, _debtAmount);
    }

    function addColl(address, address) external payable {
        tm.setTrove(tm.coll() + msg.value, tm.principal());
    }

    function withdrawColl(uint256 _amount, address, address) external {
        require(tm.coll() >= _amount, "Low coll");
        tm.setTrove(tm.coll() - _amount, tm.principal());
        (bool ok, ) = msg.sender.call{value: _amount}("");
        require(ok, "ETH transfer failed");
    }

    function withdrawMUSD(uint256 _amount, address, address) external {
        tm.setTrove(tm.coll(), tm.principal() + _amount);
        musd.mint(msg.sender, _amount);
    }

    function repayMUSD(uint256 _amount, address, address) external {
        require(tm.principal() >= _amount, "Too much repay");
        tm.setTrove(tm.coll(), tm.principal() - _amount);
        musd.burn(msg.sender, _amount);
    }

    function adjustTrove(
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address,
        address
    ) external payable {
        uint256 newColl = tm.coll() + msg.value - _collWithdrawal;
        uint256 newDebt = _isDebtIncrease ? tm.principal() + _debtChange : tm.principal() - _debtChange;
        tm.setTrove(newColl, newDebt);
        if (_isDebtIncrease && _debtChange > 0) {
            musd.mint(msg.sender, _debtChange);
        }
    }

    function closeTrove() external {}
    function refinance(address, address) external {}
    function claimCollateral() external {}

    function getBorrowingFee(uint256 _debt) external pure returns (uint256) {
        return (_debt * 1e15) / 1e18;
    }

    receive() external payable {}
}

// ============ Spend Test Suite ============

contract SpendTest is Test {
    Spend public spend;
    MockBorrowerOperations public bo;
    MockTroveManager public tm;
    MockPriceFeed public pf;
    MockMUSD public musd;

    address public owner = address(this);
    address public alice = address(0x1111);
    address public bob = address(0x2222);

    receive() external payable {}

    function setUp() public {
        tm = new MockTroveManager();
        musd = new MockMUSD();
        bo = new MockBorrowerOperations(address(tm), address(musd));
        pf = new MockPriceFeed();

        spend = new Spend(
            address(bo),
            address(tm),
            address(pf),
            address(musd)
        );

        // Open master trove: 1 BTC collateral, 2500 MUSD debt
        // Buffer is initially 2500 MUSD (> 500 MUSD bufferThreshold)
        spend.openMasterTrove{value: 1 ether}(2500e18, address(0), address(0));

        // Fund test users with BTC
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // 1. Normal Flow: Borrow and Repay with smart debt paydown
    function test_BorrowAndRepay_Normal() public {
        // Alice borrows 100 MUSD (min required collateral at $50k and 150% ICR = 0.003 BTC)
        uint256 reqBtc = spend.getRequiredBTC(100e18);
        vm.prank(alice);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        (uint256 origBtc, uint256 claim, uint256 principal, , , bool active) = spend.getUserPosition(alice);
        assertTrue(active);
        assertEq(origBtc, reqBtc);
        assertEq(claim, reqBtc);
        assertEq(principal, 100e18);

        // Alice repays after 1 day
        vm.warp(block.timestamp + 1 days);
        uint256 totalOwed = spend.getTotalOwed(alice);

        // Mint MUSD to Alice and approve
        musd.mint(alice, totalOwed);
        vm.prank(alice);
        musd.approve(address(spend), type(uint256).max);

        uint256 aliceBtcBefore = alice.balance;
        vm.prank(alice);
        spend.repay(address(0), address(0));

        assertEq(alice.balance - aliceBtcBefore, reqBtc);
        (, , , , , active) = spend.getUserPosition(alice);
        assertFalse(active);
    }

    // 2. Verdict 1: Pro-Rata Write-Down on Partial Redemption
    function test_ProRataWriteDown_OnRedemption() public {
        // Alice and Bob both borrow and deposit 0.05 BTC
        uint256 reqBtc = 0.05 ether;
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        vm.prank(bob);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        assertEq(spend.totalOriginalBtc(), 0.10 ether);

        // Simulate partial redemption: master collateral drops from 1.10 ether to 0.08 ether (20% loss on user deposits)
        // and debt is lowered to 1000 MUSD so master trove stays healthy for remaining users
        tm.setTrove(0.08 ether, 1000e18);

        // Sync write-down
        spend.syncWriteDown();

        assertEq(spend.writeDownFactor(), 80e16); // 80%

        // Alice's effective claim should now be 80% of 0.05 BTC = 0.04 BTC
        (, uint256 claim, , , , ) = spend.getUserPosition(alice);
        assertEq(claim, 0.04 ether);

        // Repaying returns the written-down 0.04 BTC claim
        uint256 totalOwed = spend.getTotalOwed(alice);
        musd.mint(alice, totalOwed);
        vm.prank(alice);
        musd.approve(address(spend), type(uint256).max);

        uint256 aliceBtcBefore = alice.balance;
        vm.prank(alice);
        spend.repay(address(0), address(0));

        assertEq(alice.balance - aliceBtcBefore, 0.04 ether);
    }

    // 3. Verdict 3: Wind-Down Exit Path (claimInWindDown) when Master Trove is Closed
    function test_WindDownExit_WhenMasterTroveClosed() public {
        uint256 reqBtc = spend.getRequiredBTC(100e18);
        vm.prank(alice);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        // Simulate Mezo liquidating master trove -> status closedByLiquidation
        tm.setStatus(ITroveManager.TroveStatus.closedByLiquidation);
        tm.setTrove(0, 0);

        // Send residual surplus directly to Spend contract (as from claimMasterCollateral / surplus pool)
        vm.deal(address(spend), reqBtc);

        // Enter wind-down
        spend.enterWindDown();
        assertTrue(spend.isInWindDown());

        // Alice calls claimInWindDown: her principal is forgiven and she exits with BTC
        uint256 aliceBtcBefore = alice.balance;
        vm.prank(alice);
        spend.claimInWindDown();

        assertEq(alice.balance - aliceBtcBefore, reqBtc);
        (, , , , , bool active) = spend.getUserPosition(alice);
        assertFalse(active);
    }

    // 4. Verdict 4: Recovery Mode Constraints
    function test_RecoveryMode_BlocksNewBorrows() public {
        tm.setRecoveryMode(true);
        uint256 reqBtc = spend.getRequiredBTC(100e18);

        vm.prank(alice);
        vm.expectRevert("Recovery mode");
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));
    }

    // 5. Internal Liquidation: Reverts when user is healthy
    function test_LiquidateUser_Healthy_Reverts() public {
        uint256 reqBtc = spend.getRequiredBTC(100e18);
        vm.prank(alice);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        // Alice's ICR is 150%, which is >= 130% liquidationICR
        vm.prank(bob);
        vm.expectRevert("Position is healthy");
        spend.liquidateUser(alice);
    }

    // 6. Internal Liquidation: Succeeds when user is underwater (< 130% ICR)
    function test_LiquidateUser_Underwater_Succeeds() public {
        uint256 reqBtc = spend.getRequiredBTC(100e18);
        vm.prank(alice);
        spend.borrow{value: reqBtc}(100e18, address(0), address(0));

        assertEq(spend.getActiveBorrowerCount(), 1);
        assertEq(spend.totalUserPrincipal(), 100e18);
        assertEq(spend.totalOriginalBtc(), reqBtc);

        // Price drops by 25%: from $50,000 to $37,500
        // ICR was 150% -> new ICR becomes 150% * 37500 / 50000 = 112.5% (< 130%)
        pf.setPrice(37_500e18);
        assertTrue(spend.getUserICR(alice) < spend.liquidationICR());

        // Bob liquidates Alice
        vm.prank(bob);
        spend.liquidateUser(alice);

        // Alice position is wiped
        (, , , , , bool active) = spend.getUserPosition(alice);
        assertFalse(active);
        assertEq(spend.totalUserPrincipal(), 0);
        assertEq(spend.totalOriginalBtc(), 0);
        assertEq(spend.getActiveBorrowerCount(), 0);

        // Master Trove still holds the BTC collateral, creating unencumbered protocol equity
        assertEq(tm.coll(), 1 ether + reqBtc);
    }

    // 7. Active Borrowers List: Swap and pop tracking
    function test_ActiveBorrowers_Tracking() public {
        uint256 reqBtc = spend.getRequiredBTC(50e18);

        // Alice, Bob, and Charlie borrow
        vm.prank(alice);
        spend.borrow{value: reqBtc}(50e18, address(0), address(0));

        vm.prank(bob);
        spend.borrow{value: reqBtc}(50e18, address(0), address(0));

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 5 ether);
        vm.prank(charlie);
        spend.borrow{value: reqBtc}(50e18, address(0), address(0));

        assertEq(spend.getActiveBorrowerCount(), 3);
        address[] memory borrowers = spend.getActiveBorrowers();
        assertEq(borrowers[0], alice);
        assertEq(borrowers[1], bob);
        assertEq(borrowers[2], charlie);

        // Bob repays his loan
        uint256 owedBob = spend.getTotalOwed(bob);
        musd.mint(bob, owedBob);
        vm.prank(bob);
        musd.approve(address(spend), type(uint256).max);
        vm.prank(bob);
        spend.repay(address(0), address(0));

        // Bob removed, Charlie swapped into Bob's slot
        assertEq(spend.getActiveBorrowerCount(), 2);
        borrowers = spend.getActiveBorrowers();
        assertEq(borrowers[0], alice);
        assertEq(borrowers[1], charlie);
    }
}
