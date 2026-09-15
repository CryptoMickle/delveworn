import { isSomniaDeployment } from "./deployment";

export function onchainMetadataCopy(deployment: string | undefined, somniaSessionKeysEnabled: boolean) {
  if (isSomniaDeployment(deployment)) {
    return {
      title: "Delveworn · Somnia Verified Run",
      description: somniaSessionKeysEnabled
        ? "A Somnia Verified Run with contract-backed progress, popup-free sponsored actions and verifiable randomness."
        : "A Somnia Shannon Testnet dungeon crawler with MetaMask-confirmed actions, contract-backed progress and verifiable randomness.",
    };
  }
  return {
    title: "Delveworn · Onchain Dungeon",
    description: "A fully onchain dungeon crawler with wallet-signed actions, verifiable randomness and contract-backed progress.",
  };
}

export function somniaTimingCopy(hasSession: boolean) {
  return hasSession ? {
    heading: "TECHNICAL DETAILS · BUNDLER + VRF",
    description: "Popup-free play still uses Thirdweb's ERC-4337 bundler, block inclusion and Somnia's verifiable-randomness callback. These timings are diagnostic and do not change the proof model.",
  } : {
    heading: "TECHNICAL DETAILS · TRANSACTIONS + VRF",
    description: "MetaMask confirms each action, followed by block inclusion and Somnia's verifiable-randomness callback. These timings are diagnostic and do not change the proof model.",
  };
}
