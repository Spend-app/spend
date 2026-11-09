import { parseAbi } from "viem";

export const spendAbi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function masterOpened() view returns (bool)",
  "function windDown() view returns (bool)",
  "function minUserICR() view returns (uint256)",
  "function liquidationICR() view returns (uint256)",
  "function pauseICR() view returns (uint256)",
  "function bufferThreshold() view returns (uint256)",
  "function totalUserPrincipal() view returns (uint256)",
  "function totalOriginalBtc() view returns (uint256)",
  "function writeDownFactor() view returns (uint256)",
  "function getActiveBorrowerCount() view returns (uint256)",
  "function getActiveBorrowers() view returns (address[])",
  "function getUserPosition(address user) view returns (uint256 originalBtc, uint256 effectiveClaim, uint256 principal, uint256 startTime, uint256 interest, bool active)",
  "function getUserICR(address user) view returns (uint256)",
  "function getMasterICR() view returns (uint256)",
  "function getMasterTCR() view returns (uint256)",
  "function isRecoveryMode() view returns (bool)",
  "function getCashBuffer() view returns (uint256)",
  "function getPrice() view returns (uint256)",
  "function isInWindDown() view returns (bool)",
  "function liquidateUser(address user) external",
  "function syncWriteDown() external",
  "function claimMasterCollateral() external",
  "function enterWindDown() external",
  "event UserLiquidated(address indexed user, uint256 principalForfeited, uint256 originalBtcForfeited, uint256 effectiveClaimForfeited, address indexed liquidator)",
  "event WriteDownSynced(uint256 oldFactor, uint256 newFactor)",
  "event MasterCollateralClaimed(address indexed caller)",
  "event WindDownEntered(uint256 surplusClaimed)"
]);

export const troveManagerAbi = parseAbi([
  "function getTCR(uint256 _price) view returns (uint256)",
  "function checkRecoveryMode(uint256 _price) view returns (bool)",
  "function getTroveStatus(address _borrower) view returns (uint8)",
  "function getEntireDebtAndColl(address _borrower) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "event TroveUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 _stake, uint8 _operation)",
  "event TroveLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 _operation)",
  "event Redemption(uint256 _attemptedMUSDAmount, uint256 _actualMUSDAmount, uint256 _ETHSent, uint256 _ETHFee)"
]);

export const priceFeedAbi = parseAbi([
  "function fetchPrice() view returns (uint256)",
  "event LastGoodPriceUpdated(uint256 _lastGoodPrice)"
]);
