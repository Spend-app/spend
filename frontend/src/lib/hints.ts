import type { Address, PublicClient } from "viem";
import { MEZO_ADDRESSES, ZERO_ADDRESS } from "../config/contracts";
import { hintHelpersAbi, sortedTrovesAbi } from "../abi";

/**
 * Calculates (upperHint, lowerHint) for Mezo SortedTroves.
 * If anything fails (e.g. RPC unavailable, empty list), safely falls back to ZERO_ADDRESS.
 */
export async function getHints(
  publicClient: PublicClient | undefined,
  nicr: bigint,
): Promise<[Address, Address]> {
  if (!publicClient || nicr <= 0n) {
    return [ZERO_ADDRESS, ZERO_ADDRESS];
  }

  try {
    const [hintAddress] = await publicClient.readContract({
      address: MEZO_ADDRESSES.hintHelpers,
      abi: hintHelpersAbi,
      functionName: "getApproxHint",
      args: [nicr, 15n, 42n],
    });

    const [upper, lower] = await publicClient.readContract({
      address: MEZO_ADDRESSES.sortedTroves,
      abi: sortedTrovesAbi,
      functionName: "findInsertPosition",
      args: [nicr, hintAddress, hintAddress],
    });

    return [upper as Address, lower as Address];
  } catch {
    return [ZERO_ADDRESS, ZERO_ADDRESS];
  }
}

