import type { Address } from "viem";

export const SPEND_CONTRACT_ADDRESS: Address = (
  import.meta.env.VITE_SPEND_CONTRACT_ADDRESS ||
  "0xD4f45a4A2B0EF9B64b2dA17c8287F5B429b00513"
) as Address;

export const MUSD_CONTRACT_ADDRESS: Address = (
  import.meta.env.VITE_MUSD_CONTRACT_ADDRESS ||
  "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
) as Address;

export const MEZO_ADDRESSES = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5" as Address,
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0" as Address,
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366" as Address,
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as Address,
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6" as Address,
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA" as Address,
  interestRateManager: "0xD4D6c36A592A2c5e86035A6bca1d57747a567f37" as Address,
} as const;

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

