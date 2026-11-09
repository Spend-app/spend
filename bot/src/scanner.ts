import { CONFIG, publicClient } from "./config.js";
import { spendAbi, troveManagerAbi, priceFeedAbi } from "./abi.js";
import { formatEther } from "viem";

export interface BorrowerHealth {
  address: `0x${string}`;
  principalMusd: number;
  originalBtc: number;
  effectiveClaimBtc: number;
  icr: number; // In percentage (e.g., 128.5)
  isUnderwater: boolean;
  isWarning: boolean;
}

export interface SystemScanResult {
  btcPriceUsd: number;
  masterOpened: boolean;
  paused: boolean;
  inWindDown: boolean;
  masterIcr: number; // In percentage (e.g., 285.4)
  systemTcr: number; // In percentage
  cashBufferMusd: number;
  liquidationIcrThreshold: number; // In percentage (e.g., 130)
  activeBorrowerCount: number;
  borrowers: BorrowerHealth[];
  underwaterBorrowers: BorrowerHealth[];
  warningBorrowers: BorrowerHealth[];
  masterTroveStatus: number; // 1 = active, 3 = closedByLiquidation, 4 = closedByRedemption
}

export async function scanProtocolState(): Promise<SystemScanResult> {
  // 1. Fetch protocol global state in parallel
  const [
    btcPriceRaw,
    masterOpened,
    paused,
    inWindDown,
    liquidationIcrRaw,
    activeBorrowers,
    masterTroveStatusRaw,
  ] = await Promise.all([
    publicClient.readContract({
      address: CONFIG.mezoPriceFeed,
      abi: priceFeedAbi,
      functionName: "fetchPrice",
    }),
    publicClient.readContract({
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "masterOpened",
    }),
    publicClient.readContract({
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "paused",
    }),
    publicClient.readContract({
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "isInWindDown",
    }),
    publicClient.readContract({
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "liquidationICR",
    }),
    publicClient.readContract({
      address: CONFIG.spendContract,
      abi: spendAbi,
      functionName: "getActiveBorrowers",
    }),
    publicClient.readContract({
      address: CONFIG.mezoTroveManager,
      abi: troveManagerAbi,
      functionName: "getTroveStatus",
      args: [CONFIG.spendContract],
    }),
  ]);

  const btcPriceUsd = Number(btcPriceRaw) / 1e18;
  const liquidationIcrThreshold = Number(liquidationIcrRaw) / 1e16;
  const masterTroveStatus = Number(masterTroveStatusRaw);

  let masterIcr = 0;
  let systemTcr = 0;
  let cashBufferMusd = 0;

  if (masterOpened) {
    const [masterIcrRaw, systemTcrRaw, cashBufferRaw] = await Promise.all([
      publicClient.readContract({
        address: CONFIG.spendContract,
        abi: spendAbi,
        functionName: "getMasterICR",
      }),
      publicClient.readContract({
        address: CONFIG.spendContract,
        abi: spendAbi,
        functionName: "getMasterTCR",
      }),
      publicClient.readContract({
        address: CONFIG.spendContract,
        abi: spendAbi,
        functionName: "getCashBuffer",
      }),
    ]);
    masterIcr = Number(masterIcrRaw) / 1e16;
    systemTcr = Number(systemTcrRaw) / 1e16;
    cashBufferMusd = Number(formatEther(cashBufferRaw));
  }

  // 2. Multicall scan for each active borrower
  const borrowerHealthList: BorrowerHealth[] = [];

  if (activeBorrowers.length > 0) {
    const calls = activeBorrowers.flatMap((borrower) => [
      {
        address: CONFIG.spendContract,
        abi: spendAbi,
        functionName: "getUserICR",
        args: [borrower],
      },
      {
        address: CONFIG.spendContract,
        abi: spendAbi,
        functionName: "getUserPosition",
        args: [borrower],
      },
    ]);

    const results = await publicClient.multicall({ contracts: calls as any });

    for (let i = 0; i < activeBorrowers.length; i++) {
      const borrower = activeBorrowers[i];
      const icrResult = results[i * 2];
      const posResult = results[i * 2 + 1];

      if (icrResult.status === "success" && posResult.status === "success") {
        const icrRaw = icrResult.result as bigint;
        const pos = posResult.result as [bigint, bigint, bigint, bigint, bigint, boolean];

        const icr = Number(icrRaw) / 1e16;
        const originalBtc = Number(formatEther(pos[0]));
        const effectiveClaimBtc = Number(formatEther(pos[1]));
        const principalMusd = Number(formatEther(pos[2]));

        const isUnderwater = icr < liquidationIcrThreshold;
        const isWarning = icr < 150 && !isUnderwater;

        borrowerHealthList.push({
          address: borrower,
          principalMusd,
          originalBtc,
          effectiveClaimBtc,
          icr,
          isUnderwater,
          isWarning,
        });
      }
    }
  }

  return {
    btcPriceUsd,
    masterOpened,
    paused,
    inWindDown,
    masterIcr,
    systemTcr,
    cashBufferMusd,
    liquidationIcrThreshold,
    activeBorrowerCount: activeBorrowers.length,
    borrowers: borrowerHealthList,
    underwaterBorrowers: borrowerHealthList.filter((b) => b.isUnderwater),
    warningBorrowers: borrowerHealthList.filter((b) => b.isWarning),
    masterTroveStatus,
  };
}
