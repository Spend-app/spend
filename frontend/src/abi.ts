import { parseAbi } from "viem";

/**
 * Spend Protocol Contract ABI (Spend.sol)
 * Wave 1 Micro-Borrowing Middleware for Mezo
 */
export const spendAbi = parseAbi([
  // Core Views
  "function borrowerOperations() external view returns (address)",
  "function troveManager() external view returns (address)",
  "function priceFeed() external view returns (address)",
  "function musd() external view returns (address)",
  "function owner() external view returns (address)",
  "function paused() external view returns (bool)",
  "function masterOpened() external view returns (bool)",
  "function DECIMAL_PRECISION() external view returns (uint256)",
  "function minUserICR() external view returns (uint256)",
  "function pauseICR() external view returns (uint256)",
  "function minBorrow() external view returns (uint256)",
  "function maxBorrow() external view returns (uint256)",
  "function bufferThreshold() external view returns (uint256)",
  "function originationFeeBps() external view returns (uint256)",
  "function BPS() external view returns (uint256)",
  "function userInterestRate() external view returns (uint256)",
  "function totalUserPrincipal() external view returns (uint256)",
  "function grossFees() external view returns (uint256)",
  "function masterOpenedRateBps() external view returns (uint16)",
  "function positions(address) external view returns (uint256 btcContributed, uint256 principal, uint256 startTime, bool active)",

  // Protocol Views
  "function getMasterICR() external view returns (uint256)",
  "function getMasterTCR() external view returns (uint256)",
  "function isRecoveryMode() external view returns (bool)",
  "function getCashBuffer() external view returns (uint256)",
  "function getPrice() external view returns (uint256)",
  "function getRequiredBTC(uint256 musdAmount) external view returns (uint256)",
  "function getMasterTroveState() external view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getMasterInterestRateBps() external view returns (uint16)",
  "function getMasterBorrowingFee(uint256 debt) external view returns (uint256)",
  "function getMasterMinNetDebt() external view returns (uint256)",
  "function getUserPosition(address user) external view returns (uint256 btcContributed, uint256 principal, uint256 accruedInterest, uint256 totalOwed, bool active)",
  "function getTotalOwed(address user) external view returns (uint256)",
  "function getUserICR(address user) external view returns (uint256)",

  // User Mutators
  "function borrow(uint256 musdAmount, address upperHint, address lowerHint) external payable",
  "function repay(address upperHint, address lowerHint) external",

  // Owner Mutators
  "function openMasterTrove(uint256 debtAmount, address upperHint, address lowerHint) external payable",
  "function addCollateral(address upperHint, address lowerHint) external payable",
  "function increaseMasterDebt(uint256 debtIncrease, address upperHint, address lowerHint) external",
  "function decreaseMasterDebt(uint256 amount, address upperHint, address lowerHint) external",
  "function refinanceMasterDebt(address upperHint, address lowerHint) external",
  "function claimMasterCollateral() external",
  "function closeMasterTrove() external",
  "function extractMUSD(address to, uint256 amount) external",
  "function withdrawBTC(address payable to, uint256 amount) external",
  "function setPaused(bool _paused) external",
  "function setMinUserICR(uint256 _icr) external",
  "function setPauseICR(uint256 _icr) external",
  "function setBorrowLimits(uint256 _min, uint256 _max) external",
  "function setBufferThreshold(uint256 _threshold) external",
  "function setOriginationFeeBps(uint256 _bps) external",
  "function setUserInterestRate(uint256 _rate) external",
  "function transferOwnership(address newOwner) external",
  "function withdrawFees(address to, uint256 amount) external",

  // Events
  "event MasterTroveOpened(uint256 debtAmount, uint256 collateral, uint16 interestRateBps)",
  "event MasterDebtIncreased(uint256 amount)",
  "event MasterDebtDecreased(uint256 amount)",
  "event MasterTroveRefinanced(uint16 oldRateBps, uint16 newRateBps)",
  "event MasterCollateralClaimed()",
  "event Borrowed(address indexed user, uint256 musdReceived, uint256 btcDeposited, uint256 fee, uint256 principal)",
  "event Repaid(address indexed user, uint256 musdPaid, uint256 btcReturned)",
  "event FeesWithdrawn(address indexed to, uint256 amount)",
  "event MUSDWithdrawn(address indexed to, uint256 amount)",
  "event BTCWithdrawn(address indexed to, uint256 amount)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event Paused(bool status)",
]);

/**
 * Standard ERC-20 ABI for MUSD token interactions
 */
export const erc20Abi = parseAbi([
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

/**
 * Helper ABIs for Mezo Hint calculation
 */
export const hintHelpersAbi = parseAbi([
  "function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed) external view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)",
]);

export const sortedTrovesAbi = parseAbi([
  "function findInsertPosition(uint256 nicr, address upperHint, address lowerHint) external view returns (address upper, address lower)",
  "function validInsertPosition(uint256 nicr, address upperHint, address lowerHint) external view returns (bool)",
]);

export default spendAbi;
