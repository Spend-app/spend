import { createConfig, http } from "wagmi";
import { mezoTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http(),
  },
});
