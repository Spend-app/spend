import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useAccount,
  useBalance,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { mezoTestnet } from "@reown/appkit/networks";
import { formatUnits, maxUint256, parseEther, parseUnits } from "viem";
import type { Address } from "viem";
import {
  MUSD_CONTRACT_ADDRESS,
  SPEND_CONTRACT_ADDRESS,
  ZERO_ADDRESS,
} from "../config/contracts";
import { erc20Abi, spendAbi } from "../abi";
import { getHints } from "../lib/hints";
import { fetchMUSDPrice } from "../lib/musdPrice";
import {
  LIQUIDATION_RANGE,
  LIQUIDATION_START,
  PRICE_DRIFT_BUFFER,
} from "../data/static";
// Off-chain policy constants (Liquidation range/start, quote drift buffer).
// There are no on-chain getters for these, so they live in src/data/static.ts
// instead of as mock/demo fallback data.

/** Format a bigint on-chain value, or 0 when the read has not resolved yet. */
const toNum = (v: bigint | undefined, decimals = 18) =>
  v !== undefined ? Number(formatUnits(v, decimals)) : 0;

export interface Position {
  btc: number; // exact BTC quantity deposited
  principal: number; // MUSD principal owed
  startTime: number; // ms timestamp
  accruedInterest?: number; // MUSD accrued
  totalOwed?: number; // MUSD total owed
}

export interface AppConfig {
  minBorrow: number;
  maxBorrow: number;
  minUserICR: number; // %
  pauseICR: number; // %
  originationFeeBps: number;
  userInterestRate: number; // % APR
  bufferThreshold: number;
  priceDriftBuffer: number;
  liquidationRange: string;
  liquidationStart: number;
}

export interface MasterState {
  opened: boolean;
  collateral: number;
  debt: number;
  cashBuffer: number;
  icr: number;
  tcr: number;
  mezoRateBps: number;
  recoveryMode: boolean;
  totalUserPrincipal: number;
  grossFees: number;
  owner: string;
}

interface AppState {
  connected: boolean;
  address: string;
  chainId: number | undefined;
  isWrongNetwork: boolean;
  switchToMezo: () => Promise<void>;
  musdBalance: number;
  btcBalance: number;
  approved: boolean;
  position: Position | null;
  paused: boolean;
  price: number;
  musdPrice: number;
  config: AppConfig;
  masterState: MasterState;
  isOwner: boolean;
  connect: () => void;
  disconnect: () => void;
  approve: () => Promise<void>;
  borrow: (amount: number, btcToSend: number) => Promise<void>;
  repay: (totalOwed?: number) => Promise<void>;
  setPaused: (v: boolean) => Promise<void>;
  refetchAll: () => Promise<void>;

  // Master Trove admin actions
  openMasterTrove: (bitcoin: number, cash: number) => Promise<void>;
  addCollateral: (bitcoin: number) => Promise<void>;
  increaseMasterDebt: (amount: number) => Promise<void>;
  decreaseMasterDebt: (amount: number) => Promise<void>;
  refinanceMasterDebt: () => Promise<void>;
  claimMasterCollateral: () => Promise<void>;
  closeMasterTrove: () => Promise<void>;
  withdrawFees: (to: string, amount: number) => Promise<void>;
  extractMUSD: (to: string, amount: number) => Promise<void>;
  withdrawBTC: (to: string, amount: number) => Promise<void>;
  updateBorrowLimits: (min: number, max: number) => Promise<void>;
  updateMinUserICR: (icrPct: number) => Promise<void>;
  updatePauseICR: (icrPct: number) => Promise<void>;
  updateBufferThreshold: (amount: number) => Promise<void>;
  updateOriginationFeeBps: (bps: number) => Promise<void>;
  updateUserInterestRate: (ratePct: number) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const isWrongNetwork = isConnected && chainId !== mezoTestnet.id;

  const switchToMezo = useCallback(async () => {
    if (switchChainAsync) {
      await switchChainAsync({ chainId: mezoTestnet.id });
    }
  }, [switchChainAsync]);

  // Live MUSD → USD price from CoinGecko, refreshed every 60s. 0 until loaded.
  const [musdPrice, setMusdPrice] = useState(0);
  useEffect(() => {
    let alive = true;
    const loadPrice = async () => {
      try {
        const p = await fetchMUSDPrice();
        if (alive) setMusdPrice(p);
      } catch {
        // Keep the last known value; retry on the next tick.
      }
    };
    loadPrice();
    const id = window.setInterval(loadPrice, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const connect = useCallback(() => {
    open();
  }, [open]);

  // 1. Native BTC Balance
  const { data: btcData, refetch: refetchBtc } = useBalance({
    address,
    chainId: mezoTestnet.id,
  });

  const btcBalance = useMemo(() => {
    if (!btcData) return 0;
    return Number(formatUnits(btcData.value, btcData.decimals));
  }, [btcData]);

  // 2. MUSD Token Balance
  const { data: musdData, refetch: refetchMusd } = useReadContract({
    address: MUSD_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: mezoTestnet.id,
    query: {
      enabled: !!address,
    },
  });

  const musdBalance = useMemo(() => {
    if (typeof musdData !== "bigint") return 0;
    return Number(formatUnits(musdData, 18));
  }, [musdData]);

  // 3. MUSD Allowance for Spend contract
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: MUSD_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, SPEND_CONTRACT_ADDRESS] : undefined,
    chainId: mezoTestnet.id,
    query: {
      enabled: !!address,
    },
  });

  // 4. Protocol Multicall Reads
  const { data: protocolData, refetch: refetchProtocol } = useReadContracts({
    contracts: [
      { address: SPEND_CONTRACT_ADDRESS, abi: spendAbi, functionName: "owner" },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "paused",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "masterOpened",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getPrice",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "minBorrow",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "maxBorrow",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "minUserICR",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "pauseICR",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "originationFeeBps",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "userInterestRate",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "bufferThreshold",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getCashBuffer",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getMasterICR",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getMasterTCR",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "isRecoveryMode",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "totalUserPrincipal",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "grossFees",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getMasterTroveState",
      },
      {
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "getMasterInterestRateBps",
      },
    ],
    query: {
      refetchInterval: 12_000,
    },
  });

  // 5. User Position Reads
  const { data: userPositionData, refetch: refetchPosition } = useReadContracts(
    {
      contracts: [
        {
          address: SPEND_CONTRACT_ADDRESS,
          abi: spendAbi,
          functionName: "getUserPosition",
          args: address ? [address] : undefined,
        },
        {
          address: SPEND_CONTRACT_ADDRESS,
          abi: spendAbi,
          functionName: "positions",
          args: address ? [address] : undefined,
        },
      ],
      query: {
        enabled: !!address,
        refetchInterval: 6_000,
      },
    },
  );

  // Parse Protocol Values
  const owner = (protocolData?.[0]?.result as string) || "";
  const paused = Boolean(protocolData?.[1]?.result ?? false);
  const masterOpened = Boolean(protocolData?.[2]?.result ?? false);

  const price = useMemo(() => {
    const rawPrice = protocolData?.[3]?.result as bigint | undefined;
    if (rawPrice === undefined) return 0;
    return Number(formatUnits(rawPrice, 18));
  }, [protocolData]);

  const config: AppConfig = useMemo(() => {
    const minBorrowRaw = protocolData?.[4]?.result as bigint | undefined;
    const maxBorrowRaw = protocolData?.[5]?.result as bigint | undefined;
    const minUserICRRaw = protocolData?.[6]?.result as bigint | undefined;
    const pauseICRRaw = protocolData?.[7]?.result as bigint | undefined;
    const originationFeeBpsRaw = protocolData?.[8]?.result as
      | bigint
      | undefined;
    const userInterestRateRaw = protocolData?.[9]?.result as bigint | undefined;
    const bufferThresholdRaw = protocolData?.[10]?.result as bigint | undefined;

    return {
      minBorrow: toNum(minBorrowRaw, 18),
      maxBorrow: toNum(maxBorrowRaw, 18),
      minUserICR: toNum(minUserICRRaw, 16),
      pauseICR: toNum(pauseICRRaw, 16),
      originationFeeBps:
        originationFeeBpsRaw !== undefined ? Number(originationFeeBpsRaw) : 0,
      userInterestRate: toNum(userInterestRateRaw, 16),
      bufferThreshold: toNum(bufferThresholdRaw, 18),
      priceDriftBuffer: PRICE_DRIFT_BUFFER,
      liquidationRange: LIQUIDATION_RANGE,
      liquidationStart: LIQUIDATION_START,
    };
  }, [protocolData]);

  const masterState: MasterState = useMemo(() => {
    const cashBufferRaw = protocolData?.[11]?.result as bigint | undefined;
    const masterICRRaw = protocolData?.[12]?.result as bigint | undefined;
    const masterTCRRaw = protocolData?.[13]?.result as bigint | undefined;
    const recoveryModeRaw = protocolData?.[14]?.result as boolean | undefined;
    const totalUserPrincipalRaw = protocolData?.[15]?.result as
      | bigint
      | undefined;
    const grossFeesRaw = protocolData?.[16]?.result as bigint | undefined;
    const troveStateRaw = protocolData?.[17]?.result as
      | [bigint, bigint, bigint, bigint, bigint, bigint]
      | undefined;
    const mezoRateBpsRaw = protocolData?.[18]?.result as number | undefined;

    const collateral = toNum(troveStateRaw?.[0], 18);
    const principal = toNum(troveStateRaw?.[1], 18);
    const interest = toNum(troveStateRaw?.[2], 18);
    const compositeDebt = principal + interest;

    return {
      opened: masterOpened,
      collateral,
      debt: compositeDebt,
      cashBuffer: toNum(cashBufferRaw, 18),
      icr: toNum(masterICRRaw, 16),
      tcr: toNum(masterTCRRaw, 16),
      mezoRateBps: mezoRateBpsRaw ?? 0,
      recoveryMode: Boolean(recoveryModeRaw),
      totalUserPrincipal: toNum(totalUserPrincipalRaw, 18),
      grossFees: toNum(grossFeesRaw, 18),
      owner,
    };
  }, [protocolData, masterOpened, owner]);

  // Parse User Position
  const position: Position | null = useMemo(() => {
    if (!address) return null;

    const userPos = userPositionData?.[0]?.result as
      | [bigint, bigint, bigint, bigint, boolean]
      | undefined;
    const rawPos = userPositionData?.[1]?.result as
      | [bigint, bigint, bigint, boolean]
      | undefined;

    const isActive = userPos?.[4] || rawPos?.[3];
    if (!isActive) return null;

    const btcContributed = userPos?.[0] ?? rawPos?.[0] ?? 0n;
    const principal = userPos?.[1] ?? rawPos?.[1] ?? 0n;
    const accruedInterest = userPos?.[2] ?? 0n;
    const totalOwed = userPos?.[3] ?? 0n;
    const startTimeSeconds = rawPos?.[2] ?? 0n;

    return {
      btc: Number(formatUnits(btcContributed, 18)),
      principal: Number(formatUnits(principal, 18)),
      startTime: Number(startTimeSeconds) * 1000,
      accruedInterest: Number(formatUnits(accruedInterest, 18)),
      totalOwed: Number(formatUnits(totalOwed, 18)),
    };
  }, [address, userPositionData]);

  // Check MUSD allowance for user position
  const approved = useMemo(() => {
    if (!allowanceData || typeof allowanceData !== "bigint") return false;
    if (allowanceData === 0n) return false;
    if (!position || !position.totalOwed) return allowanceData > 0n;
    const owedWei = parseUnits(position.totalOwed.toFixed(18), 18);
    return allowanceData >= owedWei;
  }, [allowanceData, position]);

  const isOwner = useMemo(() => {
    if (!address || !owner) return false;
    return address.toLowerCase() === owner.toLowerCase();
  }, [address, owner]);

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetchBtc(),
      refetchMusd(),
      refetchAllowance(),
      refetchPosition(),
      refetchProtocol(),
    ]);
  }, [
    refetchBtc,
    refetchMusd,
    refetchAllowance,
    refetchPosition,
    refetchProtocol,
  ]);

  // Actions
  const approve = useCallback(async () => {
    if (!address) throw new Error("Please connect your wallet first.");
    const hash = await writeContractAsync({
      address: MUSD_CONTRACT_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [SPEND_CONTRACT_ADDRESS, maxUint256],
    });
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    await refetchAllowance();
  }, [address, writeContractAsync, publicClient, refetchAllowance]);

  const borrow = useCallback(
    async (amount: number, btcToSend: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      if (amount <= 0 || btcToSend <= 0)
        throw new Error("Invalid borrow amount.");

      const musdWei = parseUnits(amount.toString(), 18);
      const btcWei = parseEther(btcToSend.toFixed(18));

      // Calculate Hint
      const feeBps = BigInt(config.originationFeeBps);
      const feeWei = (musdWei * feeBps) / 10000n;
      const compositeDebt = musdWei + feeWei + 200000000000000000000n;
      const nicr = (btcWei * 100000000000000000000n) / compositeDebt;

      const [upperHint, lowerHint] = await getHints(publicClient, nicr);

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "borrow",
        args: [musdWei, upperHint, lowerHint],
        value: btcWei,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [
      address,
      config.originationFeeBps,
      publicClient,
      writeContractAsync,
      refetchAll,
    ],
  );

  const repay = useCallback(
    async (totalOwed?: number) => {
      if (!address) throw new Error("Please connect your wallet first.");

      // Check allowance first
      if (allowanceData && typeof allowanceData === "bigint" && totalOwed) {
        const owedWei = parseUnits(totalOwed.toFixed(18), 18);
        if (allowanceData < owedWei) {
          await approve();
        }
      }

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "repay",
        args: [ZERO_ADDRESS, ZERO_ADDRESS],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [
      address,
      allowanceData,
      approve,
      writeContractAsync,
      publicClient,
      refetchAll,
    ],
  );

  const setPaused = useCallback(
    async (v: boolean) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setPaused",
        args: [v],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  // Admin Master Trove Actions
  const openMasterTrove = useCallback(
    async (bitcoin: number, cash: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const debtAmount = parseUnits(cash.toString(), 18);
      const btcWei = parseEther(bitcoin.toFixed(18));

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "openMasterTrove",
        args: [debtAmount, ZERO_ADDRESS, ZERO_ADDRESS],
        value: btcWei,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const addCollateral = useCallback(
    async (bitcoin: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const btcWei = parseEther(bitcoin.toFixed(18));

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "addCollateral",
        args: [ZERO_ADDRESS, ZERO_ADDRESS],
        value: btcWei,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const increaseMasterDebt = useCallback(
    async (amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const debtWei = parseUnits(amount.toString(), 18);

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "increaseMasterDebt",
        args: [debtWei, ZERO_ADDRESS, ZERO_ADDRESS],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const decreaseMasterDebt = useCallback(
    async (amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const debtWei = parseUnits(amount.toString(), 18);

      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "decreaseMasterDebt",
        args: [debtWei, ZERO_ADDRESS, ZERO_ADDRESS],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const refinanceMasterDebt = useCallback(async () => {
    if (!address) throw new Error("Please connect your wallet first.");
    const hash = await writeContractAsync({
      address: SPEND_CONTRACT_ADDRESS,
      abi: spendAbi,
      functionName: "refinanceMasterDebt",
      args: [ZERO_ADDRESS, ZERO_ADDRESS],
    });
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    await refetchAll();
  }, [address, writeContractAsync, publicClient, refetchAll]);

  const claimMasterCollateral = useCallback(async () => {
    if (!address) throw new Error("Please connect your wallet first.");
    const hash = await writeContractAsync({
      address: SPEND_CONTRACT_ADDRESS,
      abi: spendAbi,
      functionName: "claimMasterCollateral",
      args: [],
    });
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    await refetchAll();
  }, [address, writeContractAsync, publicClient, refetchAll]);

  const closeMasterTrove = useCallback(async () => {
    if (!address) throw new Error("Please connect your wallet first.");
    const hash = await writeContractAsync({
      address: SPEND_CONTRACT_ADDRESS,
      abi: spendAbi,
      functionName: "closeMasterTrove",
      args: [],
    });
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    await refetchAll();
  }, [address, writeContractAsync, publicClient, refetchAll]);

  const withdrawFees = useCallback(
    async (to: string, amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const feeWei = parseUnits(amount.toString(), 18);
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "withdrawFees",
        args: [to as Address, feeWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const extractMUSD = useCallback(
    async (to: string, amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const amountWei = parseUnits(amount.toString(), 18);
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "extractMUSD",
        args: [to as Address, amountWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const withdrawBTC = useCallback(
    async (to: string, amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const amountWei = parseEther(amount.toFixed(18));
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "withdrawBTC",
        args: [to as Address, amountWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAll();
    },
    [address, writeContractAsync, publicClient, refetchAll],
  );

  const updateBorrowLimits = useCallback(
    async (min: number, max: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setBorrowLimits",
        args: [parseUnits(min.toString(), 18), parseUnits(max.toString(), 18)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const updateMinUserICR = useCallback(
    async (icrPct: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setMinUserICR",
        args: [parseUnits(icrPct.toString(), 16)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const updatePauseICR = useCallback(
    async (icrPct: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setPauseICR",
        args: [parseUnits(icrPct.toString(), 16)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const updateBufferThreshold = useCallback(
    async (amount: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setBufferThreshold",
        args: [parseUnits(amount.toString(), 18)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const updateOriginationFeeBps = useCallback(
    async (bps: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setOriginationFeeBps",
        args: [BigInt(bps)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const updateUserInterestRate = useCallback(
    async (ratePct: number) => {
      if (!address) throw new Error("Please connect your wallet first.");
      const hash = await writeContractAsync({
        address: SPEND_CONTRACT_ADDRESS,
        abi: spendAbi,
        functionName: "setUserInterestRate",
        args: [parseUnits(ratePct.toString(), 16)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchProtocol();
    },
    [address, writeContractAsync, publicClient, refetchProtocol],
  );

  const value = useMemo<AppState>(
    () => ({
      connected: isConnected,
      address: address || "",
      chainId,
      isWrongNetwork,
      switchToMezo,
      musdBalance,
      btcBalance,
      approved,
      position,
      paused,
      price,
      musdPrice,
      config,
      masterState,
      isOwner,
      connect,
      disconnect,
      approve,
      borrow,
      repay,
      setPaused,
      refetchAll,
      openMasterTrove,
      addCollateral,
      increaseMasterDebt,
      decreaseMasterDebt,
      refinanceMasterDebt,
      claimMasterCollateral,
      closeMasterTrove,
      withdrawFees,
      extractMUSD,
      withdrawBTC,
      updateBorrowLimits,
      updateMinUserICR,
      updatePauseICR,
      updateBufferThreshold,
      updateOriginationFeeBps,
      updateUserInterestRate,
    }),
    [
      isConnected,
      address,
      chainId,
      isWrongNetwork,
      switchToMezo,
      musdBalance,
      btcBalance,
      approved,
      position,
      paused,
      price,
      musdPrice,
      config,
      masterState,
      isOwner,
      connect,
      disconnect,
      approve,
      borrow,
      repay,
      setPaused,
      refetchAll,
      openMasterTrove,
      addCollateral,
      increaseMasterDebt,
      decreaseMasterDebt,
      refinanceMasterDebt,
      claimMasterCollateral,
      closeMasterTrove,
      withdrawFees,
      extractMUSD,
      withdrawBTC,
      updateBorrowLimits,
      updateMinUserICR,
      updatePauseICR,
      updateBufferThreshold,
      updateOriginationFeeBps,
      updateUserInterestRate,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
