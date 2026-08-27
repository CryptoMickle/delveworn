"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  toHex,
  webSocket,
  type Address,
} from "viem";
import { riseTestnet } from "viem/chains";
import { shredActions } from "shreds/viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  createConfig,
  useChainId,
  useConnect,
  useConnection,
  useDisconnect,
  useConnectors,
} from "wagmi";
import { metaMask } from "wagmi/connectors";
import { Chains, RiseWallet } from "rise-wallet";
import { Hooks, riseWallet } from "rise-wallet/wagmi";
import { P256, PublicKey, Signature } from "ox";
import {
  describeRelicEquipImpact,
  RELIC_RARITY_LABELS,
  getOfferedRelics,
  getRelicDefinition,
} from "./relics";
import { runtimeNowMs } from "./runtime-time";
import { legacyFrontendSnapshotAbi } from "./legacy-snapshot";
import {
  BossRelicReward,
  CombatActionDock,
  DungeonEntry,
  DungeonLog,
  GameHeader,
  GameHud,
  GoldAmount,
  RelicArtwork,
  RoomProgressLine,
  SmallStat,
} from "./game-ui";

/*
  ============================================================
  DELVEWORN V8.6.9b
  VRF RETRY RECOVERY + TYPESCRIPT BUILD FIXES
  ============================================================
*/

const CONFIGURED_DUNGEON_ADDRESS =
  process.env.NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS ??
  process.env.NEXT_PUBLIC_DUNGEON_ADDRESS;

if (!CONFIGURED_DUNGEON_ADDRESS) {
  throw new Error(
    "NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS or NEXT_PUBLIC_DUNGEON_ADDRESS is not set. Add the deployed Delveworn address to frontend/.env.local and restart Next.js."
  );
}

const DUNGEON_ADDRESS =
  getAddress(
    CONFIGURED_DUNGEON_ADDRESS
  );

const DUNGEON_EXPLORER_URL =
  `https://explorer.testnet.riselabs.xyz/address/${DUNGEON_ADDRESS}`;

const RPC_URL =
  "https://testnet.riselabs.xyz";

const WS_URL =
  "wss://testnet.riselabs.xyz/ws";

const TESTNET_POLLING_MS = 50;
const MIN_VRF_DISPLAY_MS = 300;
const VRF_DELAYED_NOTICE_MS = 5_000;
const VRF_CANONICAL_FALLBACK_MS = 20_000;
const ACTION_READY_TIMEOUT_MS = 45_000;
const ACTION_READY_POLL_MS = 250;

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SESSION_STATUS_TIMEOUT_MS = 12_000;
const SESSION_STATUS_POLL_MS = 40;

const RISE_WALLET_CONNECTOR_ID =
  "com.risechain.wallet";

const METAMASK_CONNECTOR_ID =
  "metaMaskSDK";

const METAMASK_CONNECTOR_NAME =
  "MetaMask";

const riseWalletConnector =
  riseWallet(
    RiseWallet.defaultConfig
  );

const metaMaskConnector =
  metaMask({
    dapp: {
      name:
        "RISE Dungeon",
      url:
        typeof window ===
        "undefined"
          ? "https://rise-dungeon-frontend.vercel.app"
          : window.location.origin,
    },
  });

const wagmiConfig =
  createConfig({
    ssr: true,

    chains: [
      Chains.riseTestnet,
    ],

    connectors: [
      riseWalletConnector,
      metaMaskConnector,
    ],

    transports: {
      [Chains.riseTestnet.id]:
        http(
          RPC_URL
        ),
    },
  });

/*
  ============================================================
  BALANCE CONSTANTS
  ============================================================
*/

const MAX_POTIONS = 5;
const STARTING_POTIONS = 3;

const CAMP_POTION_STOCK = 2;
const SUPPLY_POTION_STOCK = 2;

const NORMAL_COMBAT_POTION_LIMIT = 2;
const BOSS_COMBAT_POTION_LIMIT = 3;

const CAMP_ARRIVAL_HEAL = 15;
const CAMP_REST_HEAL = 30;
const SUPPLY_BANDAGE_HEAL = 25;

const MAX_ARMOR_REDUCTION_PERCENT = 50;

/*
  ============================================================
  CHARACTERS
  ============================================================
*/

const MERCHANT_IMAGE =
  "/characters/merchant-quartermaster-kevin.webp?v=merchant-20260825-v3";

const MERCHANT_NAME =
  "Quartermaster Kevin";

/*
  ============================================================
  WALLET / CLIENTS
  ============================================================
*/

type InjectedProvider =
  Parameters<
    typeof custom
  >[0];

function asInjectedProvider(
  provider: unknown
): InjectedProvider {
  if (
    !provider ||
    typeof provider !==
      "object" ||
    !("request" in provider)
  ) {
    throw new Error(
      "Connected wallet did not expose an EIP-1193 provider."
    );
  }

  return provider as
    InjectedProvider;
}

function getErrorCode(
  error: unknown
) {
  if (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error
  ) {
    return Number(
      (
        error as {
          code: unknown;
        }
      ).code
    );
  }

  return undefined;
}

async function ensureRiseTestnet(
  provider:
    InjectedProvider
) {
  const chainId =
    `0x${riseTestnet.id.toString(16)}`;

  try {
    await provider.request({
      method:
        "wallet_switchEthereumChain",

      params: [
        {
          chainId,
        },
      ],
    });
  } catch (
    error
  ) {
    if (
      getErrorCode(error) !==
      4902
    ) {
      throw error;
    }

    await provider.request({
      method:
        "wallet_addEthereumChain",

      params: [
        {
          chainId,

          chainName:
            "RISE Testnet",

          nativeCurrency: {
            name:
              "Ether",

            symbol:
              "ETH",

            decimals:
              18,
          },

          rpcUrls: [
            RPC_URL,
          ],

          blockExplorerUrls: [
            "https://explorer.testnet.riselabs.xyz",
          ],
        },
      ],
    });
  }
}

async function createConnectedWalletClient(
  account:
    Address,

  provider:
    InjectedProvider
) {
  await ensureRiseTestnet(
    provider
  );

  return createWalletClient({
    account,

    chain:
      riseTestnet,

    transport:
      custom(
        provider
      ),
  });
}

const publicClient =
  createPublicClient({
    chain:
      riseTestnet,

    pollingInterval:
      TESTNET_POLLING_MS,

    cacheTime: 0,

    transport: http(
      RPC_URL
    ),
  });

const realtimeClient =
  createPublicClient({
    chain:
      riseTestnet,

    cacheTime: 0,

    transport:
      webSocket(
        WS_URL,
        {
          keepAlive: {
            interval: 5_000,
          },

          reconnect: {
            attempts: 100,
            delay: 500,
          },

          retryCount: 5,
          retryDelay: 100,
          timeout: 15_000,
        }
      ),
  }).extend(
    shredActions
  );

/*
  ============================================================
  ABI
  ============================================================
*/

const frontendSnapshotAbiParameter = {
  name: "snapshot",
  type: "tuple",
  components: [
    { name: "hp", type: "uint256" },
    { name: "monsterHp", type: "uint256" },
    { name: "monsterMaxHp", type: "uint256" },
    { name: "roomsCleared", type: "uint256" },
    { name: "gold", type: "uint256" },
    { name: "potions", type: "uint256" },
    { name: "weaponLevel", type: "uint256" },
    { name: "armorLevel", type: "uint256" },
    { name: "monsterType", type: "uint8" },
    { name: "lastLootType", type: "uint8" },
    { name: "lastLootAmount", type: "uint256" },
    { name: "hasStarted", type: "bool" },
    { name: "active", type: "bool" },
    { name: "attackMin", type: "uint256" },
    { name: "attackMax", type: "uint256" },
    { name: "monsterMin", type: "uint256" },
    { name: "monsterMax", type: "uint256" },
    { name: "requestId", type: "uint256" },
    { name: "requestKind", type: "uint8" },
    { name: "playerDamage", type: "uint256" },
    { name: "monsterDamage", type: "uint256" },
    { name: "critical", type: "bool" },
    { name: "campOpen", type: "bool" },
    { name: "restUsed", type: "bool" },
    { name: "campPotionPurchases", type: "uint256" },
    { name: "combatPotionUses", type: "uint256" },
    { name: "supplyOpen", type: "bool" },
    { name: "bandageUsed", type: "bool" },
    { name: "supplyPotionPurchases", type: "uint256" },
    { name: "equippedRelic", type: "uint8" },
    { name: "relicOfferAvailable", type: "bool" },
    { name: "relicOfferRarity", type: "uint8" },
    { name: "maxHp", type: "uint256" },
    { name: "criticalChance", type: "uint256" },
    { name: "relicReviveUsed", type: "bool" },
  ],
} as const;

const frontendSnapshotV3AbiParameter = {
  name: "snapshot",
  type: "tuple",
  components: [
    {
      name: "base",
      type: "tuple",
      components:
        frontendSnapshotAbiParameter.components,
    },
    { name: "relicOffer", type: "uint8" },
    { name: "ownedRelicsMask", type: "uint16" },
    { name: "relicCounts", type: "uint16[15]" },
    { name: "baseMaxHp", type: "uint256" },
    { name: "stormMax", type: "uint256" },
  ],
} as const;

const dungeonAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "player",
        type: "address",
      },
      {
        indexed: true,
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        name: "kind",
        type: "uint8",
      },
      {
        indexed: false,
        name: "numberCount",
        type: "uint32",
      },
    ],
    name: "RandomnessRequested",
    type: "event",
  },

  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "player",
        type: "address",
      },
      {
        indexed: true,
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        name: "kind",
        type: "uint8",
      },
    ],
    name: "RandomnessFulfilled",
    type: "event",
  },

  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "player",
        type: "address",
      },
      {
        indexed: true,
        name: "oldRequestId",
        type: "uint256",
      },
      {
        indexed: true,
        name: "newRequestId",
        type: "uint256",
      },
      {
        indexed: false,
        name: "kind",
        type: "uint8",
      },
    ],
    name: "RandomnessRetried",
    type: "event",
  },

  {
    inputs: [],
    name: "startGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "attack",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "stormAttack",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "usePotion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "enterNextRoom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [
      {
        name: "relic",
        type: "uint8",
      },
    ],
    name: "chooseRelic",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [
      {
        name: "equip",
        type: "bool",
      },
    ],
    name: "claimRelic",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [
      {
        name: "relic",
        type: "uint8",
      },
    ],
    name: "equipOwnedRelic",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "retryRandomness",
    outputs: [
      {
        name: "newRequestId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [
      {
        name: "playerAddress",
        type: "address",
      },
    ],
    name: "randomnessRetryAvailable",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      {
        name: "",
        type: "address",
      },
    ],
    name: "pendingRequestTimestamp",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "VRF_TIMEOUT",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "supplyBuyBandage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "supplyBuyPotion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "campRest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "campBuyPotion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "campBuyWeapon",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "campBuyArmor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [
      {
        name: "",
        type: "address",
      },
    ],

    name: "players",

    outputs: [
      {
        name: "hp",
        type: "uint256",
      },
      {
        name: "monsterHp",
        type: "uint256",
      },
      {
        name: "monsterMaxHp",
        type: "uint256",
      },
      {
        name: "roomsCleared",
        type: "uint256",
      },
      {
        name: "gold",
        type: "uint256",
      },
      {
        name: "potions",
        type: "uint256",
      },
      {
        name: "weaponLevel",
        type: "uint256",
      },
      {
        name: "armorLevel",
        type: "uint256",
      },
      {
        name: "monsterType",
        type: "uint8",
      },
      {
        name: "lastLootType",
        type: "uint8",
      },
      {
        name: "lastLootAmount",
        type: "uint256",
      },
      {
        name: "hasStarted",
        type: "bool",
      },
      {
        name: "active",
        type: "bool",
      },
    ],

    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      {
        name: "playerAddress",
        type: "address",
      },
    ],

    name: "combatSnapshot",

    outputs: [
      {
        name: "attackMin",
        type: "uint256",
      },
      {
        name: "attackMax",
        type: "uint256",
      },
      {
        name: "monsterMin",
        type: "uint256",
      },
      {
        name: "monsterMax",
        type: "uint256",
      },
      {
        name: "requestId",
        type: "uint256",
      },
      {
        name: "requestKind",
        type: "uint8",
      },
      {
        name: "playerDamage",
        type: "uint256",
      },
      {
        name: "monsterDamage",
        type: "uint256",
      },
      {
        name: "critical",
        type: "bool",
      },
      {
        name: "campOpen",
        type: "bool",
      },
      {
        name: "restUsed",
        type: "bool",
      },
      {
        name: "campPotionPurchases",
        type: "uint256",
      },
      {
        name: "combatPotionUses",
        type: "uint256",
      },
      {
        name: "supplyOpen",
        type: "bool",
      },
      {
        name: "bandageUsed",
        type: "bool",
      },
      {
        name: "supplyPotionPurchases",
        type: "uint256",
      },
    ],

    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      {
        name: "playerAddress",
        type: "address",
      },
    ],

    name: "frontendSnapshot",

    outputs: [
      frontendSnapshotAbiParameter,
    ],

    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      {
        name: "playerAddress",
        type: "address",
      },
    ],

    name: "frontendSnapshotV3",

    outputs: [
      frontendSnapshotV3AbiParameter,
    ],

    stateMutability: "view",
    type: "function",
  },
] as const;

let supportsFrontendSnapshotV3:
  boolean | null = null;



/*
  ============================================================
  REQUEST TYPES
  ============================================================
*/

enum RequestKind {
  None = 0,
  Monster = 1,
  Attack = 2,
  Storm = 3,
  Potion = 4,
}

type GameAction =
  | "startGame"
  | "attack"
  | "stormAttack"
  | "usePotion"
  | "enterNextRoom";

type CampAction =
  | "campRest"
  | "campBuyPotion"
  | "campBuyWeapon"
  | "campBuyArmor";

type SupplyAction =
  | "supplyBuyBandage"
  | "supplyBuyPotion";

type RelicAction =
  | "chooseRelic"
  | "claimRelic"
  | "equipOwnedRelic";

type PendingAction =
  | GameAction
  | CampAction
  | SupplyAction
  | RelicAction;

type RecoveryAction =
  | "retryRandomness";

type SessionAction =
  | PendingAction
  | RecoveryAction;

const SESSION_PERMISSION_VERSION =
  "4";

const SESSION_FUNCTION_SIGNATURES = [
  "startGame()",
  "attack()",
  "stormAttack()",
  "usePotion()",
  "enterNextRoom()",
  "chooseRelic(uint8)",
  "claimRelic(bool)",
  "equipOwnedRelic(uint8)",
  "retryRandomness()",
  "supplyBuyBandage()",
  "supplyBuyPotion()",
  "campRest()",
  "campBuyPotion()",
  "campBuyWeapon()",
  "campBuyArmor()",
] as const;

function selectorFor(
  signature: string
) {
  return keccak256(
    toHex(
      signature
    )
  ).slice(
    0,
    10
  ) as `0x${string}`;
}

function sessionStorageKey(
  address: Address
) {
  return (
    `rise_dungeon_${DUNGEON_ADDRESS.toLowerCase()}_${address.toLowerCase()}_session_v${SESSION_PERMISSION_VERSION}_key`
  );
}

/*
  ============================================================
  MONSTER PERSONALITIES
  ============================================================
*/

type MonsterPersona = {
  name: string;
  species: string;
  rank?: string;
  image: string;
  flavor: string;
  chance: string;
  baseGold: number;
  encounters: string[];
  hitLines: string[];
  killLines: string[];
};

/*
  ------------------------------------------------------------
  ZOMBIES
  ------------------------------------------------------------
*/

const zombieVariants: MonsterPersona[] = [
  {
    name: "Grave Belle",

    species: "Zombie",

    image:
      "/monsters/zombie-1-grave-belle.webp?v=art-20260825-v2",

    flavor:
      "Technically deceased. Socially still very active.",

    chance: "45%",

    baseGold: 5,

    encounters: [
      "Grave Belle notices you. Personal boundaries immediately become optional.",

      "She's undead, stylish, and suspiciously happy to see you.",

      "Grave Belle looks you up and down. Apparently dinner has arrived.",

      "Death has done very little for her confidence.",
    ],

    hitLines: [
      "Personal space remains an unresolved issue.",

      "She seems pleased with herself.",

      "That was unnecessarily intimate.",

      "Apparently manners died first.",
    ],

    killLines: [
      "Grave Belle collapses dramatically. Even now, she commits to the performance.",

      "Grave Belle has died again. Awkward.",

      "Her second death was somehow more theatrical than the first.",

      "Grave Belle exits with all the subtlety of her entrance.",
    ],
  },

  {
    name: "Miss Morgue",

    species: "Zombie",

    image:
      "/monsters/zombie-2-miss-morgue.webp?v=art-20260825-v2",

    flavor:
      "She wants brains, compliments, and preferably both.",

    chance: "45%",

    baseGold: 5,

    encounters: [
      "Miss Morgue appears with the confidence of someone who has nothing left to lose.",

      "She smiles. You immediately regret being biologically active.",

      "Miss Morgue has arrived. She seems professionally interested in your pulse.",

      "She looks surprisingly cheerful for someone with no vital signs.",
    ],

    hitLines: [
      "She calls that bedside manner.",

      "Your insurance probably does not cover this.",

      "Miss Morgue seems delighted by the result.",

      "Medical ethics have left the dungeon.",
    ],

    killLines: [
      "Miss Morgue clocks out permanently. Again.",

      "Miss Morgue is no longer accepting patients.",

      "The consultation has been terminated.",

      "Cause of death: adventurer.",
    ],
  },

  {
    name: "Velvet Rot",

    species: "Zombie",

    image:
      "/monsters/zombie-3-velvet-rot.webp?v=art-20260825-v2",

    flavor:
      "Somewhere between a nightmare and a questionable dating decision.",

    chance: "45%",

    baseGold: 5,

    encounters: [
      "Velvet Rot enters like this is somehow your fault.",

      "She makes undeath look alarmingly deliberate.",

      "Velvet Rot gives you the kind of smile usually followed by paperwork.",

      "You suddenly understand why the dungeon has no dating app.",
    ],

    hitLines: [
      "That relationship escalated quickly.",

      "She takes your discomfort as encouragement.",

      "Velvet appears satisfied. You are less enthusiastic.",

      "This date is going badly.",
    ],

    killLines: [
      "Velvet Rot dramatically exits the relationship.",

      "There will not be a second date.",

      "Velvet Rot leaves behind several red flags and some gold.",

      "It's not you. It's the sword.",
    ],
  },

  {
    name: "Lady Decomposition",

    species: "Zombie",

    image:
      "/monsters/zombie-4-lady-decomposition.webp?v=art-20260825-v2",

    flavor:
      "Beauty fades. Apparently attitude does not.",

    chance: "45%",

    baseGold: 5,

    encounters: [
      "Lady Decomposition arrives fashionably late by several centuries.",

      "She has the posture of royalty and the circulation of furniture.",

      "Lady Decomposition looks offended that you are still alive.",

      "Apparently the aristocracy survives everything except decomposition.",
    ],

    hitLines: [
      "Nobility has spoken.",

      "She considers this appropriate etiquette.",

      "The aristocracy remains surprisingly hands-on.",

      "You have offended the undead upper class.",
    ],

    killLines: [
      "Lady Decomposition finally experiences downward mobility.",

      "The undead aristocracy has lost another member.",

      "Her reign ends with significantly less dignity than intended.",

      "The estate will be hearing about this.",
    ],
  },
];

/*
  ------------------------------------------------------------
  GOBLINS
  ------------------------------------------------------------
*/

const goblinVariants: MonsterPersona[] = [
  {
    name: "Gary",

    species: "Goblin",

    image:
      "/monsters/goblin-1-gary.webp?v=art-20260825-v2",

    flavor:
      "Gary has no plan, but he is extremely committed to it.",

    chance: "35%",

    baseGold: 8,

    encounters: [
      "Gary charges. Planning was apparently optional.",

      "Gary has mistaken confidence for competence.",

      "He has a knife, several bad ideas, and absolutely nothing to lose.",

      "Gary appears. Nobody requested Gary.",
    ],

    hitLines: [
      "This has significantly improved Gary's confidence.",

      "Gary looks shocked that this worked.",

      "Gary immediately considers himself a tactical genius.",

      "This was the best moment of Gary's week.",
    ],

    killLines: [
      "Gary has been promoted to former employee.",

      "Gary's plan has encountered a minor implementation issue.",

      "Gary is no longer available for comment.",

      "Gary finally runs out of confidence.",
    ],
  },

  {
    name: "Kevin the Unqualified",

    species: "Goblin",

    image:
      "/monsters/goblin-2-kevin-the-unqualified.webp?v=art-20260825-v2",

    flavor:
      "Nobody knows who hired Kevin. Kevin included.",

    chance: "35%",

    baseGold: 8,

    encounters: [
      "Kevin arrives carrying equipment he clearly does not understand.",

      "Kevin has received absolutely no training for this.",

      "Someone gave Kevin responsibility. This was a mistake.",

      "Kevin looks prepared. This is misleading.",
    ],

    hitLines: [
      "Kevin cannot believe that worked.",

      "His annual review is going surprisingly well.",

      "Kevin briefly achieves competence.",

      "This will absolutely go on Kevin's résumé.",
    ],

    killLines: [
      "Kevin has failed probation.",

      "Kevin's contract has been terminated with immediate effect.",

      "The hiring manager has several questions to answer.",

      "Kevin's onboarding process ends abruptly.",
    ],
  },

  {
    name: "Gribble",

    species: "Goblin",

    image:
      "/monsters/goblin-3-gribble.webp?v=art-20260825-v2",

    flavor:
      "Gribble has discovered armor. Civilization may never recover.",

    chance: "35%",

    baseGold: 8,

    encounters: [
      "Gribble has acquired equipment and immediately become unbearable.",

      "Gribble appears to have discovered the concept of preparation.",

      "Someone armed Gribble properly. Find them.",

      "Gribble looks extremely proud of several stolen objects.",
    ],

    hitLines: [
      "Gribble's investment in equipment pays dividends.",

      "He is going to talk about that hit for weeks.",

      "Gribble considers this proof of superiority.",

      "His confidence reaches dangerous levels.",
    ],

    killLines: [
      "Gribble's technological revolution ends here.",

      "Civilization narrowly avoids the Gribble era.",

      "Gribble's equipment is now available on the secondary market.",

      "Progress has once again been contained.",
    ],
  },

  {
    name: "Gary's Supervisor",

    species: "Goblin",

    image:
      "/monsters/goblin-4-garys-supervisor.webp?v=art-20260825-v2",

    flavor:
      "You finally found the person responsible for Gary.",

    chance: "35%",

    baseGold: 8,

    encounters: [
      "Gary's Supervisor would like to discuss your recent performance.",

      "Management has become aware of the Gary situation.",

      "He has a title, a coat, and no visible qualifications.",

      "You finally meet the man who approved Gary.",
    ],

    hitLines: [
      "Management considers this constructive feedback.",

      "Your performance review is deteriorating.",

      "He calls this leadership.",

      "Apparently this qualifies as employee development.",
    ],

    killLines: [
      "Gary's Supervisor has been removed from management.",

      "The organization chart just improved.",

      "Gary is now effectively unsupervised. Somehow worse.",

      "Middle management takes another historic loss.",
    ],
  },
];

/*
  ------------------------------------------------------------
  ORCS
  ------------------------------------------------------------
*/

const orcVariants: MonsterPersona[] = [
  {
    name: "Thud",

    species: "Orc",

    image:
      "/monsters/orc-1-thud.webp?v=art-20260825-v2",

    flavor:
      "Thud hits first, thinks never.",

    chance: "20%",

    baseGold: 12,

    encounters: [
      "Thud appears. The dungeon floor files a structural complaint.",

      "Thud has chosen force. To be fair, Thud always chooses force.",

      "He briefly considers strategy. The moment passes.",

      "Thud enters the room like a collapsing building.",
    ],

    hitLines: [
      "Complex negotiations have failed.",

      "Thud considers this diplomacy.",

      "The floor shakes slightly.",

      "Thud appears intellectually satisfied.",
    ],

    killLines: [
      "Thud falls over. The dungeon briefly registers seismic activity.",

      "Thud has encountered an unsolvable problem.",

      "The structural complaint has been resolved.",

      "Gravity completes the performance.",
    ],
  },

  {
    name: "Brutus",

    species: "Orc",

    image:
      "/monsters/orc-2-brutus.webp?v=art-20260825-v2",

    flavor:
      "His tactical doctrine contains one word: harder.",

    chance: "20%",

    baseGold: 12,

    encounters: [
      "Brutus has developed a strategy. Unfortunately it is still hitting things.",

      "Brutus believes subtlety is a type of weakness.",

      "His battle plan appears to have been written in crayon.",

      "Brutus arrives with several muscles and very few questions.",
    ],

    hitLines: [
      "His doctrine remains frustratingly effective.",

      "Brutus sees no reason to reconsider the plan.",

      "Thinking remains unnecessary.",

      "He seems encouraged by the simplicity of violence.",
    ],

    killLines: [
      "Brutus discovers that harder was not always the answer.",

      "The tactical doctrine requires revision.",

      "Brutus has reached the limits of applied force.",

      "The crayon battle plan requires significant amendments.",
    ],
  },

  {
    name: "Gronk",

    species: "Orc",

    image:
      "/monsters/orc-3-gronk.webp?v=art-20260825-v2",

    flavor:
      "Gronk briefly considered diplomacy. He did not enjoy it.",

    chance: "20%",

    baseGold: 12,

    encounters: [
      "Gronk enters. Diplomatic relations immediately deteriorate.",

      "Gronk has returned to his preferred negotiation format.",

      "Gronk has one facial expression. This is it.",

      "Negotiations begin without an agenda and with several muscles.",
    ],

    hitLines: [
      "Diplomacy has officially ended.",

      "Gronk considers the discussion productive.",

      "The negotiations remain physical.",

      "Gronk nods approvingly at his own technique.",
    ],

    killLines: [
      "Gronk's diplomatic mission has concluded.",

      "Peace has been restored through unconventional means.",

      "Gronk will not be attending the next summit.",

      "Formal relations have been suspended indefinitely.",
    ],
  },

  {
    name: "Meatwall",

    species: "Orc",

    image:
      "/monsters/orc-4-meatwall.webp?v=art-20260825-v2",

    flavor:
      "Less of an opponent. More of an architectural problem.",

    chance: "20%",

    baseGold: 12,

    encounters: [
      "Meatwall arrives. Technically, part of the room arrives with him.",

      "You are unsure whether to fight him or obtain planning permission.",

      "Meatwall appears to violate several building regulations.",

      "The dungeon has somehow developed shoulders.",
    ],

    hitLines: [
      "Architecture becomes unexpectedly aggressive.",

      "You have been struck by infrastructure.",

      "The building regulations remain unenforced.",

      "Meatwall continues being geographically inconvenient.",
    ],

    killLines: [
      "Meatwall becomes floorplan.",

      "The architectural problem has been demolished.",

      "Local property values immediately improve.",

      "Planning permission is no longer required.",
    ],
  },
];

/*
  ------------------------------------------------------------
  BOSSES
  ------------------------------------------------------------
*/

const bossVariants: MonsterPersona[] = [
  {
    name: "The Dungeon Lord",

    species: "Boss",

    rank: "Dungeon Management",

    image:
      "/monsters/boss-1-dungeon-lord.webp?v=art-20260825-v2",

    flavor:
      "Runs the dungeon with absolute authority and questionable administrative competence.",

    chance: "BOSS",

    baseGold: 30,

    encounters: [
      "The Dungeon Lord looks up from his paperwork. You have interrupted something deeply unnecessary.",

      "The Dungeon Lord sighs. Apparently nobody around here can do their job.",

      "The first layer of management has been notified.",

      "A crown, a title and absolutely no accountability.",
    ],

    hitLines: [
      "Management has entered the fight.",

      "This will be documented in the quarterly report.",

      "The Dungeon Lord calls this performance management.",

      "Your complaint has been denied.",
    ],

    killLines: [
      "The Dungeon Lord has been defeated. Organizational restructuring begins immediately.",

      "Dungeon management is currently unavailable.",

      "The first layer of management has collapsed.",

      "The org chart has developed a vacancy.",
    ],
  },

  {
    name: "The Senior Dungeon Lord",

    species: "Boss",

    rank: "Senior Management",

    image:
      "/monsters/boss-2-senior-dungeon-lord.webp?v=art-20260825-v2",

    flavor:
      "More authority, more paperwork, exactly the same leadership skills.",

    chance: "BOSS",

    baseGold: 30,

    encounters: [
      "Your case has been escalated to senior management.",

      "Apparently defeating his subordinate generated paperwork.",

      "The Senior Dungeon Lord has reviewed your file. He dislikes it.",

      "Management would like this matter resolved permanently.",
    ],

    hitLines: [
      "Senior management provides direct feedback.",

      "This meeting is becoming increasingly hostile.",

      "Your escalation request has been denied.",

      "The chain of command remains surprisingly physical.",
    ],

    killLines: [
      "Senior management has left the organization.",

      "Your case has now been escalated even further.",

      "The dungeon urgently requires succession planning.",

      "The promotion committee regrets everything.",
    ],
  },

  {
    name: "The Executive Overlord",

    species: "Boss",

    rank: "Executive Management",

    image:
      "/monsters/boss-3-executive-overlord.webp?v=art-20260825-v2",

    flavor:
      "Promoted beyond competence. Unfortunately, also beyond mortality.",

    chance: "BOSS",

    baseGold: 30,

    encounters: [
      "The Executive Overlord has reviewed the incident report.",

      "Your survival has become a board-level concern.",

      "He was told this would take five minutes.",

      "The executive team has finally noticed you.",
    ],

    hitLines: [
      "Executive action has been authorized.",

      "This is what leadership calls decisive action.",

      "The quarterly targets suddenly feel personal.",

      "Your KPI is now survival.",
    ],

    killLines: [
      "The executive team has lost quorum.",

      "Corporate governance has broken down completely.",

      "Your case is moving to the very top.",

      "Executive leadership has been involuntarily streamlined.",
    ],
  },

  {
    name: "The Chairman Below",

    species: "Boss",

    rank: "Board Level",

    image:
      "/monsters/boss-4-chairman-below.webp?v=art-20260825-v2",

    flavor:
      "The final authority. There is no escalation path above him.",

    chance: "BOSS",

    baseGold: 30,

    encounters: [
      "The Chairman Below has cancelled three meetings to deal with you personally.",

      "You have reached the top of an organization that should never have existed.",

      "The Chairman has read the reports. All of them.",

      "The dungeon's final escalation procedure is apparently this.",
    ],

    hitLines: [
      "The board has reached a unanimous decision.",

      "Your appeal period has expired.",

      "Corporate policy has become extremely literal.",

      "The Chairman calls this stakeholder engagement.",
    ],

    killLines: [
      "The Chairman Below has been removed by unanimous adventurer vote.",

      "The board is dissolved. Mostly because you dissolved it.",

      "The dungeon enters immediate administration.",

      "There is officially nobody left to escalate this to.",
    ],
  },
];

/*
  ============================================================
  LOOT
  ============================================================
*/

const lootTypes = [
  {
    name: "None",
    icon: "",
    chance: "",
  },

  {
    name: "Potion",
    icon: "🧪",
    chance: "30%",
  },

  {
    name: "Bonus Gold",
    icon: "🪙",
    chance: "50%",
  },

  {
    name: "Weapon Upgrade",
    icon: "⚔️",
    chance: "10%",
  },

  {
    name: "Armor Upgrade",
    icon: "🛡️",
    chance: "10%",
  },
];

/*
  ============================================================
  FETCH STATE
  ============================================================
*/

function playerStateFromFrontendSnapshot(
  snapshot: any,
  relicSnapshot?: any
) {
  const ownedRelicsMask =
    Number(
      relicSnapshot
        ?.ownedRelicsMask ??
        0
    );

  const ownedRelics =
    Array.from(
      { length: 15 },
      (_, index) =>
        index + 1
    ).filter(
      (relicId) =>
        (
          ownedRelicsMask &
          (
            1 <<
            (relicId - 1)
          )
        ) !==
        0
    );

  const relicCounts = [
    0,
    ...Array.from(
      relicSnapshot
        ?.relicCounts ??
        [],
      (count) =>
        Number(
          count
        )
    ),
  ];

  return {
    hp:
      Number(
        snapshot.hp
      ),

    monsterHp:
      Number(
        snapshot.monsterHp
      ),

    monsterMaxHp:
      Number(
        snapshot.monsterMaxHp
      ),

    roomsCleared:
      Number(
        snapshot.roomsCleared
      ),

    gold:
      Number(
        snapshot.gold
      ),

    potions:
      Number(
        snapshot.potions
      ),

    weaponLevel:
      Number(
        snapshot.weaponLevel
      ),

    armorLevel:
      Number(
        snapshot.armorLevel
      ),

    monsterType:
      Number(
        snapshot.monsterType
      ),

    lastLootType:
      Number(
        snapshot.lastLootType
      ),

    lastLootAmount:
      Number(
        snapshot.lastLootAmount
      ),

    hasStarted:
      snapshot.hasStarted,

    active:
      snapshot.active,

    attackMin:
      Number(
        snapshot.attackMin
      ),

    attackMax:
      Number(
        snapshot.attackMax
      ),

    monsterDamageMin:
      Number(
        snapshot.monsterMin
      ),

    monsterDamageMax:
      Number(
        snapshot.monsterMax
      ),

    pendingRequestId:
      snapshot.requestId as bigint,

    pendingRequestKind:
      Number(
        snapshot.requestKind
      ),

    lastPlayerDamage:
      Number(
        snapshot.playerDamage
      ),

    lastMonsterDamage:
      Number(
        snapshot.monsterDamage
      ),

    lastCritical:
      snapshot.critical,

    campOpen:
      snapshot.campOpen,

    campRestUsed:
      snapshot.restUsed,

    campPotionPurchases:
      Number(
        snapshot.campPotionPurchases
      ),

    combatPotionUses:
      Number(
        snapshot.combatPotionUses
      ),

    supplyOpen:
      snapshot.supplyOpen,

    supplyBandageUsed:
      snapshot.bandageUsed,

    supplyPotionPurchases:
      Number(
        snapshot.supplyPotionPurchases
      ),

    equippedRelic:
      Number(
        snapshot.equippedRelic ??
          0
      ),

    relicOfferAvailable:
      snapshot.relicOfferAvailable ??
      false,

    relicOfferRarity:
      Number(
        snapshot.relicOfferRarity ??
          0
      ),

    relicOfferId:
      Number(
        relicSnapshot
          ?.relicOffer ??
          0
      ),

    ownedRelics,

    relicCounts,

    baseMaxHp:
      Number(
        relicSnapshot
          ?.baseMaxHp ??
          snapshot.maxHp ??
          100
      ),

    stormMax:
      Number(
        relicSnapshot
          ?.stormMax ??
          (
            Number(
              snapshot.attackMin ??
              8
            ) +
            Number(
              snapshot.attackMax ??
              12
            )
          )
      ),

    supportsRelicCollection:
      Boolean(
        relicSnapshot
      ),

    maxHp:
      Number(
        snapshot.maxHp ??
          100
      ),

    criticalChance:
      Number(
        snapshot.criticalChance ??
          15
      ),

    relicReviveUsed:
      snapshot.relicReviveUsed ??
      false,
  };
}

async function fetchPlayerState(
  playerAddress:
    Address,

  source:
    "realtime" | "canonical" =
      "canonical"
) {
  const reader =
    source ===
    "realtime"
      ? realtimeClient
      : publicClient;

  let snapshot: unknown;

  if (
    supportsFrontendSnapshotV3 !==
    false
  ) {
    try {
      const relicSnapshot =
        await reader.readContract({
        address:
          DUNGEON_ADDRESS,

        abi:
          dungeonAbi,

        functionName:
          "frontendSnapshotV3",

        args: [
          playerAddress,
        ],

        ...(
          source ===
          "realtime"
            ? {
                blockTag:
                  "pending" as const,
              }
            : {}
        ),
        });

      supportsFrontendSnapshotV3 =
        true;
      return playerStateFromFrontendSnapshot(
        relicSnapshot.base,
        relicSnapshot
      );
    } catch {
      supportsFrontendSnapshotV3 =
        false;
      // The currently deployed contract remains readable during the V3 rollout.
    }
  }

  try {
    snapshot =
      await reader.readContract({
        address:
          DUNGEON_ADDRESS,

        abi:
          dungeonAbi,

        functionName:
          "frontendSnapshot",

        args: [
          playerAddress,
        ],

        ...(
          source ===
          "realtime"
            ? {
                blockTag:
                  "pending" as const,
              }
            : {}
        ),
      });
  } catch (
    v2SnapshotError
  ) {
    try {
      snapshot =
        await reader.readContract({
          address:
            DUNGEON_ADDRESS,

          abi:
            legacyFrontendSnapshotAbi,

          functionName:
            "frontendSnapshot",

          args: [
            playerAddress,
          ],

          ...(
            source ===
            "realtime"
              ? {
                  blockTag:
                    "pending" as const,
                }
              : {}
          ),
        });
    } catch {
      throw v2SnapshotError;
    }
  }

  return playerStateFromFrontendSnapshot(
    snapshot
  );
}

type PlayerState =
  Awaited<
    ReturnType<
      typeof fetchPlayerState
    >
  >;

type VrfCacheEntry = {
  player: Address;
  requestId: bigint;
  kind: number;
  source:
    "realtime" | "canonical";
  receivedAt: number;
};

/*
  ============================================================
  GENERIC HELPERS
  ============================================================
*/

function sleep(
  ms: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function playerStateChanged(
  before: PlayerState,
  after: PlayerState
) {
  return (
    before.hp !== after.hp ||
    before.monsterHp !== after.monsterHp ||
    before.monsterMaxHp !== after.monsterMaxHp ||
    before.roomsCleared !== after.roomsCleared ||
    before.gold !== after.gold ||
    before.potions !== after.potions ||
    before.weaponLevel !== after.weaponLevel ||
    before.armorLevel !== after.armorLevel ||
    before.monsterType !== after.monsterType ||
    before.lastLootType !== after.lastLootType ||
    before.lastLootAmount !== after.lastLootAmount ||
    before.hasStarted !== after.hasStarted ||
    before.active !== after.active ||
    before.lastPlayerDamage !== after.lastPlayerDamage ||
    before.lastMonsterDamage !== after.lastMonsterDamage ||
    before.lastCritical !== after.lastCritical ||
    before.campOpen !== after.campOpen ||
    before.campRestUsed !== after.campRestUsed ||
    before.campPotionPurchases !== after.campPotionPurchases ||
    before.combatPotionUses !== after.combatPotionUses ||
    before.supplyOpen !== after.supplyOpen ||
    before.supplyBandageUsed !== after.supplyBandageUsed ||
    before.supplyPotionPurchases !== after.supplyPotionPurchases ||
    before.equippedRelic !== after.equippedRelic ||
    before.relicOfferAvailable !== after.relicOfferAvailable ||
    before.relicOfferRarity !== after.relicOfferRarity ||
    before.relicOfferId !== after.relicOfferId ||
    before.ownedRelics.join(",") !== after.ownedRelics.join(",") ||
    before.relicCounts.join(",") !== after.relicCounts.join(",") ||
    before.baseMaxHp !== after.baseMaxHp ||
    before.stormMax !== after.stormMax ||
    before.maxHp !== after.maxHp ||
    before.criticalChance !== after.criticalChance ||
    before.relicReviveUsed !== after.relicReviveUsed
  );
}

function randomChoice<T>(
  values: readonly T[]
): T {
  return values[
    Math.floor(
      Math.random() *
        values.length
    )
  ];
}

function randomUint256() {
  const words =
    new Uint32Array(
      8
    );

  crypto.getRandomValues(
    words
  );

  let result =
    BigInt(0);

  for (
    const word
    of words
  ) {
    result =
      (
        result <<
        BigInt(32)
      ) |
      BigInt(word);
  }

  return result;
}

function buildRandomNumbers(
  requestKind: number
) {
  let count = 1;

  if (
    requestKind ===
    RequestKind.Attack
  ) {
    count = 5;
  }

  if (
    requestKind ===
    RequestKind.Storm
  ) {
    count = 4;
  }

  return Array.from(
    {
      length:
        count,
    },

    () =>
      randomUint256()
  );
}

/*
  ============================================================
  MONSTER TIER HELPERS
  ============================================================
*/

function getRegularTier(
  room: number
) {
  if (room <= 9) {
    return 0;
  }

  if (room <= 19) {
    return 1;
  }

  if (room <= 29) {
    return 2;
  }

  return 3;
}

function getBossTier(
  room: number
) {
  if (room <= 10) {
    return 0;
  }

  if (room <= 20) {
    return 1;
  }

  if (room <= 30) {
    return 2;
  }

  return 3;
}

function getMonsterPersona(
  monsterType: number,
  room: number
): MonsterPersona {
  if (
    monsterType === 0
  ) {
    return zombieVariants[
      getRegularTier(
        room
      )
    ];
  }

  if (
    monsterType === 1
  ) {
    return goblinVariants[
      getRegularTier(
        room
      )
    ];
  }

  if (
    monsterType === 2
  ) {
    return orcVariants[
      getRegularTier(
        room
      )
    ];
  }

  return bossVariants[
    getBossTier(
      room
    )
  ];
}

/*
  ============================================================
  BOSS DIALOG
  ============================================================
*/

function getBossDialogue(
  room: number
) {
  if (room >= 60) {
    return (
      '"I no longer wish to discuss this."'
    );
  }

  if (room >= 50) {
    return (
      '"WHY ARE YOU STILL HERE?"'
    );
  }

  if (room >= 40) {
    return (
      '"You have reached the board. There is nowhere left to escalate."'
    );
  }

  if (room >= 30) {
    return (
      '"Your continued survival has become an executive-level concern."'
    );
  }

  if (room >= 20) {
    return (
      '"Your case has been escalated. I was told you would be less persistent."'
    );
  }

  return (
    '"Ah. Another adventurer. How original."'
  );
}

/*
  ============================================================
  ECONOMY HELPERS
  ============================================================
*/

function scaledGoldReward(
  monsterType: number,
  room: number
) {
  const monster =
    getMonsterPersona(
      monsterType,
      room
    );

  return (
    monster.baseGold +
    Math.floor(
      (
        monster.baseGold *
        (room - 1)
      ) /
        20
    )
  );
}

function relicOutgoingPercent(
  relicId: number,
  storm: boolean
) {
  if (relicId === 1) return 110;
  if (relicId === 2) return 95;
  if (relicId === 3) return storm ? 80 : 100;
  if (relicId === 4) return 120;
  if (relicId === 6) return storm ? 130 : 95;
  if (relicId === 7 || relicId === 8) return 95;
  if (relicId === 9) return storm ? 145 : 95;
  if (relicId === 10) return 95;
  if (relicId === 11) return storm ? 100 : 85;
  if (relicId === 12) return 105;
  if (relicId === 13) return 135;
  if (relicId === 15) return 130;
  return 100;
}

function combatRelicSummary(
  relicId: number,
  currentCriticalChance: number,
  storm: boolean
) {
  const effects: string[] = [];
  const damageChange =
    relicOutgoingPercent(
      relicId,
      storm
    ) -
    100;

  if (damageChange !== 0) {
    effects.push(
      `${damageChange > 0 ? "+" : ""}${damageChange}% DAMAGE`
    );
  }

  if (!storm) {
    const criticalBonus =
      currentCriticalChance -
      15;
    if (criticalBonus > 0) {
      effects.push(
        `+${criticalBonus} PP CRITICAL`
      );
    }
    if (relicId === 11) {
      effects.push(
        "3× CRITICAL HITS"
      );
    }
  }

  return effects.length > 0
    ? effects.join(
        " · "
      )
    : null;
}

function getCampPrices(
  bossRoom: number
) {
  const tier =
    Math.max(
      0,

      Math.floor(
        bossRoom /
          10
      ) - 1
    );

  return {
    rest:
      25 +
      tier * 5,

    potion:
      20 +
      tier * 5,

    weapon:
      60 +
      tier * 20,

    armor:
      60 +
      tier * 20,
  };
}

function getSupplyPrices(
  roomCleared: number
) {
  const tier =
    Math.max(
      0,

      Math.floor(
        (
          roomCleared -
          5
        ) /
          10
      )
    );

  return {
    bandage:
      20 +
      tier * 5,

    potion:
      25 +
      tier * 5,
  };
}

/*
  ============================================================
  POTION MATH
  ============================================================
*/

function getCombatPotionEstimate(
  hp: number,
  maxHp: number,
  monsterMin: number,
  monsterMax: number
) {
  const retaliationMin =
    Math.ceil(
      monsterMin /
        2
    );

  const retaliationMax =
    Math.ceil(
      monsterMax /
        2
    );

  const bestFinalHp =
    Math.min(
      maxHp,

      hp +
        25 -
        retaliationMin
    );

  const worstFinalHp =
    Math.min(
      maxHp,

      hp +
        25 -
        retaliationMax
    );

  return {
    min:
      worstFinalHp -
      hp,

    max:
      bestFinalHp -
      hp,
  };
}

function formatSigned(
  value: number
) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatNetRange(
  min: number,
  max: number
) {
  if (min === max) {
    return (
      `${formatSigned(min)} HP`
    );
  }

  return (
    `${formatSigned(min)} to ${formatSigned(max)} HP`
  );
}

/*
  ============================================================
  HUMOR
  ============================================================
*/

const criticalLines = [
  "CRITICAL HIT! Anatomy has left the chat.",

  "CRITICAL HIT! That looked expensive.",

  "CRITICAL HIT! Several workplace regulations were violated.",

  "CRITICAL HIT! Completely reasonable amount of force.",

  "CRITICAL HIT! The paperwork will be incredible.",

  "CRITICAL HIT! Nobody needs to see the incident report.",

  "CRITICAL HIT! Absolutely textbook. A very concerning textbook.",
];

const normalDeathLines = [
  "☠️ You died. The dungeon updates its statistics.",

  "☠️ You died. Please leave your equipment with reception.",

  "☠️ Your run has been terminated with immediate effect.",

  "☠️ You died. Management appreciates your contribution.",

  "☠️ The dungeon records another successful onboarding.",

  "☠️ You have been permanently removed from the workflow.",

  "☠️ Your adventure has entered an indefinite leave of absence.",
];

const stormDeathLines = [
  "☠️ You died. The storm declines responsibility.",

  "☠️ You trusted the storm. The storm did not reciprocate.",

  "☠️ The forecast called for poor decisions.",

  "☠️ Storm-related consequences have occurred.",

  "☠️ You gambled on the weather and lost.",

  "☠️ The storm worked perfectly. Just not for you.",
];

const stormZeroLines = [
  "⚡ Storm Attack deals 0 DAMAGE. The storm has apparently taken the day off.",

  "⚡ Storm Attack deals 0 DAMAGE. Magnificent presentation. No measurable effect.",

  "⚡ Storm Attack deals 0 DAMAGE. Somewhere, thunder quietly apologizes.",

  "⚡ Storm Attack deals 0 DAMAGE. You successfully intimidate the atmosphere.",

  "⚡ Storm Attack deals 0 DAMAGE. The weather department denies involvement.",

  "⚡ Storm Attack deals 0 DAMAGE. A light breeze would have been more effective.",
];

function stormLine(
  template: string,
  damage: number
) {
  return template.replace(
    "{damage}",
    `${damage}`
  );
}

const stormLowLines = [
  "⚡ Storm Attack deals {damage} DAMAGE. Nobody is impressed.",

  "⚡ Storm Attack deals {damage} DAMAGE. Technically, something happened.",

  "⚡ Storm Attack deals {damage} DAMAGE. More drizzle than thunderstorm.",

  "⚡ Storm Attack deals {damage} DAMAGE. The monster looks mildly inconvenienced.",

  "⚡ Storm Attack deals {damage} DAMAGE. Expectations have been adjusted downward.",

  "⚡ Storm Attack deals {damage} DAMAGE. Dramatic entrance, modest results.",

  "⚡ Storm Attack deals {damage} DAMAGE. The atmosphere tried its best.",
];

const stormMediumLines = [
  "⚡ Storm Attack deals {damage} DAMAGE. Acceptable chaos.",

  "⚡ Storm Attack deals {damage} DAMAGE. The weather is beginning to cooperate.",

  "⚡ Storm Attack deals {damage} DAMAGE. Surprisingly respectable.",

  "⚡ Storm Attack deals {damage} DAMAGE. Nobody is filing a complaint.",

  "⚡ Storm Attack deals {damage} DAMAGE. Reasonably irresponsible.",

  "⚡ Storm Attack deals {damage} DAMAGE. The storm earns a satisfactory rating.",

  "⚡ Storm Attack deals {damage} DAMAGE. Dangerous enough to justify the button.",
];

const stormHighLines = [
  "⚡ Storm Attack deals {damage} DAMAGE. Completely intentional.",

  "⚡ Storm Attack deals {damage} DAMAGE. We will pretend that was calculated.",

  "⚡ Storm Attack deals {damage} DAMAGE. Shockingly competent.",

  "⚡ Storm Attack deals {damage} DAMAGE. Exactly as planned. Probably.",

  "⚡ Storm Attack deals {damage} DAMAGE. The weather department approves.",

  "⚡ Storm Attack deals {damage} DAMAGE. Suddenly this seems like a good strategy.",

  "⚡ Storm Attack deals {damage} DAMAGE. Risk management has left the dungeon.",
];

const stormExtremeLines = [
  "⚡ Storm Attack deals {damage} DAMAGE. The storm has chosen violence.",

  "⚡ Storm Attack deals {damage} DAMAGE. That escalated meteorologically.",

  "⚡ Storm Attack deals {damage} DAMAGE. Forecast: catastrophic.",

  "⚡ Storm Attack deals {damage} DAMAGE. Several insurance policies just expired.",

  "⚡ Storm Attack deals {damage} DAMAGE. The atmosphere has become a weapon.",

  "⚡ Storm Attack deals {damage} DAMAGE. Completely unreasonable. Excellent.",

  "⚡ Storm Attack deals {damage} DAMAGE. Thunder would like credit for this.",
];

function getStormMessage(
  damage: number,
  stormMax: number
) {
  if (damage === 0) {
    return randomChoice(
      stormZeroLines
    );
  }

  const ratio =
    stormMax > 0
      ? damage /
        stormMax
      : 0;

  if (ratio < 0.25) {
    return stormLine(
      randomChoice(
        stormLowLines
      ),
      damage
    );
  }

  if (ratio < 0.55) {
    return stormLine(
      randomChoice(
        stormMediumLines
      ),
      damage
    );
  }

  if (ratio < 0.85) {
    return stormLine(
      randomChoice(
        stormHighLines
      ),
      damage
    );
  }

  return stormLine(
    randomChoice(
      stormExtremeLines
    ),
    damage
  );
}

function getLootMessage(
  state: PlayerState
) {
  if (
    state.lastLootType ===
    1
  ) {
    return (
      `🧪 Potion acquired. Smells illegal. Inventory ${state.potions}/${MAX_POTIONS}.`
    );
  }

  if (
    state.lastLootType ===
    2
  ) {
    return (
      `🪙 Bonus Gold +${state.lastLootAmount}. You find money. No questions are asked.`
    );
  }

  if (
    state.lastLootType ===
    3
  ) {
    const bonus =
      state.weaponLevel *
      2;

    return (
      `⚔️ Weapon upgraded to Level ${state.weaponLevel}. +${bonus} DAMAGE. Finally, a weapon with standards.`
    );
  }

  if (
    state.lastLootType ===
    4
  ) {
    return (
      `🛡️ Armor upgraded to Level ${state.armorLevel}. Absorbs up to ${state.armorLevel} DAMAGE per hit, capped at ${MAX_ARMOR_REDUCTION_PERCENT}% reduction.`
    );
  }

  return "";
}

/*
  ============================================================
  PAGE
  ============================================================
*/

function RiseProviders({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const [
    queryClient,
  ] =
    useState(
      () =>
        new QueryClient()
    );

  return (
    <WagmiProvider
      config={
        wagmiConfig
      }
      reconnectOnMount={true}
    >
      <QueryClientProvider
        client={
          queryClient
        }
      >
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default function Home() {
  return (
    <RiseProviders>
      <DelvewornGame />
    </RiseProviders>
  );
}

function DelvewornGame() {
  const {
    address:
      wagmiAddress,
    isConnected,
    connector,
  } =
    useConnection();

  const chainId =
    useChainId();

  const connectMutation =
    useConnect();

  const disconnectMutation =
    useDisconnect();

  const connectors =
    useConnectors();

  const grantPermissions =
    Hooks.useGrantPermissions();

  const revokePermissions =
    Hooks.useRevokePermissions();

  const permissionsQuery =
    Hooks.usePermissions();

  const [
    player,
    setPlayer,
  ] =
    useState<
      PlayerState | null
    >(null);

  const [
    connectedAddress,
    setConnectedAddress,
  ] =
    useState<
      Address | null
    >(null);

  const [
    walletMessage,
    setWalletMessage,
  ] =
    useState<string>(
      ""
    );

  const [
    walletChoiceOpen,
    setWalletChoiceOpen,
  ] = useState(false);

  const [
    sessionPrivateKey,
    setSessionPrivateKey,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  const [
    sessionPublicKey,
    setSessionPublicKey,
  ] =
    useState<
      string | null
    >(null);

  const [
    sessionAuthorized,
    setSessionAuthorized,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    pendingAction,
    setPendingAction,
  ] =
    useState<
      PendingAction | null
    >(null);

  const [
    rollingKind,
    setRollingKind,
  ] =
    useState<number>(
      RequestKind.None
    );

  const [
    vrfDelayed,
    setVrfDelayed,
  ] =
    useState(false);

  const [
    vrfRetryAvailable,
    setVrfRetryAvailable,
  ] =
    useState(false);

  const [
    vrfRetrying,
    setVrfRetrying,
  ] =
    useState(false);

  const [
    combatLog,
    setCombatLog,
  ] =
    useState<string[]>(
      []
    );

  const [
    lootFlash,
    setLootFlash,
  ] =
    useState(false);

  const [
    mobileLogOpen,
    setMobileLogOpen,
  ] =
    useState(false);

  /*
    A VRF completion event can arrive before the canonical RPC state
    is ready to accept the next transaction. Keep a separate hard
    action lock so the UI can never submit the next Attack / Storm /
    Potion while the previous request is still considered pending by
    the RPC used by MetaMask for simulation.
  */
  const [
    actionReady,
    setActionReady,
  ] =
    useState(true);

  const [
    canonicalSyncing,
    setCanonicalSyncing,
  ] =
    useState(false);

  const canonicalRecoveryRef =
    useRef(false);

  const sessionBundleFailureRef =
    useRef<
      Map<string, string>
    >(
      new Map()
    );

  const vrfResultsRef =
    useRef<
      Map<
        string,
        VrfCacheEntry
      >
    >(
      new Map()
    );

  const connectedAddressRef =
    useRef<
      Address | null
    >(null);

  const actionTimingRef =
    useRef<{
      name: string;
      startedAt: number;
    } | null>(null);

  const bossRewardRef =
    useRef<HTMLDivElement | null>(
      null
    );

  function timingLog(
    stage: string
  ) {
    const timing =
      actionTimingRef.current;

    if (!timing) {
      console.info(
        `[RISE TIMING] ${stage}`
      );

      return;
    }

    console.info(
      `[RISE TIMING] ${timing.name} ${stage}: +${runtimeNowMs() - timing.startedAt}ms`
    );
  }

  useEffect(() => {
    connectedAddressRef.current =
      connectedAddress;
  }, [
    connectedAddress,
  ]);

  const permissionList =
    (
      permissionsQuery.data ??
      []
    ) as unknown as ReadonlyArray<{
      id?:
        string;

      expiry?:
        number;

      key?: {
        publicKey?:
          string;
      };
    }>;

  const activePermission =
    permissionList.find(
      (
        permission
      ) => {
        if (
          !sessionPublicKey ||
          !permission.key
            ?.publicKey
        ) {
          return false;
        }

        return (
          permission.key.publicKey
            .toLowerCase() ===
            sessionPublicKey.toLowerCase() &&
          Number(
            permission.expiry ??
              0
          ) >
            Math.floor(
              runtimeNowMs() /
                1000
            )
        );
      }
    );

  const hasSession =
    Boolean(
      sessionPrivateKey &&
      sessionPublicKey &&
      (
        activePermission ||
        sessionAuthorized
      )
    );

  const isRiseWallet =
    connector?.id ===
      RISE_WALLET_CONNECTOR_ID;

  const isMetaMask =
    connector?.id ===
      METAMASK_CONNECTOR_ID ||
    connector?.name ===
      METAMASK_CONNECTOR_NAME;

  const canPlay =
    Boolean(
      (
        isRiseWallet &&
        hasSession
      ) ||
      isMetaMask
    );

  function loadStoredSession(
    address: Address
  ) {
    const stored =
      localStorage.getItem(
        sessionStorageKey(
          address
        )
      ) as
        | `0x${string}`
        | null;

    if (!stored) {
      setSessionPrivateKey(
        null
      );

      setSessionPublicKey(
        null
      );

      setSessionAuthorized(
        false
      );

      return;
    }

    try {
      const publicKey =
        PublicKey.toHex(
          P256.getPublicKey({
            privateKey:
              stored,
          }),
          {
            includePrefix:
              false,
          }
        );

      setSessionPrivateKey(
        stored
      );

      setSessionPublicKey(
        publicKey
      );

      setSessionAuthorized(
        false
      );
    } catch (
      error
    ) {
      console.warn(
        "Stored session key could not be loaded:",
        error
      );

      localStorage.removeItem(
        sessionStorageKey(
          address
        )
      );

      setSessionPrivateKey(
        null
      );

      setSessionPublicKey(
        null
      );

      setSessionAuthorized(
        false
      );
    }
  }

  /*
    ==========================================================
    LOG
    ==========================================================
  */

  function addMessages(
    messages:
      string[]
  ) {
    if (
      messages.length ===
      0
    ) {
      return;
    }

    setCombatLog(
      (previous) =>
        [
          ...[
            ...messages,
          ].reverse(),

          ...previous,
        ].slice(
          0,
          18
        )
    );
  }

  function flashLoot() {
    setLootFlash(
      true
    );

    setTimeout(
      () => {
        setLootFlash(
          false
        );
      },

      900
    );
  }

  /*
    ==========================================================
    RECEIPT
    ==========================================================
  */

  async function waitForReceipt(
    hash:
      `0x${string}`
  ) {
    /*
      Use the HTTP client for receipts.

      Shreds remains the fast path for lean RandomnessFulfilled completion events,
      but a temporary WebSocket disconnect must never prevent a
      submitted gameplay transaction from completing in the UI.
    */
    return publicClient
      .waitForTransactionReceipt(
        {
          hash,

          pollingInterval:
            200,
        }
      );
  }

  async function waitForCanonicalReceipt(
    hash:
      `0x${string}`
  ) {
    return publicClient
      .waitForTransactionReceipt(
        {
          hash,

          pollingInterval:
            200,
        }
      );
  }

  /*
    ==========================================================
    RISE SHREDS VRF EVENT CACHE
    ==========================================================
  */

  useEffect(() => {
    if (!connectedAddress) {
      vrfResultsRef.current.clear();
      return;
    }

    const watchedAddress =
      connectedAddress;

    vrfResultsRef.current.clear();

    /*
      The lean RandomnessFulfilled completion signal is consumed through two independent paths:

      1. Shreds / WebSocket: fastest path.
      2. HTTP event polling: reliability fallback.

      The HTTP watcher is intentionally always active. If RISE closes
      the WebSocket, gameplay continues instead of becoming dependent
      on a single long-lived socket.
    */
    const ingestVrfResult = (
      rawPlayer:
        Address,

      requestId:
        bigint,

      kind:
        number,

      source:
        "realtime" | "canonical"
    ) => {
      const normalizedPlayer =
        getAddress(
          rawPlayer
        );

      if (
        normalizedPlayer.toLowerCase() !==
          watchedAddress.toLowerCase()
      ) {
        return;
      }

      const cacheKey =
        requestId.toString();

      const existing =
        vrfResultsRef.current.get(
          cacheKey
        );

      const entry:
        VrfCacheEntry =
          existing ??
          {
            player:
              normalizedPlayer,

            requestId,

            kind:
              Number(
                kind
              ),

            source,

            receivedAt:
              runtimeNowMs(),
          };

      /*
        The same completion can arrive first through Shreds and later
        through the HTTP watcher. Preserve the original receivedAt so a
        delayed duplicate from a previous attack can never masquerade as
        the completion for a new attack of the same kind.
      */
      vrfResultsRef.current.set(
        cacheKey,
        entry
      );

      timingLog(
        `RandomnessFulfilled received via ${source} (request ${requestId.toString()}, kind ${Number(kind)})`
      );

      const activeAddress =
        connectedAddressRef.current;

      if (
        activeAddress &&
        entry.player.toLowerCase() ===
          activeAddress.toLowerCase()
      ) {
        setWalletMessage(
          ""
        );
      }
    };

    const unwatchShreds =
      realtimeClient.watchShreds({
        includeStateChanges:
          false,

        onShred:
          (
            shred
          ) => {
            for (
              const transaction
              of shred.transactions
            ) {
              for (
                const log
                of transaction.logs
              ) {
                if (
                  log.address.toLowerCase() !==
                  DUNGEON_ADDRESS.toLowerCase()
                ) {
                  continue;
                }

                try {
                  const decoded =
                    decodeEventLog({
                      abi:
                        dungeonAbi,

                      data:
                        log.data,

                      topics:
                        log.topics as unknown as [
                          `0x${string}`,
                          ...`0x${string}`[],
                        ],
                    });

                  if (
                    decoded.eventName !==
                    "RandomnessFulfilled"
                  ) {
                    continue;
                  }

                  const args =
                    decoded.args as {
                      player:
                        Address;

                      requestId:
                        bigint;

                      kind:
                        number;
                    };

                  ingestVrfResult(
                    args.player,
                    args.requestId,
                    Number(
                      args.kind
                    ),
                    "realtime"
                  );
                } catch (
                  error
                ) {
                  console.debug(
                    "Ignoring unrelated Shreds log:",
                    error
                  );
                }
              }
            }
          },

        onError:
          (
            error
          ) => {
            /*
              Do not surface this as a gameplay error.
              Viem will reconnect the socket, while the HTTP event
              watcher below continues tracking VRF completions.
            */
            console.warn(
              "RISE Shreds connection interrupted; HTTP event fallback remains active:",
              error
            );
          },
      });

    const unwatchHttpEvents =
      publicClient.watchContractEvent({
        address:
          DUNGEON_ADDRESS,

        abi:
          dungeonAbi,

        eventName:
          "RandomnessFulfilled",

        args: {
          player:
            watchedAddress,
        },

        pollingInterval:
          500,

        onLogs:
          (
            logs
          ) => {
            for (
              const log
              of logs
            ) {
              const args =
                log.args as {
                  player?:
                    Address;

                  requestId?:
                    bigint;

                  kind?:
                    number;
                };

              if (
                !args.player ||
                args.requestId ===
                  undefined ||
                args.kind ===
                  undefined
              ) {
                continue;
              }

              ingestVrfResult(
                args.player,
                args.requestId,
                Number(
                  args.kind
                ),
                "canonical"
              );
            }
          },

        onError:
          (
            error
          ) => {
            console.warn(
              "RISE HTTP event fallback issue:",
              error
            );
          },
      });

    return () => {
      unwatchShreds();
      unwatchHttpEvents();
      vrfResultsRef.current.clear();
    };
  }, [
    connectedAddress,
  ]);

  /*
    ==========================================================
    FAST VRF
    ==========================================================
  */

  async function finalizeCanonicalAction(
    playerAddress:
      Address,

    displayStartedAt:
      number,

    expectedState:
      PlayerState | null
  ):
    Promise<
      PlayerState | null
    > {
    setCanonicalSyncing(
      true
    );

    setActionReady(
      false
    );

    const deadline =
      runtimeNowMs() +
      ACTION_READY_TIMEOUT_MS;

    while (
      runtimeNowMs() <
      deadline
    ) {
      try {
        const canonical =
          await fetchPlayerState(
            playerAddress,
            "canonical"
          );

        if (
          canonical.pendingRequestId ===
            BigInt(0) &&
          (
            !expectedState ||
            !playerStateChanged(
              expectedState,
              canonical
            )
          )
        ) {
          const remainingDisplay =
            MIN_VRF_DISPLAY_MS -
            (
              runtimeNowMs() -
              displayStartedAt
            );

          if (
            remainingDisplay >
            0
          ) {
            await sleep(
              remainingDisplay
            );
          }

          setPlayer(
            canonical
          );

          setActionReady(
            true
          );

          setCanonicalSyncing(
            false
          );

          setWalletMessage(
            ""
          );

          return canonical;
        }
      } catch (
        error
      ) {
        console.debug(
          "Canonical action lock still waiting:",
          error
        );
      }

      await sleep(
        ACTION_READY_POLL_MS
      );
    }

    setWalletMessage(
      "RISE randomness is resolved, but canonical state is still catching up. Actions stay locked until the next transaction is safe to send."
    );

    /*
      Continue recovery in the background. This is deliberately
      started only after a confirmed VRF transaction, never when the
      wallet prompt first opens, so an early canonical read cannot
      unlock the UI before the transaction has actually landed.
    */
    if (
      !canonicalRecoveryRef.current
    ) {
      canonicalRecoveryRef.current =
        true;

      void (async () => {
        try {
          while (
            true
          ) {
            try {
              const canonical =
                await fetchPlayerState(
                  playerAddress,
                  "canonical"
                );

              if (
                canonical.pendingRequestId ===
                  BigInt(0) &&
                (
                  !expectedState ||
                  !playerStateChanged(
                    expectedState,
                    canonical
                  )
                )
              ) {
                setPlayer(
                  canonical
                );

                setActionReady(
                  true
                );

                setCanonicalSyncing(
                  false
                );

                setWalletMessage(
                  ""
                );

                return;
              }
            } catch (
              error
            ) {
              console.debug(
                "Background canonical recovery still waiting:",
                error
              );
            }

            await sleep(
              ACTION_READY_POLL_MS
            );
          }
        } finally {
          canonicalRecoveryRef.current =
            false;
        }
      })();
    }

    return null;
  }

  function finishFastVrfResolution(
    playerAddress:
      Address,

    displayStartedAt:
      number,

    resolvedState:
      PlayerState,

    stage:
      string
  ): PlayerState {
    setPlayer(
      resolvedState
    );

    setVrfDelayed(
      false
    );

    setVrfRetryAvailable(
      false
    );

    setActionReady(
      false
    );

    setCanonicalSyncing(
      true
    );

    setWalletMessage(
      ""
    );

    timingLog(
      stage
    );

    void finalizeCanonicalAction(
      playerAddress,
      displayStartedAt,
      resolvedState
    ).then(
      (canonical) => {
        timingLog(
          canonical
            ? "canonical action lock released"
            : "canonical action lock continuing in background"
        );
      }
    );

    return resolvedState;
  }

  async function waitForFastVRF(
    requestId:
      bigint,

    playerAddress:
      Address,

    displayStartedAt:
      number,

    expectedKind:
      number,

    eventReceivedAfter:
      number,

    beforeState:
      PlayerState | null,

    bundleId:
      string | null = null
  ):
    Promise<
      PlayerState | null
    > {
    let observedRequestId =
      requestId;

    let sawPendingRequest =
      requestId !==
      BigInt(0);

    let delayedNoticeShown =
      false;

    let lastRetryAvailabilityCheck =
      0;

    setVrfRetryAvailable(
      false
    );

    while (true) {
      const elapsed =
        runtimeNowMs() -
        displayStartedAt;

      if (
        bundleId
      ) {
        const bundleFailure =
          sessionBundleFailureRef.current.get(
            bundleId
          );

        if (
          bundleFailure
        ) {
          sessionBundleFailureRef.current.delete(
            bundleId
          );

          throw new Error(
            bundleFailure
          );
        }
      }

      if (
        elapsed >=
          VRF_CANONICAL_FALLBACK_MS &&
        !sawPendingRequest
      ) {
        try {
          const canonical =
            await fetchPlayerState(
              playerAddress,
              "canonical"
            );

          const changed =
            beforeState
              ? playerStateChanged(
                  beforeState,
                  canonical
                )
              : false;

          if (
            canonical.pendingRequestId ===
              BigInt(0) &&
            !changed
          ) {
            throw new Error(
              "RISE Wallet accepted the action, but no onchain gameplay request appeared. The action was unlocked safely so it can be tried again."
            );
          }
        } catch (
          error
        ) {
          if (
            error instanceof Error &&
            error.message.includes(
              "no onchain gameplay request appeared"
            )
          ) {
            throw error;
          }

          console.debug(
            "Submission watchdog canonical read delayed:",
            error
          );
        }
      }

      if (
        !delayedNoticeShown &&
        elapsed >=
          VRF_DELAYED_NOTICE_MS
      ) {
        delayedNoticeShown =
          true;

        setVrfDelayed(
          true
        );

        timingLog(
          "VRF delayed notice shown"
        );
      }

      if (
        elapsed >=
          VRF_DELAYED_NOTICE_MS &&
        runtimeNowMs() -
          lastRetryAvailabilityCheck >=
          1_000
      ) {
        lastRetryAvailabilityCheck =
          runtimeNowMs();

        try {
          const available =
            await publicClient.readContract({
              address:
                DUNGEON_ADDRESS,

              abi:
                dungeonAbi,

              functionName:
                "randomnessRetryAvailable",

              args: [
                playerAddress,
              ],
            });

          setVrfRetryAvailable(
            Boolean(
              available
            )
          );
        } catch (
          error
        ) {
          console.debug(
            "VRF retry availability check delayed:",
            error
          );
        }
      }

      let cached:
        VrfCacheEntry |
        undefined;

      if (
        observedRequestId !==
        BigInt(0)
      ) {
        cached =
          vrfResultsRef.current.get(
            observedRequestId.toString()
          );
      } else {
        /*
          Session-key gameplay does not wait for wallet_getCallsStatus
          on the critical path. Match the lean completion event by
          player + request kind + action start time.
        */
        for (
          const entry
          of vrfResultsRef.current.values()
        ) {
          if (
            entry.player.toLowerCase() ===
              playerAddress.toLowerCase() &&
            entry.kind ===
              expectedKind &&
            entry.receivedAt >=
              eventReceivedAfter
          ) {
            if (
              !cached ||
              entry.receivedAt >
                cached.receivedAt
            ) {
              cached =
                entry;
            }
          }
        }
      }

      if (
        cached &&
        cached.player.toLowerCase() ===
          playerAddress.toLowerCase()
      ) {
        try {
          timingLog(
            `starting state read via ${cached.source}`
          );

          const resolvedState =
            await fetchPlayerState(
              playerAddress,
              cached.source
            );

          timingLog(
            `state read via ${cached.source} completed`
          );

          if (
            resolvedState.pendingRequestId ===
            BigInt(0)
          ) {
            const remainingDisplay =
              MIN_VRF_DISPLAY_MS -
              (
                runtimeNowMs() -
                displayStartedAt
              );

            if (
              remainingDisplay >
              0
            ) {
              await sleep(
                remainingDisplay
              );
            }

            return finishFastVrfResolution(
              playerAddress,
              displayStartedAt,
              resolvedState,
              "VRF resolved; canonical action lock engaged"
            );
          }
        } catch (
          error
        ) {
          console.debug(
            "VRF completion event arrived; state read is still catching up:",
            error
          );
        }
      }

      /*
        Poll pending/realtime state in parallel with the event listeners.

        Important: a frontend timeout must NEVER unlock the action while
        the contract still has pendingRequestId != 0. This preserves the
        original action context so the battle log can be generated even
        when RISE Testnet fulfills VRF several minutes late.
      */
      if (
        elapsed >
        600
      ) {
        try {
          const realtime =
            await fetchPlayerState(
              playerAddress,
              "realtime"
            );

          if (
            realtime.pendingRequestId >
            BigInt(0)
          ) {
            sawPendingRequest =
              true;

            observedRequestId =
              realtime.pendingRequestId;
          }

          const changed =
            beforeState
              ? playerStateChanged(
                  beforeState,
                  realtime
                )
              : false;

          if (
            realtime.pendingRequestId ===
              BigInt(0) &&
            (
              cached ||
              sawPendingRequest ||
              changed
            )
          ) {
            const remainingDisplay =
              MIN_VRF_DISPLAY_MS -
              (
                runtimeNowMs() -
                displayStartedAt
              );

            if (
              remainingDisplay >
              0
            ) {
              await sleep(
                remainingDisplay
              );
            }

            return finishFastVrfResolution(
              playerAddress,
              displayStartedAt,
              realtime,
              "VRF resolved via pending-state recovery; canonical action lock engaged"
            );
          }
        } catch (
          error
        ) {
          console.debug(
            "Realtime VRF recovery still waiting:",
            error
          );
        }

        /*
          Periodically verify canonical state too. This is intentionally
          a recovery path, not the visual critical path.
        */
        if (
          elapsed %
            2_000 <
          TESTNET_POLLING_MS
        ) {
          try {
            const canonical =
              await fetchPlayerState(
                playerAddress,
                "canonical"
              );

            if (
              canonical.pendingRequestId >
              BigInt(0)
            ) {
              sawPendingRequest =
                true;

              observedRequestId =
                canonical.pendingRequestId;
            }

            const changed =
              beforeState
                ? playerStateChanged(
                    beforeState,
                    canonical
                  )
                : false;

            if (
              canonical.pendingRequestId ===
                BigInt(0) &&
              (
                cached ||
                sawPendingRequest ||
                changed
              )
            ) {
              return finishFastVrfResolution(
                playerAddress,
                displayStartedAt,
                canonical,
                "VRF resolved via canonical recovery; canonical action lock engaged"
              );
            }
          } catch (
            error
          ) {
            console.debug(
              "Canonical VRF recovery still waiting:",
              error
            );
          }
        }
      }

      await sleep(
        TESTNET_POLLING_MS
      );
    }
  }

  function extractRandomnessRequestId(
    receipt:
      Awaited<
        ReturnType<
          typeof waitForReceipt
        >
      >,

    playerAddress:
      Address,

    expectedKind:
      number
  ):
    bigint | null {
    for (
      const log
      of receipt.logs
    ) {
      if (
        log.address.toLowerCase() !==
        DUNGEON_ADDRESS.toLowerCase()
      ) {
        continue;
      }

      try {
        const decoded =
          decodeEventLog({
            abi:
              dungeonAbi,

            data:
              log.data,

            topics:
              log.topics as unknown as [
                `0x${string}`,
                ...`0x${string}`[],
              ],
          });

        if (
          decoded.eventName !==
          "RandomnessRequested"
        ) {
          continue;
        }

        const args =
          decoded.args as {
            player:
              Address;

            requestId:
              bigint;

            kind:
              number;

            numberCount:
              number;
          };

        if (
          args.player.toLowerCase() ===
            playerAddress.toLowerCase() &&
          Number(
            args.kind
          ) ===
            expectedKind
        ) {
          return args.requestId;
        }
      } catch {
        // Ignore unrelated logs.
      }
    }

    return null;
  }

  /*
    ==========================================================
    LOAD
    ==========================================================
  */

  async function loadPlayer(
    playerAddress:
      Address
  ) {
    try {
      const state =
        await fetchPlayerState(
          playerAddress,
          "canonical"
        );

      /*
        Startup must never wait for an old VRF request to resolve before
        rendering the game. If RISE still has a pending request from a
        previous action, show the current onchain state immediately, keep
        gameplay locked, and recover the VRF in the background.
      */
      setPlayer(
        state
      );

      setActionReady(
        state.pendingRequestId ===
          BigInt(0)
      );

      // A live VRF request is not the same thing as canonical finalization.
      setCanonicalSyncing(
        false
      );

      setLoading(
        false
      );

      if (
        state.pendingRequestId >
        BigInt(0)
      ) {
        const displayStartedAt =
          runtimeNowMs();

        setRollingKind(
          state.pendingRequestKind
        );

        setVrfDelayed(
          false
        );

        setVrfRetryAvailable(
          false
        );

        void (async () => {
          try {
            const recovered =
              await waitForFastVRF(
                state.pendingRequestId,
                playerAddress,
                displayStartedAt,
                state.pendingRequestKind,
                0,
                state
              );

            if (
              recovered
            ) {
              addMessages([
                "🎲 Pending RISE Fast VRF request resolved.",
              ]);
            }
          } catch (
            error
          ) {
            console.error(
              "Background startup VRF recovery failed:",
              error
            );
          } finally {
            setRollingKind(
              RequestKind.None
            );

            setVrfDelayed(
              false
            );

            setVrfRetryAvailable(
              false
            );
          }
        })();
      } else {
        setRollingKind(
          RequestKind.None
        );

        setVrfDelayed(
          false
        );

        setVrfRetryAvailable(
          false
        );
      }
    } catch (
      error
    ) {
      console.error(
        error
      );

      setWalletMessage(
        "Could not read Delveworn from RISE Testnet."
      );

      setLoading(
        false
      );
    }
  }

  async function connectWallet(
    wallet:
      "rise" |
      "metamask"
  ) {
    const label =
      wallet ===
        "rise"
        ? "RISE Wallet"
        : "MetaMask";

    try {
      setWalletMessage(
        ""
      );

      setLoading(
        true
      );

      const connectorToUse =
        connectors.find(
          (
            candidate
          ) =>
            wallet ===
              "rise"
              ? candidate.id ===
                  RISE_WALLET_CONNECTOR_ID
              : candidate.id ===
                  METAMASK_CONNECTOR_ID ||
                candidate.name ===
                  METAMASK_CONNECTOR_NAME
        );

      if (
        !connectorToUse
      ) {
        throw new Error(
          label + " connector is unavailable."
        );
      }

      await connectMutation
        .mutateAsync({
          connector:
            connectorToUse,
          chainId:
            riseTestnet.id,
        });
    } catch (
      error
    ) {
      console.error(
        error
      );

      setLoading(
        false
      );

      setWalletMessage(
        label + " connection failed."
      );
    }
  }

  async function createSession() {
    if (
      !connectedAddress ||
      !connector
    ) {
      setWalletMessage(
        "Connect RISE Wallet first."
      );

      return;
    }

    if (
      connector.id !==
      RISE_WALLET_CONNECTOR_ID
    ) {
      setWalletMessage(
        "Instant Play requires the RISE Wallet connector. Reset the wallet connection and reconnect with RISE Wallet."
      );

      return;
    }

    try {
      setWalletMessage(
        ""
      );

      const privateKey =
        P256.randomPrivateKey();

      const publicKey =
        PublicKey.toHex(
          P256.getPublicKey({
            privateKey,
          }),
          {
            includePrefix:
              false,
          }
        );

      await grantPermissions
        .mutateAsync({
          connector,

          key: {
            publicKey,
            type:
              "p256",
          },

          expiry:
            Math.floor(
              runtimeNowMs() /
                1000
            ) +
            SESSION_DURATION_SECONDS,

          feeToken:
            null,

          permissions: {
            calls:
              SESSION_FUNCTION_SIGNATURES.map(
                (
                  signature
                ) => ({
                  to:
                    DUNGEON_ADDRESS,

                  signature:
                    selectorFor(
                      signature
                    ),
                })
              ),
          },
        } as never);

      localStorage.setItem(
        sessionStorageKey(
          connectedAddress
        ),
        privateKey
      );

      setSessionPrivateKey(
        privateKey
      );

      setSessionPublicKey(
        publicKey
      );

      setSessionAuthorized(
        true
      );

      await permissionsQuery
        .refetch();

      setWalletMessage(
        ""
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      const message =
        errorText(
          error
        );

      if (
        message.includes(
          "wallet_grantPermissions"
        ) ||
        message.includes(
          "does not exist"
        ) ||
        message.includes(
          "not available"
        )
      ) {
        setWalletMessage(
          "This connection is using a standard browser-wallet provider, which cannot create RISE session keys. Reset the connection, then reconnect through RISE Wallet / passkey."
        );

        return;
      }

      setWalletMessage(
        "Could not enable Instant Play. The permission request was cancelled or failed."
      );
    }
  }

  async function resetWalletConnection() {
    try {
      if (
        connectedAddress &&
        isRiseWallet
      ) {
        localStorage.removeItem(
          sessionStorageKey(
            connectedAddress
          )
        );
      }

      setSessionPrivateKey(
        null
      );

      setSessionPublicKey(
        null
      );

      setSessionAuthorized(
        false
      );

      setPlayer(
        null
      );

      setConnectedAddress(
        null
      );

      setWalletMessage(
        ""
      );

      if (
        isConnected
      ) {
        await disconnectMutation
          .mutateAsync();
      }
    } catch (
      error
    ) {
      console.error(
        error
      );

      setWalletMessage(
        "Could not reset the wallet connection. Reload the page and try again."
      );
    }
  }

  async function revokeSession() {
    if (
      !connectedAddress
    ) {
      return;
    }

    try {
      if (
        activePermission
          ?.id
      ) {
        await revokePermissions
          .mutateAsync({
            id:
              activePermission.id,
          } as never);
      }

      localStorage.removeItem(
        sessionStorageKey(
          connectedAddress
        )
      );

      setSessionPrivateKey(
        null
      );

      setSessionPublicKey(
        null
      );

      setSessionAuthorized(
        false
      );

      await permissionsQuery
        .refetch();
    } catch (
      error
    ) {
      console.error(
        error
      );

      setWalletMessage(
        "Could not revoke the current Instant Play session."
      );
    }
  }

  type SessionReceiptLog = {
    address:
      Address;

    data:
      `0x${string}`;

    topics:
      readonly `0x${string}`[];
  };

  type SessionStatusReceipt = {
    transactionHash:
      `0x${string}`;

    status?:
      string;

    logs?:
      SessionReceiptLog[];
  };

  type SessionSendResult = {
    hash:
      `0x${string}` |
      null;

    logs:
      SessionReceiptLog[];

    bundleId:
      string;
  };

  function successfulSessionReceipt(
    receipts:
      SessionStatusReceipt[] |
      undefined
  ):
    SessionStatusReceipt | null {
    const successful =
      (receipts ?? []).filter(
        (receipt) =>
          receipt.status !==
          "0x0"
      );

    if (
      successful.length ===
      0
    ) {
      return null;
    }

    /*
      RISE Wallet can report bundle status 500 (partial revert) even
      when the Delveworn call itself succeeded. Prefer the successful
      receipt that actually emitted a log from our game contract.
    */
    const dungeonReceipt =
      successful.find(
        (receipt) =>
          (receipt.logs ?? []).some(
            (log) =>
              log.address.toLowerCase() ===
              DUNGEON_ADDRESS.toLowerCase()
          )
      );

    return (
      dungeonReceipt ??
      successful[
        successful.length - 1
      ] ??
      null
    );
  }

  async function monitorSessionBundle(
    provider: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<any>;
    },
    bundleId: string
  ) {
    const deadline =
      runtimeNowMs() +
      SESSION_STATUS_TIMEOUT_MS;

    while (runtimeNowMs() < deadline) {
      try {
        const status =
          await provider.request({
            method: "wallet_getCallsStatus",
            params: [bundleId],
          }) as {
            status: number;
            receipts?: SessionStatusReceipt[];
          };

        if (status.status === 200) {
          sessionBundleFailureRef.current.delete(
            bundleId
          );
          return;
        }

        if (status.status === 500) {
          const receipt =
            successfulSessionReceipt(status.receipts);

          if (receipt?.transactionHash) {
            console.debug(
              "RISE Wallet bundle reported partial status after gameplay completion.",
              status
            );
          } else {
            console.warn(
              "RISE Wallet bundle partially reverted without a successful gameplay receipt.",
              status
            );

            sessionBundleFailureRef.current.set(
              bundleId,
              "RISE Wallet partially reverted the gameplay bundle before a successful dungeon transaction was confirmed."
            );
          }
          return;
        }

        if (
          status.status === 300 ||
          status.status === 400
        ) {
          console.error(
            "RISE Wallet background bundle failure:",
            status
          );

          sessionBundleFailureRef.current.set(
            bundleId,
            `RISE Wallet rejected the gameplay bundle with status ${status.status}.`
          );
          return;
        }
      } catch (error) {
        console.debug(
          "RISE Wallet background status check delayed:",
          error
        );
      }

      await sleep(250);
    }
  }

  function errorText(
    error: unknown
  ) {
    if (
      error instanceof
      Error
    ) {
      return (
        `${error.name}: ${error.message}`
      );
    }

    try {
      return JSON.stringify(
        error
      );
    } catch {
      return String(
        error
      );
    }
  }

  async function sendDungeonSessionCall(
    functionName:
      SessionAction,

    waitForStatus =
      true,

    args:
      readonly unknown[] = []
  ):
    Promise<
      SessionSendResult
    > {
    if (
      !connectedAddress ||
      !connector ||
      !sessionPrivateKey ||
      !sessionPublicKey ||
      !hasSession
    ) {
      throw new Error(
        "Instant Play session is not active."
      );
    }

    timingLog(
      "connector.getProvider start"
    );

    const provider =
      (
        await connector
          .getProvider()
      ) as {
        request:
          (
            args: {
              method:
                string;

              params?:
                unknown[];
            }
          ) =>
            Promise<any>;
      };

    timingLog(
      "connector.getProvider done"
    );

    const data =
      encodeFunctionData({
        abi:
          dungeonAbi,

        functionName,

        args,
      } as any);

    let lastError:
      unknown = null;

    for (
      let attempt = 0;
      attempt < 12;
      attempt++
    ) {
      try {
        timingLog(
          `wallet_prepareCalls start (attempt ${attempt + 1})`
        );

        const prepared =
          await provider.request({
            method:
              "wallet_prepareCalls",

            params: [
              {
                calls: [
                  {
                    to:
                      DUNGEON_ADDRESS,

                    data,
                  },
                ],

                chainId:
                  toHex(
                    chainId
                  ),

                from:
                  connectedAddress,

                atomicRequired:
                  true,

                key: {
                  publicKey:
                    sessionPublicKey,

                  type:
                    "p256",
                },
              },
            ],
          });

        timingLog(
          "wallet_prepareCalls done"
        );

        const {
          digest,
          capabilities,
          ...request
        } =
          prepared as {
            digest:
              `0x${string}`;

            capabilities?:
              unknown;

            [key:
              string]:
              unknown;
          };

        timingLog(
          "P256 sign start"
        );

        const signature =
          Signature.toHex(
            P256.sign({
              payload:
                digest,

              privateKey:
                sessionPrivateKey,
            })
          );

        timingLog(
          "P256 sign done"
        );

        timingLog(
          "wallet_sendPreparedCalls start"
        );

        const result =
          await provider.request({
            method:
              "wallet_sendPreparedCalls",

            params: [
              {
                ...request,

                ...(
                  capabilities
                    ? {
                        capabilities,
                      }
                    : {}
                ),

                signature,
              },
            ],
          });

        timingLog(
          "wallet_sendPreparedCalls done"
        );

        const bundleId =
          Array.isArray(
            result
          )
            ? result[0]
                ?.id
            : result?.id;

        if (!bundleId) {
          throw new Error(
            "RISE Wallet returned no call bundle id."
          );
        }

        if (!waitForStatus) {
          timingLog(
            `bundle accepted (${bundleId})`
          );

          /*
            Fast gameplay path: the signed session-key bundle has been
            accepted. Do not block the animation on wallet status polling.
            The lean RandomnessFulfilled event confirms gameplay success;
            wallet status continues in the background for diagnostics.
          */
          sessionBundleFailureRef.current.delete(
            bundleId
          );

          void monitorSessionBundle(
            provider,
            bundleId
          );

          return {
            hash: null,
            logs: [],
            bundleId,
          };
        }

        const deadline =
          runtimeNowMs() +
          SESSION_STATUS_TIMEOUT_MS;

        while (
          runtimeNowMs() <
          deadline
        ) {
          const status =
            await provider.request({
              method:
                "wallet_getCallsStatus",

              params: [
                bundleId,
              ],
            }) as {
              status:
                number;

              receipts?:
                SessionStatusReceipt[];
            };

          if (
            status.status ===
            200
          ) {
            const receipt =
              successfulSessionReceipt(
                status.receipts
              );

            if (
              !receipt
                ?.transactionHash
            ) {
              throw new Error(
                "RISE Wallet confirmed the call but returned no successful transaction receipt."
              );
            }

            return {
              hash:
                receipt.transactionHash,

              logs:
                receipt.logs ??
                [],

              bundleId,
            };
          }

          if (
            status.status ===
            500
          ) {
            /*
              500 means the bundle partially reverted, not that every
              transaction failed. The RISE Wallet smart-account flow can
              still contain a successful Delveworn receipt. If that
              receipt exists, continue with the normal VRF/state flow
              instead of showing a false transaction-failed alert.
            */
            const receipt =
              successfulSessionReceipt(
                status.receipts
              );

            console.warn(
              "RISE Wallet returned partial bundle status 500.",
              status
            );

            if (
              receipt
                ?.transactionHash
            ) {
              return {
                hash:
                  receipt.transactionHash,

                logs:
                  receipt.logs ??
                  [],

                bundleId,
              };
            }

            throw new Error(
              "RISE Wallet partially reverted the bundle and returned no successful receipt."
            );
          }

          if (
            status.status ===
              300 ||
            status.status ===
              400
          ) {
            console.error(
              "RISE Wallet terminal bundle failure:",
              status
            );

            throw new Error(
              `RISE Wallet call failed with status ${status.status}.`
            );
          }

          await sleep(
            SESSION_STATUS_POLL_MS
          );
        }

        throw new Error(
          "RISE Wallet call status timed out."
        );
      } catch (
        error
      ) {
        lastError =
          error;

        const message =
          errorText(
            error
          );

        /*
          If the previous VRF callback has visually completed a few
          milliseconds before the wallet's simulation view catches up,
          retry locally. No popup is involved, so this is invisible to
          the player.
        */
        if (
          /randomness pending/i.test(
            message
          ) &&
          attempt <
            11
        ) {
          await sleep(
            75
          );

          continue;
        }

        throw error;
      }
    }

    throw (
      lastError ??
      new Error(
        "Session call failed."
      )
    );
  }

  async function sendDungeonStandardCall(
    functionName:
      SessionAction,

    args:
      readonly unknown[] = []
  ): Promise<
    SessionSendResult
  > {
    if (
      !connectedAddress ||
      !connector
    ) {
      throw new Error(
        "Standard wallet is not connected."
      );
    }

    const provider =
      asInjectedProvider(
        await connector
          .getProvider()
      );

    const walletClient =
      await createConnectedWalletClient(
        connectedAddress,
        provider
      );

    const data =
      encodeFunctionData({
        abi:
          dungeonAbi,

        functionName,

        args,
      } as never);

    const hash =
      await walletClient
        .sendTransaction({
          account:
            connectedAddress,
          chain:
            riseTestnet,
          to:
            DUNGEON_ADDRESS,
          data,
        });

    const receipt =
      await waitForReceipt(
        hash
      );

    if (
      receipt.status !==
        "success"
    ) {
      throw new Error(
        "Wallet transaction reverted."
      );
    }

    return {
      hash,
      logs:
        receipt.logs as unknown as
          SessionReceiptLog[],
      bundleId:
        "",
    };
  }

  async function sendDungeonActionCall(
    functionName:
      SessionAction,

    waitForStatus =
      true,

    args:
      readonly unknown[] = []
  ): Promise<
    SessionSendResult
  > {
    if (
      isRiseWallet
    ) {
      if (
        !hasSession
      ) {
        throw new Error(
          "Instant Play session is not active."
        );
      }

      return sendDungeonSessionCall(
        functionName,
        waitForStatus,
        args
      );
    }

    if (
      isMetaMask
    ) {
      return sendDungeonStandardCall(
        functionName,
        args
      );
    }

    throw new Error(
      "Connect RISE Wallet or MetaMask before continuing."
    );
  }

  async function retryVrf() {
    if (
      !connectedAddress ||
      !canPlay ||
      canonicalSyncing ||
      vrfRetrying
    ) {
      return;
    }

    let originalRequestId =
      BigInt(0);

    try {
      setVrfRetrying(
        true
      );

      setWalletMessage(
        ""
      );

      const available =
        await publicClient.readContract({
          address:
            DUNGEON_ADDRESS,

          abi:
            dungeonAbi,

          functionName:
            "randomnessRetryAvailable",

          args: [
            connectedAddress,
          ],
        });

      if (!available) {
        setVrfRetryAvailable(
          false
        );

        return;
      }

      const beforeRetry =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      originalRequestId =
        beforeRetry.pendingRequestId;

      if (
        beforeRetry.pendingRequestId ===
        BigInt(0)
      ) {
        setPlayer(
          beforeRetry
        );

        setVrfRetryAvailable(
          false
        );

        setVrfDelayed(
          false
        );

        setRollingKind(
          RequestKind.None
        );

        setActionReady(
          true
        );

        return;
      }

      console.info(
        `[RISE VRF] retrying request ${beforeRetry.pendingRequestId.toString()}`
      );

      await sendDungeonActionCall(
        "retryRandomness"
      );

      const afterRetry =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      setPlayer(
        afterRetry
      );

      setVrfRetryAvailable(
        false
      );

      if (
        afterRetry.pendingRequestId ===
        BigInt(0)
      ) {
        setVrfDelayed(
          false
        );

        setRollingKind(
          RequestKind.None
        );

        setActionReady(
          true
        );

        setCanonicalSyncing(
          false
        );

        setWalletMessage(
          ""
        );

        return;
      }

      setActionReady(
        false
      );

      setRollingKind(
        afterRetry.pendingRequestKind
      );

      setVrfDelayed(
        true
      );

      setWalletMessage(
        ""
      );

      console.info(
        `[RISE VRF] request ${beforeRetry.pendingRequestId.toString()} replaced by ${afterRetry.pendingRequestId.toString()}`
      );
    } catch (
      error
    ) {
      console.error(
        "VRF retry failed:",
        error
      );

      /*
        The session bundle may have landed even if wallet status polling
        failed. Re-read canonical state before presenting a failure so we
        never encourage a duplicate retry of a request that was already
        replaced or fulfilled.
      */
      try {
        const recovered =
          await fetchPlayerState(
            connectedAddress,
            "canonical"
          );

        setPlayer(
          recovered
        );

        if (
          recovered.pendingRequestId ===
          BigInt(0)
        ) {
          setVrfRetryAvailable(
            false
          );

          setVrfDelayed(
            false
          );

          setRollingKind(
            RequestKind.None
          );

          setActionReady(
            true
          );

          setCanonicalSyncing(
            false
          );

          setWalletMessage(
            ""
          );

          return;
        }

        if (
          originalRequestId !==
            BigInt(0) &&
          recovered.pendingRequestId !==
            originalRequestId
        ) {
          setVrfRetryAvailable(
            false
          );

          setActionReady(
            false
          );

          setRollingKind(
            recovered.pendingRequestKind
          );

          setVrfDelayed(
            true
          );

          setWalletMessage(
            ""
          );

          console.info(
            `[RISE VRF] retry landed despite wallet status error: ${originalRequestId.toString()} -> ${recovered.pendingRequestId.toString()}`
          );

          return;
        }

        const stillAvailable =
          await publicClient.readContract({
            address:
              DUNGEON_ADDRESS,

            abi:
              dungeonAbi,

            functionName:
              "randomnessRetryAvailable",

            args: [
              connectedAddress,
            ],
          });

        setVrfRetryAvailable(
          Boolean(
            stillAvailable
          )
        );
      } catch (
        recoveryError
      ) {
        console.debug(
          "VRF retry recovery read not ready:",
          recoveryError
        );
      }

      setWalletMessage(
        "The VRF retry could not be confirmed. The original action remains locked safely; try RETRY VRF again only if the button reappears."
      );
    } finally {
      setVrfRetrying(
        false
      );
    }
  }

  function extractRandomnessRequestIdFromLogs(
    logs:
      SessionReceiptLog[],

    playerAddress:
      Address,

    expectedKind:
      number
  ):
    bigint | null {
    for (
      const log
      of logs
    ) {
      if (
        log.address.toLowerCase() !==
        DUNGEON_ADDRESS.toLowerCase()
      ) {
        continue;
      }

      try {
        const decoded =
          decodeEventLog({
            abi:
              dungeonAbi,

            data:
              log.data,

            topics:
              log.topics as unknown as [
                `0x${string}`,
                ...`0x${string}`[],
              ],
          });

        if (
          decoded.eventName !==
          "RandomnessRequested"
        ) {
          continue;
        }

        const args =
          decoded.args as {
            player:
              Address;

            requestId:
              bigint;

            kind:
              number;
          };

        if (
          args.player.toLowerCase() ===
            playerAddress.toLowerCase() &&
          Number(
            args.kind
          ) ===
            expectedKind
        ) {
          return args.requestId;
        }
      } catch {
        // Ignore unrelated logs.
      }
    }

    return null;
  }

  /*
    ==========================================================
    RELIC TRANSACTION
    ==========================================================
  */

  async function runRelicTransaction(
    relicId: number,
    equip = true
  ) {
    if (
      !player ||
      !connectedAddress ||
      !player.relicOfferAvailable
    ) {
      return;
    }

    if (
      !actionReady ||
      canonicalSyncing ||
      player.pendingRequestId >
        BigInt(0)
    ) {
      return;
    }

    try {
      setPendingAction(
        player.supportsRelicCollection
          ? "claimRelic"
          : "chooseRelic"
      );

      if (
        !canPlay
      ) {
        setWalletMessage(
          "Connect RISE Wallet or MetaMask before continuing."
        );

        return;
      }

      const definition =
        getRelicDefinition(
          relicId
        );

      await sendDungeonActionCall(
        player.supportsRelicCollection
          ? "claimRelic"
          : "chooseRelic",
        true,
        player.supportsRelicCollection
          ? [equip]
          : [relicId]
      );

      const after =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      setPlayer(
        after
      );

      setActionReady(
        true
      );

      setCanonicalSyncing(
        false
      );

      addMessages([
        `✨ RELIC ACQUIRED: ${definition.name}${equip ? " and equipped" : ""}.`,
        `${definition.effect} ${definition.tradeoff}`.trim(),
      ]);
    } catch (
      error
    ) {
      console.error(
        "Relic selection failed:",
        error
      );

      alert(
        "Relic selection failed. Refresh the latest game state and try again."
      );
    } finally {
      setPendingAction(
        null
      );
    }
  }

  async function runEquipRelicTransaction(
    relicId: number
  ) {
    if (
      !player ||
      !connectedAddress ||
      !player.supportsRelicCollection ||
      !player.active ||
      player.monsterHp > 0 ||
      player.relicOfferAvailable ||
      player.equippedRelic === relicId
    ) {
      return;
    }

    try {
      setPendingAction(
        "equipOwnedRelic"
      );

      await sendDungeonActionCall(
        "equipOwnedRelic",
        true,
        [relicId]
      );

      const after =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      setPlayer(
        after
      );
      setActionReady(
        true
      );
      setCanonicalSyncing(
        false
      );

      const definition =
        getRelicDefinition(
          relicId
        );
      addMessages([
        relicId === 0
          ? "◆ Relic unequipped. The collection remains on payroll."
          : `◆ ${definition.name} is now the active relic.`,
      ]);
    } catch (
      error
    ) {
      console.error(
        "Relic equip failed:",
        error
      );
      alert(
        "Relic equip failed. Refresh the latest game state and try again."
      );
    } finally {
      setPendingAction(
        null
      );
    }
  }

  /*
    ==========================================================
    SUPPLY TRANSACTION
    ==========================================================
  */

  async function runSupplyTransaction(
    functionName:
      SupplyAction
  ) {
    if (
      !player ||
      !connectedAddress
    ) {
      return;
    }

    try {
      setPendingAction(
        functionName
      );

      if (
        !canPlay
      ) {
        setWalletMessage(
          "Connect RISE Wallet or MetaMask before continuing."
        );

        return;
      }

      const before =
        player;

      const prices =
        getSupplyPrices(
          before.roomsCleared
        );

      await sendDungeonActionCall(
        functionName
      );

      const after =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      setPlayer(
        after
      );

      const messages:
        string[] = [];

      if (
        functionName ===
        "supplyBuyBandage"
      ) {
        const healed =
          Math.max(
            0,

            after.hp -
              before.hp
          );

        messages.push(
          `❤️ Kevin patches you up for ${healed} HP.`
        );

        messages.push(
          `🪙 ${prices.bandage} gold changes hands. Kevin refuses to provide a receipt.`
        );
      }

      if (
        functionName ===
        "supplyBuyPotion"
      ) {
        messages.push(
          `🧪 Kevin sells you a suspicious potion. Inventory ${after.potions}/${MAX_POTIONS}.`
        );

        messages.push(
          `🪙 ${prices.potion} gold spent.`
        );

        messages.push(
          `📦 Kevin has ${Math.max(
            0,

            SUPPLY_POTION_STOCK -
              after
                .supplyPotionPurchases
          )}/${SUPPLY_POTION_STOCK} potions left.`
        );
      }

      addMessages(
        messages
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "Supply purchase failed. Check your gold, inventory and stock."
      );
    } finally {
      setPendingAction(
        null
      );
    }
  }

  /*
    ==========================================================
    CAMP TRANSACTION
    ==========================================================
  */

  async function runCampTransaction(
    functionName:
      CampAction
  ) {
    if (
      !player ||
      !connectedAddress
    ) {
      return;
    }

    try {
      setPendingAction(
        functionName
      );

      if (
        !canPlay
      ) {
        setWalletMessage(
          "Connect RISE Wallet or MetaMask before continuing."
        );

        return;
      }

      const before =
        player;

      const bossRoom =
        before.roomsCleared +
        1;

      const prices =
        getCampPrices(
          bossRoom
        );

      await sendDungeonActionCall(
        functionName
      );

      const after =
        await fetchPlayerState(
          connectedAddress,
          "canonical"
        );

      setPlayer(
        after
      );

      const messages:
        string[] = [];

      if (
        functionName ===
        "campRest"
      ) {
        const healed =
          Math.max(
            0,

            after.hp -
              before.hp
          );

        messages.push(
          `❤️ Kevin provides accommodations of questionable hygiene. +${healed} HP.`
        );

        messages.push(
          `🪙 ${prices.rest} gold spent.`
        );
      }

      if (
        functionName ===
        "campBuyPotion"
      ) {
        messages.push(
          `🧪 Potion purchased from Kevin. Inventory ${after.potions}/${MAX_POTIONS}.`
        );

        messages.push(
          `🪙 ${prices.potion} gold spent.`
        );
      }

      if (
        functionName ===
        "campBuyWeapon"
      ) {
        messages.push(
          `⚔️ Weapon upgraded to Level ${after.weaponLevel}.`
        );

        messages.push(
          `⚔️ Weapon now provides +${after.weaponLevel * 2} DAMAGE.`
        );

        messages.push(
          `🪙 ${prices.weapon} gold spent. Kevin insists it was a bargain.`
        );
      }

      if (
        functionName ===
        "campBuyArmor"
      ) {
        messages.push(
          `🛡️ Armor upgraded to Level ${after.armorLevel}.`
        );

        messages.push(
          `🛡️ Armor absorbs up to ${after.armorLevel} DAMAGE per hit, with a maximum ${MAX_ARMOR_REDUCTION_PERCENT}% reduction.`
        );

        messages.push(
          `🪙 ${prices.armor} gold spent.`
        );
      }

      addMessages(
        messages
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "Camp purchase failed. Check your gold, inventory and stock."
      );
    } finally {
      setPendingAction(
        null
      );
    }
  }

  /*
    ==========================================================
    GAME TRANSACTION
    ==========================================================
  */

  async function runGameTransaction(
    functionName:
      GameAction
  ) {
    if (
      !player ||
      !connectedAddress
    ) {
      return;
    }

    if (
      !actionReady ||
      player.pendingRequestId >
        BigInt(0)
    ) {
      setWalletMessage(
        "Previous action is still finalizing on RISE. Please wait until the action buttons unlock."
      );

      return;
    }

    actionTimingRef.current = {
      name: functionName,
      startedAt: runtimeNowMs(),
    };

    timingLog(
      "button handler start"
    );

    let transactionSubmitted =
      false;

    try {
      setPendingAction(
        functionName
      );

      if (
        !canPlay
      ) {
        setWalletMessage(
          "Connect RISE Wallet or MetaMask before continuing."
        );

        return;
      }

      setLootFlash(
        false
      );

      const before =
        player;

      let expectedRequestKind =
        RequestKind.None;

      if (
        functionName ===
          "startGame" ||
        functionName ===
          "enterNextRoom"
      ) {
        expectedRequestKind =
          RequestKind.Monster;
      }

      if (
        functionName ===
        "attack"
      ) {
        expectedRequestKind =
          RequestKind.Attack;
      }

      if (
        functionName ===
        "stormAttack"
      ) {
        expectedRequestKind =
          RequestKind.Storm;
      }

      if (
        functionName ===
          "usePotion" &&
        before.monsterHp >
          0
      ) {
        expectedRequestKind =
          RequestKind.Potion;
      }

      let vrfDisplayStartedAt =
        0;

      const roomNumber =
        before.roomsCleared +
        1;

      const beforeMonster =
        getMonsterPersona(
          before.monsterType,
          roomNumber
        );

      if (
        expectedRequestKind !==
        RequestKind.None
      ) {
        setActionReady(
          false
        );

        vrfDisplayStartedAt =
          runtimeNowMs();

        setVrfDelayed(
          false
        );

        setVrfRetryAvailable(
          false
        );

        setRollingKind(
          expectedRequestKind
        );
      }

      const sessionResult =
        await sendDungeonActionCall(
          functionName,
          expectedRequestKind ===
            RequestKind.None
        );

      timingLog(
        "sendDungeonSessionCall returned"
      );

      transactionSubmitted =
        true;

      let resolved:
        PlayerState | null =
          null;

      if (
        expectedRequestKind !==
        RequestKind.None
      ) {
        const requestId =
          extractRandomnessRequestIdFromLogs(
            sessionResult.logs,
            connectedAddress,
            expectedRequestKind
          );

        if (
          requestId ===
          null
        ) {
          /*
            Expected on the session fast path: receipt polling is not on
            the critical path, so completion is matched by player + kind
            + action start time instead of by receipt-derived request ID.
          */
          timingLog(
            "waitForFastVRF start (event match mode)"
          );

          resolved =
            await waitForFastVRF(
              BigInt(0),
              connectedAddress,
              vrfDisplayStartedAt,
              expectedRequestKind,
              vrfDisplayStartedAt,
              before,
              sessionResult.bundleId
            );
        } else {
          resolved =
            await waitForFastVRF(
              requestId,
              connectedAddress,
              vrfDisplayStartedAt,
              expectedRequestKind,
              vrfDisplayStartedAt,
              before,
              sessionResult.bundleId
            );
        }

        setVrfDelayed(
          false
        );

        setVrfRetryAvailable(
          false
        );

        setRollingKind(
          RequestKind.None
        );

        if (
          !resolved
        ) {
          return;
        }
      } else {
        resolved =
          await fetchPlayerState(
            connectedAddress,
            "canonical"
          );

        setPlayer(
          resolved
        );

        setActionReady(
          true
        );

        setCanonicalSyncing(
          false
        );
      }

      const messages:
        string[] = [];

      if (
        functionName ===
        "startGame"
      ) {
        const monster =
          getMonsterPersona(
            resolved
              .monsterType,
            1
          );

        messages.push(
          "🏰 A new journey begins."
        );

        messages.push(
          `🧪 Starting supplies: ${STARTING_POTIONS} potions.`
        );

        messages.push(
          "🎲 Fast VRF selected your first encounter."
        );

        messages.push(
          `👁️ ${monster.name}: ${randomChoice(
            monster.encounters
          )}`
        );

        setCombatLog(
          [
            ...messages,
          ].reverse()
        );

        return;
      }

      if (
        functionName ===
        "enterNextRoom"
      ) {
        const nextRoom =
          resolved
            .roomsCleared +
          1;

        const monster =
          getMonsterPersona(
            resolved
              .monsterType,
            nextRoom
          );

        messages.push(
          `🚪 You enter Room ${nextRoom}.`
        );

        if (
          resolved
            .monsterType ===
          3
        ) {
          messages.push(
            `👑 ${monster.name} · ${monster.rank ?? "Management"}`
          );

          messages.push(
            getBossDialogue(
              nextRoom
            )
          );
        } else {
          messages.push(
            "🎲 VRF selects the encounter."
          );

          messages.push(
            `👁️ ${monster.name}: ${randomChoice(
              monster.encounters
            )}`
          );
        }

        addMessages(
          messages
        );

        return;
      }

      if (
        functionName ===
        "attack"
      ) {
        const defeated =
          before.monsterHp >
            0 &&
          resolved.monsterHp ===
            0 &&
          resolved.roomsCleared ===
            before.roomsCleared +
              1;

        if (
          resolved.lastCritical
        ) {
          messages.push(
            `💥 ${randomChoice(
              criticalLines
            )} ${resolved.lastPlayerDamage} DAMAGE.`
          );
        } else {
          messages.push(
            `⚔️ You hit ${beforeMonster.name} for ${resolved.lastPlayerDamage} DAMAGE.`
          );
        }

        if (
          defeated
        ) {
          messages.push(
            `☠️ ${randomChoice(
              beforeMonster.killLines
            )}`
          );

          const reward =
            scaledGoldReward(
              before.monsterType,
              roomNumber
            );

          messages.push(
            `🪙 Base reward: ${reward} gold.`
          );

          const lootMessage =
            getLootMessage(
              resolved
            );

          if (
            lootMessage
          ) {
            messages.push(
              lootMessage
            );

            flashLoot();
          }

          if (
            before.monsterType ===
            3
          ) {
            messages.push(
              "👑 MANAGEMENT DEFEATED."
            );
          }

          if (
            resolved.supplyOpen
          ) {
            messages.push(
              "🧰 QUARTERMASTER KEVIN HAS APPEARED."
            );
          }

          if (
            resolved.campOpen
          ) {
            messages.push(
              "⛺ BOSS CAMP UNLOCKED."
            );

            messages.push(
              `👑 Management awaits in Room ${resolved.roomsCleared + 1}.`
            );
          }
        } else {
          if (
            resolved
              .lastMonsterDamage >
            0
          ) {
            messages.push(
              `💔 ${beforeMonster.name} hits you for ${resolved.lastMonsterDamage} DAMAGE. ${randomChoice(
                beforeMonster.hitLines
              )}`
            );
          }
        }

        if (
          !resolved.active
        ) {
          messages.push(
            randomChoice(
              normalDeathLines
            )
          );
        }

        addMessages(
          messages
        );

        return;
      }

      if (
        functionName ===
        "stormAttack"
      ) {
        const defeated =
          before.monsterHp >
            0 &&
          resolved.monsterHp ===
            0 &&
          resolved.roomsCleared ===
            before.roomsCleared +
              1;

        const stormMax =
          before.attackMin +
          before.attackMax;

        if (
          defeated
        ) {
          messages.push(
            `⚡ Storm Attack deals ${resolved.lastPlayerDamage} DAMAGE and finishes ${beforeMonster.name}.`
          );

          messages.push(
            `☠️ ${randomChoice(
              beforeMonster.killLines
            )}`
          );

          const reward =
            scaledGoldReward(
              before.monsterType,
              roomNumber
            );

          messages.push(
            `🪙 Base reward: ${reward} gold.`
          );

          const lootMessage =
            getLootMessage(
              resolved
            );

          if (
            lootMessage
          ) {
            messages.push(
              lootMessage
            );

            flashLoot();
          }

          if (
            before.monsterType ===
            3
          ) {
            messages.push(
              "👑 MANAGEMENT DEFEATED."
            );
          }

          if (
            resolved.supplyOpen
          ) {
            messages.push(
              "🧰 QUARTERMASTER KEVIN HAS APPEARED."
            );
          }

          if (
            resolved.campOpen
          ) {
            messages.push(
              "⛺ BOSS CAMP UNLOCKED."
            );
          }
        } else {
          messages.push(
            getStormMessage(
              resolved
                .lastPlayerDamage,
              stormMax
            )
          );

          if (
            resolved
              .lastMonsterDamage >
            0
          ) {
            messages.push(
              `💔 ${beforeMonster.name} retaliates for ${resolved.lastMonsterDamage} DAMAGE. ${randomChoice(
                beforeMonster.hitLines
              )}`
            );
          }
        }

        if (
          !resolved.active
        ) {
          messages.push(
            randomChoice(
              stormDeathLines
            )
          );
        }

        addMessages(
          messages
        );

        return;
      }

      if (
        functionName ===
        "usePotion"
      ) {
        const netHealing =
          resolved.hp -
          before.hp;

        if (
          before.monsterHp >
          0
        ) {
          messages.push(
            `🧪 Potion used. Net HP change: ${formatSigned(
              netHealing
            )}.`
          );

          messages.push(
            `💔 ${beforeMonster.name} retaliates for ${resolved.lastMonsterDamage} DAMAGE.`
          );

          const limit =
            before.monsterType ===
              3
              ? BOSS_COMBAT_POTION_LIMIT
              : NORMAL_COMBAT_POTION_LIMIT;

          messages.push(
            `🧪 Combat potion use: ${resolved.combatPotionUses}/${limit}.`
          );
        } else {
          messages.push(
            `🧪 Potion used between rooms. ${formatSigned(
              netHealing
            )} HP.`
          );
        }

        if (
          !resolved.active
        ) {
          messages.push(
            randomChoice(
              normalDeathLines
            )
          );
        }

        addMessages(
          messages
        );
      }
    } catch (
      error
    ) {
      if (
        transactionSubmitted
      ) {
        console.warn(
          "Submitted transaction; frontend recovery path:",
          error
        );

        setWalletMessage(
          "The action was submitted, but confirmation was interrupted. Refreshing the latest safe game state."
        );

        try {
          const fallback =
            await fetchPlayerState(
              connectedAddress,
              "canonical"
            );

          setPlayer(
            fallback
          );

          if (
            fallback.pendingRequestId ===
            BigInt(0)
          ) {
            setActionReady(
              true
            );

            setCanonicalSyncing(
              false
            );
          }
        } catch (
          fallbackError
        ) {
          console.warn(
            "Canonical recovery read not ready:",
            fallbackError
          );
        }
      } else {
        setActionReady(
          true
        );

        setCanonicalSyncing(
          false
        );

        console.error(
          error
        );

        alert(
          "Transaction failed. Check your wallet, RISE Testnet balance and browser console."
        );
      }
    } finally {
      setRollingKind(
        RequestKind.None
      );

      setPendingAction(
        null
      );
    }
  }

  /*
    ==========================================================
    MOUNT
    ==========================================================
  */

  useEffect(() => {
    if (
      !isConnected ||
      !wagmiAddress
    ) {
      setConnectedAddress(
        null
      );

      setPlayer(
        null
      );

      setLoading(
        false
      );

      return;
    }

    const supportedConnector =
      connector &&
      (
        connector.id ===
          RISE_WALLET_CONNECTOR_ID ||
        connector.id ===
          METAMASK_CONNECTOR_ID ||
        connector.name ===
          METAMASK_CONNECTOR_NAME
      );

    if (
      !supportedConnector
    ) {
      setConnectedAddress(
        null
      );

      setPlayer(
        null
      );

      setLoading(
        false
      );

      setWalletMessage(
        "Unsupported wallet connection. Connect RISE Wallet or MetaMask."
      );

      return;
    }

    const address =
      getAddress(
        wagmiAddress
      );

    setConnectedAddress(
      address
    );

    if (
      connector.id ===
        RISE_WALLET_CONNECTOR_ID
    ) {
      loadStoredSession(
        address
      );

      void permissionsQuery
        .refetch();
    } else {
      setSessionPrivateKey(
        null
      );

      setSessionPublicKey(
        null
      );

      setSessionAuthorized(
        false
      );
    }

    setLoading(
      true
    );

    void loadPlayer(
      address
    );
  }, [
    isConnected,
    wagmiAddress,
    connector,
  ]);

  useEffect(() => {
    if (
      !player?.supportsRelicCollection ||
      !player.relicOfferAvailable
    ) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          bossRewardRef.current?.focus({
            preventScroll: true,
          });
          bossRewardRef.current?.scrollIntoView({
            behavior: "auto",
            block: "start",
          });
        }
      );

    return () =>
      window.cancelAnimationFrame(
        frame
      );
  }, [
    player?.relicOfferAvailable,
    player?.relicOfferId,
    player?.supportsRelicCollection,
  ]);

  /*
    ==========================================================
    LOADING
    ==========================================================
  */

  if (
    loading
  ) {
    return (
      <main className="delveworn-onchain-mode min-h-screen bg-[#090909] text-white flex items-center justify-center">
        Connecting to RISE Testnet...
      </main>
    );
  }

  if (
    !connectedAddress ||
    !player
  ) {
    return (
      <main className="practice-shell delveworn-onchain-mode min-h-screen bg-[#090909] px-4 py-6 text-white lg:px-8 lg:py-8">
        <div className="practice-column mx-auto w-full max-w-md lg:max-w-6xl">
          <GameHeader
            mode="onchain"
            eyebrow="LIVE ON RISE TESTNET"
            subtitle="Enter the dungeon"
            meta={`VERIFIABLE VRF · WALLET-SIGNED ACTIONS · CHAIN ID ${riseTestnet.id}`}
          />
          <section className="practice-main-card relative mb-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <DungeonEntry
              mode="onchain"
              eyebrow={walletChoiceOpen ? "CHOOSE YOUR ENTRY" : "FULLY ONCHAIN EXPEDITION"}
              description={walletChoiceOpen
                ? "Choose Instant Play with RISE Wallet, or Standard Play with MetaMask."
                : "Enter the live testnet game. Actions, randomness, progress and rewards are verifiable onchain."}
              proofFooter={
                <a href={DUNGEON_EXPLORER_URL} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2 transition hover:text-white">
                  VIEW CONTRACT · {DUNGEON_ADDRESS.slice(0, 6)}…{DUNGEON_ADDRESS.slice(-4)} ↗
                </a>
              }
            >
              {walletChoiceOpen ? (
                <div className="mt-6 w-full">
                  <button
                    type="button"
                    onClick={() => connectWallet("rise")}
                    className="delveworn-primary-cta w-full rounded-xl py-4 text-lg font-black transition"
                  >
                    ⚡ RISE WALLET · INSTANT PLAY
                  </button>
                  <button
                    type="button"
                    onClick={() => connectWallet("metamask")}
                    className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 py-4 text-lg font-black text-white transition hover:bg-zinc-700"
                  >
                    🦊 METAMASK · STANDARD PLAY
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletChoiceOpen(false)}
                    className="mt-4 text-[10px] text-zinc-500 underline transition hover:text-zinc-300"
                  >
                    back to entrance
                  </button>
                  <p className="mt-3 text-[10px] text-zinc-600">MetaMask confirms each action. RISE Wallet enables popup-free play after one session approval.</p>
                </div>
              ) : (
                <>
                  <div className="mt-6 grid w-full grid-cols-2 gap-3">
                    <SmallStat label="STARTING POTIONS" value={`🧪 ${STARTING_POTIONS}`} />
                    <SmallStat label="MERCHANT" value="🧰 Every 5 rooms" />
                    <SmallStat label="BOSS" value="👑 Every 10 rooms" />
                    <SmallStat label="PROGRESS" value="⛓️ Fully onchain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setWalletChoiceOpen(true)}
                    className="delveworn-primary-cta mt-7 w-full rounded-xl py-4 text-lg font-black transition"
                  >
                    ⚔️ CONNECT WALLET TO ENTER
                  </button>
                  <p className="mt-4 text-[10px] text-zinc-600">Wallet connection happens after you enter.</p>
                </>
              )}
              {walletMessage && <p className="mt-4 text-sm text-red-400">{walletMessage}</p>}
            </DungeonEntry>
          </section>
        </div>
      </main>
    );
  }

  if (
    isRiseWallet &&
    !hasSession
  ) {
    return (
      <main className="delveworn-onchain-mode min-h-screen bg-[#090909] text-white px-4 py-10">

        <div className="w-full max-w-md mx-auto text-center">

          <p className="text-xs tracking-[0.35em] text-orange-400 mb-2">
            LIVE ON RISE TESTNET
          </p>

          <h1 className="text-4xl font-black tracking-tight">
            DELVEWORN
          </h1>

          <p className="text-zinc-400 mt-2">
            Enable popup-free gameplay
          </p>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 mt-8">

            <div className="text-6xl">
              🔑
            </div>

            <h2 className="text-2xl font-black mt-4">
              Instant Play
            </h2>

            <p className="text-sm text-zinc-400 mt-3">
              Approve one temporary session key. After that, Attack, Storm, Potions, shops, room changes and VRF recovery are signed locally without wallet popups.
            </p>

            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 mt-5 text-left">

              <p className="text-xs text-zinc-500">
                PERMISSIONS
              </p>

              <p className="text-sm mt-2">
                ✓ Delveworn contract only
              </p>

              <p className="text-sm mt-2">
                ✓ Gameplay + VRF recovery only
              </p>

              <p className="text-sm mt-2">
                ✓ No token transfers
              </p>

              <p className="text-sm mt-2">
                ✓ Expires after 8 hours
              </p>

            </div>

            <button
              onClick={
                createSession
              }

              disabled={
                grantPermissions.isPending
              }

              className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-black font-black text-lg py-4 rounded-xl transition mt-6"
            >
              {grantPermissions.isPending
                ? "CREATING SESSION..."
                : "🔑 ENABLE INSTANT PLAY"}
            </button>

            {walletMessage && (
              <>
                <p className="text-sm text-red-400 mt-4">
                  {walletMessage}
                </p>

                <button
                  onClick={
                    resetWalletConnection
                  }
                  className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold py-3 rounded-xl transition"
                >
                  RESET WALLET CONNECTION
                </button>
              </>
            )}

            <p className="text-[10px] text-zinc-600 mt-5">
              RISE Testnet · {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
            </p>

          </div>

        </div>

      </main>
    );
  }

  /*
    ==========================================================
    DERIVED STATE
    ==========================================================
  */

  const offeredRelics =
    getOfferedRelics(
      player.relicOfferRarity
    );

  const awardedRelic =
    getRelicDefinition(
      player.relicOfferId
    );

  const awardedRelicCount =
    player.relicCounts[
      player.relicOfferId
    ] ??
    0;

  const totalRelicDrops =
    player.relicCounts.reduce(
      (total, count) =>
        total +
        count,
      0
    );

  const equippedRelic =
    getRelicDefinition(
      player.equippedRelic
    );

  const relicEquipPreview =
    describeRelicEquipImpact({
      currentMaxHp:
        player.maxHp,
      baseMaxHp:
        player.baseMaxHp,
      relicId:
        awardedRelic.id,
    });

  const attackRelicSummary =
    combatRelicSummary(
      player.equippedRelic,
      player.criticalChance,
      false
    );

  const stormRelicSummary =
    combatRelicSummary(
      player.equippedRelic,
      player.criticalChance,
      true
    );

  const relicOfferRarityLabel =
    RELIC_RARITY_LABELS[
      player.relicOfferRarity
    ] ?? "Unknown";

  const currentRoom =
    player.roomsCleared +
    1;

  const monster =
    getMonsterPersona(
      player.monsterType,
      currentRoom
    );

  const currentLoot =
    lootTypes[
      player.lastLootType
    ] ??
    lootTypes[0];

  const stormMax =
    player.stormMax;

  const isBoss =
    player.monsterType ===
      3 &&
    player.monsterHp >
      0;

  const isBossRoom =
    currentRoom %
      10 ===
    0;

  const currentReward =
    scaledGoldReward(
      player.monsterType,
      currentRoom
    );

  const monsterHpPercent =
    player.monsterMaxHp >
    0
      ? Math.max(
          0,

          Math.min(
            100,

            (
              player.monsterHp /
              player.monsterMaxHp
            ) *
              100
          )
        )
      : 0;

  const requestKind =
    rollingKind !==
    RequestKind.None
      ? rollingKind
      : player
          .pendingRequestKind;

  const randomnessPending =
    canonicalSyncing ||
    requestKind !==
      RequestKind.None ||
    player
      .pendingRequestId >
      BigInt(0);

  const busy =
    pendingAction !==
      null ||
    randomnessPending ||
    !actionReady;

  const roomCleared =
    player.hasStarted &&
    player.active &&
    player.monsterHp ===
      0 &&
    !randomnessPending;

  const inCombat =
    player.hasStarted &&
    player.active &&
    player.monsterHp >
      0;

  /*
    POTIONS
  */

  const potionInventoryFull =
    player.potions >=
    MAX_POTIONS;

  const combatPotionLimit =
    isBoss
      ? BOSS_COMBAT_POTION_LIMIT
      : NORMAL_COMBAT_POTION_LIMIT;

  const combatPotionLimitReached =
    inCombat &&
    player.combatPotionUses >=
      combatPotionLimit;

  const potionEstimate =
    getCombatPotionEstimate(
      player.hp,
      player.maxHp,
      player.monsterDamageMin,
      player.monsterDamageMax
    );

  /*
    SUPPLY
  */

  const supplyPrices =
    getSupplyPrices(
      player.roomsCleared
    );

  const supplyPotionsRemaining =
    Math.max(
      0,

      SUPPLY_POTION_STOCK -
        player
          .supplyPotionPurchases
    );

  /*
    CAMP
  */

  const bossRoom =
    player.campOpen
      ? player.roomsCleared +
        1
      : Math.ceil(
          currentRoom /
            10
        ) *
        10;

  const campPrices =
    getCampPrices(
      bossRoom
    );

  const campPotionsRemaining =
    Math.max(
      0,

      CAMP_POTION_STOCK -
        player
          .campPotionPurchases
    );

  /*
    EQUIPMENT
  */

  const weaponBonus =
    player.weaponLevel *
    2;

  const armorAbsorption =
    player.armorLevel;

  /*
    ==========================================================
    PAGE SUBTITLE
    ==========================================================
  */

  let subtitle =
    "Enter the dungeon";

  if (
    player.hasStarted &&
    !player.active
  ) {
    subtitle =
      "Your run has ended";

  } else if (
    player.campOpen
  ) {
    subtitle =
      `Camp before Room ${currentRoom}`;

  } else if (
    player.supplyOpen
  ) {
    subtitle =
      `Supply Stop · Room ${player.roomsCleared}`;

  } else if (
    roomCleared
  ) {
    subtitle =
      `Room ${player.roomsCleared} cleared`;

  } else if (
    isBoss
  ) {
    subtitle =
      `Room ${currentRoom} · BOSS`;

  } else if (
    player.hasStarted
  ) {
    subtitle =
      `Room ${currentRoom}`;
  }

  /*
    ==========================================================
    VRF OVERLAY COPY
    ==========================================================
  */

  let rollingIcon =
    "🎲";

  let rollingLabel =
    "FAST VRF";

  let rollingTitle =
    "ROLLING RANDOMNESS";

  let rollingText =
    "The dungeon is making questionable decisions...";

  if (
    requestKind ===
    RequestKind.Monster
  ) {
    rollingIcon =
      isBossRoom
        ? "👑"
        : "🚪";

    rollingTitle =
      isBossRoom
        ? "MANAGEMENT INCOMING"
        : "ROLLING ENCOUNTER";

    rollingText =
      isBossRoom
        ? "Your case has been escalated..."
        : "Selecting your next problem...";
  }

  if (
    requestKind ===
    RequestKind.Attack
  ) {
    rollingIcon =
      "⚔️";

    rollingTitle =
      "ROLLING ATTACK";

    rollingText =
      "Resolving DAMAGE, critical chance and retaliation...";
  }

  if (
    requestKind ===
    RequestKind.Storm
  ) {
    rollingIcon =
      "⚡";

    rollingTitle =
      "UNLEASHING STORM";

    rollingText =
      "This may have been an excellent or terrible idea...";
  }

  if (
    requestKind ===
    RequestKind.Potion
  ) {
    rollingIcon =
      "🧪";

    rollingTitle =
      "DRINKING SUSPICIOUS LIQUID";

    rollingText =
      "Healing is easy. Retaliation is less convenient.";
  }

  if (
    canonicalSyncing
  ) {
    rollingIcon =
      "⛓️";

    rollingTitle =
      "FINALIZING ACTION";

    rollingText =
      "Randomness is resolved. Waiting until RISE is ready for your next transaction...";
  }

  if (
    vrfDelayed &&
    !canonicalSyncing
  ) {
    rollingIcon =
      "⏳";

    rollingLabel =
      "RISE TESTNET";

    rollingTitle =
      "WAITING FOR RISE VRF";

    rollingText =
      vrfRetryAvailable
        ? "RISE has not fulfilled this request within the onchain timeout. You can safely replace it with a fresh VRF request."
        : "Your action is submitted. RISE has not fulfilled the randomness request yet. The result will appear automatically.";
  }

  /*
    ==========================================================
    RENDER
    ==========================================================
  */

  return (
    <main className={`practice-shell delveworn-onchain-mode min-h-screen bg-[#090909] px-4 py-6 text-white lg:px-8 lg:py-8${player.hasStarted ? " practice-in-run" : ""}${player.supportsRelicCollection && player.relicOfferAvailable ? " onchain-boss-focus" : ""}`}>

      <div className="practice-column mx-auto w-full max-w-md lg:max-w-6xl">

        {/* HEADER */}

        <GameHeader
          mode="onchain"
          eyebrow="LIVE ON RISE TESTNET"
          subtitle={subtitle}
          meta={<>ONCHAIN SESSION · {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}</>}
        >
          {isRiseWallet ? (
            <div className="flex items-center justify-center gap-2 mt-2">

              <span className="text-[10px] text-emerald-400">
                🔑 INSTANT PLAY ACTIVE
              </span>

              <button
                onClick={
                  revokeSession
                }

                className="text-[9px] text-zinc-600 hover:text-zinc-400 underline"
              >
                revoke
              </button>

            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2">

              <span className="text-[10px] text-orange-300">
                🦊 METAMASK · STANDARD PLAY
              </span>

              <button
                onClick={
                  resetWalletConnection
                }

                className="text-[9px] text-zinc-600 hover:text-zinc-400 underline"
              >
                disconnect
              </button>

            </div>
          )}
        </GameHeader>

        {/* ===================================================
            COMPACT STICKY HUD
        =================================================== */}

        {player.hasStarted &&
          player.active && (
          <GameHud
            hp={player.hp}
            maxHp={player.maxHp}
            potions={player.potions}
            maxPotions={MAX_POTIONS}
            gold={player.gold}
            weaponLevel={player.weaponLevel}
            weaponBonus={weaponBonus}
            armorLevel={player.armorLevel}
            armorAbsorption={armorAbsorption}
            armorReductionPercent={MAX_ARMOR_REDUCTION_PERCENT}
            room={player.relicOfferAvailable ? player.roomsCleared : currentRoom}
            combatPotions={inCombat ? { used: player.combatPotionUses, limit: combatPotionLimit } : undefined}
          />
        )}

        {/* ===================================================
            MAIN CARD
        =================================================== */}

        <section
          className={
            `practice-main-card relative mb-4 overflow-hidden rounded-2xl border ` +
            (
              isBoss
                ? "bg-gradient-to-b from-purple-950/50 to-zinc-950 border-purple-700"

                : player.campOpen
                  ? "bg-gradient-to-b from-amber-950/30 to-zinc-950 border-amber-800"

                  : player.supplyOpen
                    ? "bg-gradient-to-b from-cyan-950/30 to-zinc-950 border-cyan-900"

                    : "bg-zinc-900 border-zinc-800"
            )
          }
        >

          {/* -------------------------------------------------
              START
          ------------------------------------------------- */}

          {!player.hasStarted ? (
            <DungeonEntry
              mode="onchain"
              eyebrow="FULLY ONCHAIN EXPEDITION"
              description="Your wallet is connected. Start a verifiable run backed by the live Delveworn testnet contract."
              proofFooter={
                <a href={DUNGEON_EXPLORER_URL} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2 transition hover:text-white">
                  VIEW CONTRACT · {DUNGEON_ADDRESS.slice(0, 6)}…{DUNGEON_ADDRESS.slice(-4)} ↗
                </a>
              }
            >
              <div className="mt-6 grid w-full grid-cols-2 gap-3">
                <SmallStat label="STARTING POTIONS" value={`🧪 ${STARTING_POTIONS}`} />
                <SmallStat label="CRITICAL CHANCE" value={`💥 ${player.criticalChance}%`} />
                <SmallStat label="MERCHANT" value="🧰 Every 5 rooms" />
                <SmallStat label="BOSS + RELIC" value="👑 Every 10 rooms" />
              </div>
              <button
                type="button"
                onClick={() => runGameTransaction("startGame")}
                disabled={busy}
                className="delveworn-primary-cta mt-7 w-full rounded-xl py-4 text-lg font-black transition disabled:opacity-50"
              >
                ⚔️ START ONCHAIN RUN
              </button>
              <p className="mt-4 text-[10px] text-zinc-600">Gameplay actions use your selected wallet mode.</p>
            </DungeonEntry>

          ) : !player.active ? (
            /*
              -------------------------------------------------
              DEAD
              -------------------------------------------------
            */

            <div className="min-h-[430px] p-7 flex flex-col items-center justify-center text-center">

              <div className="text-7xl">
                ☠️
              </div>

              <h2 className="text-3xl font-black mt-4">
                YOU DIED
              </h2>

              <p className="text-zinc-400 mt-2">
                The dungeon has updated your performance review.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full mt-7">

                <SmallStat
                  label="ROOMS CLEARED"
                  value={`${player.roomsCleared}`}
                />

                <SmallStat
                  label="GOLD"
                  value={<GoldAmount amount={player.gold} />}
                />

                <SmallStat
                  label="WEAPON"
                  value={`⚔️ Lv ${player.weaponLevel}`}
                />

                <SmallStat
                  label="ARMOR"
                  value={`🛡️ Lv ${player.armorLevel}`}
                />

              </div>

              <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 mt-3 w-full">

                <p className="text-[10px] text-zinc-500">
                  POTIONS REMAINING
                </p>

                <p className="font-bold mt-1">
                  🧪 {player.potions}/{MAX_POTIONS}
                </p>

              </div>

            </div>

          ) : player.campOpen ? (
            /*
              -------------------------------------------------
              BOSS CAMP + QUARTERMASTER KEVIN
              -------------------------------------------------
            */

            <div className="practice-merchant-card min-h-[560px] lg:grid lg:min-h-[480px] lg:grid-cols-[3fr_2fr]">

              <div className="practice-merchant-stage relative h-[300px] overflow-hidden bg-gradient-to-b from-amber-950/10 to-black lg:h-full lg:min-h-[480px] lg:border-r lg:border-zinc-800">

                <img
                  src={
                    MERCHANT_IMAGE
                  }

                  alt={
                    MERCHANT_NAME
                  }

                  className="w-full h-full object-contain drop-shadow-2xl"
                />

                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent" />

              </div>

              <div className="practice-merchant-info p-6 pt-1 text-center lg:flex lg:flex-col lg:justify-center lg:p-8">

                <p className="practice-merchant-kicker text-xs tracking-[0.25em] text-amber-400">
                  ⛺ BOSS CAMP
                </p>

                <h2 className="practice-merchant-title mt-2 text-3xl font-black">
                  {MERCHANT_NAME}
                </h2>

                <p className="practice-merchant-role mt-1 text-xs text-zinc-500">
                  Traveling Merchant · Questionable Procurement
                </p>

                <p className="practice-merchant-flavor mt-3 italic text-zinc-300">
                  “Management upstairs is furious. Can I interest you in armor?”
                </p>

                <div className="bg-emerald-950/30 border border-emerald-900 rounded-xl p-3 mt-5">

                  <p className="text-emerald-400 font-bold">
                    ❤️ Arrival Recovery
                  </p>

                  <p className="text-xs text-zinc-500 mt-1">
                    Up to +{CAMP_ARRIVAL_HEAL} HP automatically
                  </p>

                </div>

                <div className="bg-purple-950/30 border border-purple-900 rounded-xl p-4 mt-4">

                  <p className="text-xs tracking-[0.2em] text-purple-400">
                    NEXT MANAGEMENT LEVEL
                  </p>

                  <p className="font-black text-lg mt-2">
                    👑{" "}
                    {getMonsterPersona(
                      3,
                      currentRoom
                    ).name}
                  </p>

                  <p className="text-xs text-purple-300 mt-1">
                    {getMonsterPersona(
                      3,
                      currentRoom
                    ).rank}
                  </p>

                  <p className="text-sm text-zinc-500 mt-2">
                    Room {currentRoom}
                  </p>

                </div>

              </div>

            </div>

          ) : player.supplyOpen ? (
            /*
              -------------------------------------------------
              SUPPLY + QUARTERMASTER KEVIN
              -------------------------------------------------
            */

            <div className="practice-merchant-card min-h-[540px] lg:grid lg:min-h-[480px] lg:grid-cols-[3fr_2fr]">

              <div className="practice-merchant-stage relative h-[300px] overflow-hidden bg-gradient-to-b from-amber-950/10 to-black lg:h-full lg:min-h-[480px] lg:border-r lg:border-zinc-800">

                <img
                  src={
                    MERCHANT_IMAGE
                  }

                  alt={
                    MERCHANT_NAME
                  }

                  className="w-full h-full object-contain drop-shadow-2xl"
                />

                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent" />

              </div>

              <div className="practice-merchant-info p-6 pt-1 text-center lg:flex lg:flex-col lg:justify-center lg:p-8">

                <p className="practice-merchant-kicker text-xs tracking-[0.25em] text-cyan-400">
                  🧰 SUPPLY STOP
                </p>

                <h2 className="practice-merchant-title mt-2 text-3xl font-black">
                  {MERCHANT_NAME}
                </h2>

                <p className="practice-merchant-role mt-1 text-xs text-zinc-500">
                  Traveling Merchant
                </p>

                <p className="practice-merchant-flavor mt-3 italic text-zinc-300">
                  “You look terrible. Fortunately, I accept gold.”
                </p>

                <div className="practice-merchant-stats mt-6 grid grid-cols-2 gap-3">

                  <SmallStat
                    label="HEALTH"
                    value={`❤️ ${player.hp}/${player.maxHp}`}
                  />

                  <SmallStat
                    label="GOLD"
                    value={<GoldAmount amount={player.gold} />}
                  />

                  <SmallStat
                    label="POTIONS"
                    value={`🧪 ${player.potions}/${MAX_POTIONS}`}
                  />

                  <SmallStat
                    label="POTION STOCK"
                    value={`📦 ${supplyPotionsRemaining}/${SUPPLY_POTION_STOCK}`}
                  />

                </div>

              </div>

            </div>

          ) : roomCleared ? (
            /*
              -------------------------------------------------
              ROOM CLEARED
              -------------------------------------------------
            */

            <div className="min-h-[390px] p-7 flex flex-col items-center justify-center text-center">

              <div className="text-7xl">
                {player.roomsCleared %
                  10 ===
                0
                  ? "👑"
                  : "🏆"}
              </div>

              <p className="text-xs tracking-[0.25em] text-orange-400 mt-4">
                ROOM {player.roomsCleared}
              </p>

              <h2 className="text-3xl font-black mt-2">
                {player.roomsCleared %
                  10 ===
                0
                  ? "MANAGEMENT DEFEATED"
                  : "ROOM CLEARED"}
              </h2>

              <p className="text-zinc-400 mt-3">
                Against all available evidence, you remain alive.
              </p>

              <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 mt-6 w-full">

                <p className="text-[10px] text-zinc-500">
                  NEXT
                </p>

                <p className="font-bold mt-1">
                  🎲 Room {currentRoom}
                </p>

              </div>

            </div>

          ) : (
            /*
              -------------------------------------------------
              MONSTER COMBAT
              -------------------------------------------------
            */

            <div>
              <RoomProgressLine room={currentRoom} isBoss={isBoss} />
              <div className="practice-combat-card min-h-[610px] lg:grid lg:min-h-[480px] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

              <div className="practice-monster-stage relative h-[355px] w-full min-w-0 overflow-hidden bg-gradient-to-b from-black/20 to-black/70 lg:h-full lg:min-h-[480px] lg:border-r lg:border-zinc-800">

                <img
                  src={
                    monster.image
                  }

                  alt={
                    monster.name
                  }

                  className={
                    isBoss
                      ? "w-full h-full object-contain scale-105 drop-shadow-2xl"

                      : "w-full h-full object-contain drop-shadow-2xl"
                  }
                />

                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-zinc-950 to-transparent" />

              </div>

              <div className="practice-monster-info min-w-0 p-5 pt-1 lg:flex lg:flex-col lg:justify-center lg:p-8">

                {isBoss && (
                  <p className="text-xs tracking-[0.3em] text-purple-400 font-bold">
                    👑 BOSS ENCOUNTER
                  </p>
                )}

                <div className="practice-monster-heading mt-2 flex items-start justify-between gap-4">

                  <div>

                    <h2
                      className={
                        isBoss
                          ? "text-3xl font-black text-purple-200"
                          : "text-3xl font-black"
                      }
                    >
                      {monster.name}
                    </h2>

                    <p
                      className={
                        isBoss
                          ? "text-xs font-bold text-purple-400 mt-1 uppercase tracking-wider"
                          : "text-xs text-zinc-500 mt-1"
                      }
                    >
                      {isBoss
                        ? monster.rank
                        : monster.species}
                    </p>

                  </div>

                  <span className="text-[10px] bg-black/50 border border-zinc-700 text-zinc-400 px-2 py-1 rounded-full">
                    {monster.chance}
                  </span>

                </div>

                <p className="practice-monster-flavor mt-3 text-sm italic text-zinc-400">
                  “{monster.flavor}”
                </p>

                {isBoss && (
                  <div className="bg-purple-950/30 border border-purple-900/60 rounded-xl p-3 mt-4">

                    <p className="text-[10px] text-purple-500 tracking-[0.2em] mb-1">
                      MANAGEMENT SAYS
                    </p>

                    <p className="text-sm text-purple-200 italic">
                      {getBossDialogue(
                        currentRoom
                      )}
                    </p>

                  </div>
                )}

                <div className="practice-enemy-hp-label mb-2 mt-5 flex justify-between">

                  <span className="text-xs text-zinc-500">
                    ENEMY HP
                  </span>

                  <span className="font-black">
                    {player.monsterHp}
                    {" / "}
                    {player.monsterMaxHp}
                  </span>

                </div>

                <div className="practice-enemy-bar h-3 w-full overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className={
                      isBoss
                        ? "bg-purple-500 h-3 rounded-full transition-all duration-150"

                        : "bg-red-500 h-3 rounded-full transition-all duration-150"
                    }

                    style={{
                      width:
                        `${monsterHpPercent}%`,
                    }}
                  />

                </div>

                <div className="practice-enemy-stats mt-4 grid grid-cols-2 gap-3">

                  <SmallStat
                    label="ENEMY DAMAGE"
                    value={`💥 ${player.monsterDamageMin}–${player.monsterDamageMax}`}
                  />

                  <SmallStat
                    label="BASE REWARD"
                    value={<GoldAmount amount={currentReward} />}
                  />

                </div>

              </div>
              </div>

            </div>
          )}

          {/* =================================================
              VRF OVERLAY
          ================================================= */}

          {randomnessPending && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">

              <div className="text-center max-w-xs">

                <div className="text-7xl animate-pulse">
                  {rollingIcon}
                </div>

                <p className="text-[10px] tracking-[0.35em] text-violet-400 mt-5">
                  {rollingLabel}
                </p>

                <h2 className="text-2xl font-black mt-2">
                  {rollingTitle}
                </h2>

                <p className="text-sm text-zinc-400 mt-3">
                  {rollingText}
                </p>

                <div className="flex justify-center gap-2 mt-5">

                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />

                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />

                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />

                </div>

                {vrfRetryAvailable &&
                  !canonicalSyncing && (
                    <>
                      <button
                        onClick={
                          retryVrf
                        }

                        disabled={
                          vrfRetrying
                        }

                        className="w-full mt-6 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-black font-black py-3 rounded-xl transition"
                      >
                        {vrfRetrying
                          ? "RETRYING VRF..."
                          : "↻ RETRY VRF"}
                      </button>

                      <p className="text-[10px] text-zinc-500 mt-2">
                        The previous request has timed out onchain. Retrying invalidates that request and safely creates a fresh one.
                      </p>
                    </>
                  )}

              </div>

            </div>
          )}

        </section>

        {player.equippedRelic !== 0 && (
          <div className={`onchain-equipped-relic rounded-xl border px-4 py-3 ${equippedRelic.borderClass} ${equippedRelic.backgroundClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <RelicArtwork imageSrc={equippedRelic.imageSrc} name={equippedRelic.name} className="h-14 w-14" />
                <div>
                  <p className={`text-[10px] tracking-[0.24em] font-black ${equippedRelic.accentClass}`}>
                    {equippedRelic.rarity.toUpperCase()} RELIC
                  </p>
                  <p className="font-black mt-1">
                    {equippedRelic.name}
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <p>Max HP {player.maxHp}</p>
                <p>Crit {player.criticalChance}%</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                <p className="text-[9px] font-black tracking-[0.18em] text-emerald-400">EFFECT</p>
                <p className="mt-1 text-xs text-zinc-200">{equippedRelic.effect}</p>
              </div>
              <div className="rounded-lg border border-red-900/70 bg-red-950/30 p-3">
                <p className="text-[9px] font-black tracking-[0.18em] text-red-400">COST / TRADEOFF</p>
                <p className="mt-1 text-xs font-bold text-red-200">{equippedRelic.tradeoff}</p>
              </div>
            </div>
          </div>
        )}

        {player.supportsRelicCollection &&
          player.ownedRelics.length > 0 &&
          player.monsterHp === 0 &&
          !player.relicOfferAvailable && (
            <section className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.25em] text-orange-400">
                    RELIC COLLECTION · {player.ownedRelics.length}/15 UNIQUE · {totalRelicDrops} {totalRelicDrops === 1 ? "DROP" : "DROPS"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">CHOOSE ACTIVE RELIC</h2>
                </div>
                <p className="max-w-48 text-right text-[10px] text-zinc-500">
                  Switch or unequip between rooms. Duplicate effects do not stack.
                </p>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {[0, ...player.ownedRelics].map((relicId) => {
                  const ownedRelic = getRelicDefinition(relicId);
                  const activeRelic = relicId === player.equippedRelic;
                  return (
                    <button
                      key={relicId}
                      onClick={() => runEquipRelicTransaction(relicId)}
                      disabled={busy || activeRelic}
                      aria-pressed={activeRelic}
                      className={`rounded-xl border p-3 text-left transition hover:brightness-125 disabled:cursor-not-allowed ${ownedRelic.borderClass} ${ownedRelic.backgroundClass}${activeRelic ? " ring-2 ring-orange-400" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <RelicArtwork imageSrc={ownedRelic.imageSrc} name={ownedRelic.name} className="h-12 w-12" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className={`font-black ${ownedRelic.accentClass}`}>
                              {ownedRelic.name}
                              {relicId !== 0 && (
                                <span className="ml-1 text-xs text-zinc-400">×{player.relicCounts[relicId] ?? 1}</span>
                              )}
                            </p>
                            <span className={activeRelic ? "text-[9px] font-black text-orange-400" : "text-[9px] font-bold text-zinc-500"}>
                              {activeRelic ? "ACTIVE" : relicId === 0 ? "UNEQUIP" : "EQUIP"}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-400">{ownedRelic.effect}</p>
                          {relicId !== 0 && (
                            <p className="mt-2 text-[10px] font-bold text-red-300">Tradeoff: {ownedRelic.tradeoff}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-zinc-600">
                Revive use and Blood Price max-HP costs remain spent for the full run after switching.
              </p>
            </section>
          )}

        {/* ===================================================
            ACTIONS
        =================================================== */}

        {!player.hasStarted ? (
          null

        ) : !player.active ? (
          <button
            onClick={() =>
              runGameTransaction(
                "startGame"
              )
            }

            disabled={busy}

            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-black text-xl py-4 rounded-xl transition"
          >
            🔄 NEW RUN
          </button>

        ) : player.relicOfferAvailable ? (
          /*
            ==================================================
            RELIC OFFER
            ==================================================
          */

          player.supportsRelicCollection && player.relicOfferId !== 0 ? (
            <BossRelicReward
              idPrefix="onchain"
              room={player.roomsCleared}
              hp={player.hp}
              maxHp={player.maxHp}
              gold={player.gold}
              ownedRelicCount={player.ownedRelics.length}
              totalRelicDrops={totalRelicDrops}
              awardedRelic={awardedRelic}
              awardedRelicCount={awardedRelicCount}
              currentRelic={player.equippedRelic === 0 ? null : equippedRelic}
              equipPreview={relicEquipPreview}
              busy={busy}
              onKeep={() => runRelicTransaction(awardedRelic.id, false)}
              onEquip={() => runRelicTransaction(awardedRelic.id, true)}
              containerRef={bossRewardRef}
              className="onchain-relic-offer rounded-2xl border border-purple-700"
            />
          ) : (
            <div>
              <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
                <p className="text-[10px] font-black tracking-[0.3em] text-violet-400">
                  {relicOfferRarityLabel.toUpperCase()} RELIC OFFER
                </p>
                <h2 className="mt-2 text-2xl font-black">Choose Your Relic</h2>
                <p className="mt-2 text-sm text-zinc-400">Legacy onchain relic offer.</p>
              </div>
              <div className="grid gap-3">
                {offeredRelics.map((relic) => (
                  <button
                    key={relic.id}
                    onClick={() => runRelicTransaction(relic.id)}
                    disabled={busy}
                    className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-40 ${relic.borderClass} ${relic.backgroundClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <RelicArtwork imageSrc={relic.imageSrc} name={relic.name} className="h-16 w-16" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[10px] font-black tracking-[0.22em] ${relic.accentClass}`}>{relic.rarity.toUpperCase()}</p>
                        <p className="mt-1 text-lg font-black">{relic.name}</p>
                        <p className="mt-2 text-sm text-zinc-200">{relic.effect}</p>
                        <p className="mt-1 text-xs text-zinc-500">{relic.tradeoff}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )

        ) : player.campOpen ? (
          /*
            ==================================================
            CAMP ACTIONS
            ==================================================
          */

          <div className="onchain-shop-actions lg:grid lg:grid-cols-2 lg:gap-3">

            <div className="flex justify-between items-center mb-3">

              <div>

                <p className="text-[10px] text-amber-500 tracking-wider">
                  KEVIN&apos;S BOSS CAMP SHOP
                </p>

                <p className="font-bold">
                  Prepare for Room {currentRoom}
                </p>

              </div>

              <div className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl">
                <GoldAmount amount={player.gold} />
              </div>

            </div>

            <button
              onClick={() =>
                runCampTransaction(
                  "campRest"
                )
              }

              disabled={
                busy ||
                player.campRestUsed ||
                player.hp >= player.maxHp ||
                player.gold <
                  campPrices.rest
              }

              className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900 disabled:opacity-35 text-white rounded-xl p-4 transition text-left"
            >

              <div className="flex justify-between gap-4">

                <div>

                  <p className="font-black">
                    ❤️ Rest
                  </p>

                  <p className="text-xs text-zinc-400 mt-1">
                    Recover up to +{CAMP_REST_HEAL} HP
                  </p>

                  {player.campRestUsed && (
                    <p className="text-xs text-zinc-500 mt-2">
                      ✓ Already used
                    </p>
                  )}

                </div>

                <span className="font-black text-amber-400">
                  <GoldAmount amount={campPrices.rest} />
                </span>

              </div>

            </button>

            <button
              onClick={() =>
                runCampTransaction(
                  "campBuyPotion"
                )
              }

              disabled={
                busy ||
                campPotionsRemaining ===
                  0 ||
                potionInventoryFull ||
                player.gold <
                  campPrices.potion
              }

              className="w-full mt-3 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900 disabled:opacity-35 text-white rounded-xl p-4 transition text-left"
            >

              <div className="flex justify-between gap-4">

                <div>

                  <p className="font-black">
                    🧪 Buy Potion
                  </p>

                  <p className="text-xs text-zinc-400 mt-1">
                    Inventory {player.potions}/{MAX_POTIONS}
                  </p>

                  {campPotionsRemaining ===
                  0 ? (
                    <p className="text-xs text-red-400 font-bold mt-2">
                      SOLD OUT
                    </p>

                  ) : potionInventoryFull ? (
                    <p className="text-xs text-amber-500 mt-2">
                      Inventory full
                    </p>

                  ) : (
                    <p className="text-xs text-zinc-500 mt-2">
                      📦 {campPotionsRemaining}/{CAMP_POTION_STOCK} left
                    </p>
                  )}

                </div>

                <span className="font-black text-amber-400">
                  <GoldAmount amount={campPrices.potion} />
                </span>

              </div>

            </button>

            <div className="grid grid-cols-2 gap-3 mt-3">

              <button
                onClick={() =>
                  runCampTransaction(
                    "campBuyWeapon"
                  )
                }

                disabled={
                  busy ||
                  player.gold <
                    campPrices.weapon
                }

                className="bg-orange-950/40 hover:bg-orange-900/50 border border-orange-900 disabled:opacity-35 rounded-xl p-4 transition text-left"
              >

                <p className="font-black">
                  ⚔️ Weapon
                </p>

                <p className="text-xs text-zinc-400 mt-2">
                  Lv {player.weaponLevel}
                  {" → "}
                  {player.weaponLevel + 1}
                </p>

                <p className="text-xs text-orange-300 font-bold mt-2">
                  +2 DAMAGE
                </p>

                <p className="text-amber-400 font-black mt-3">
                  <GoldAmount amount={campPrices.weapon} />
                </p>

              </button>

              <button
                onClick={() =>
                  runCampTransaction(
                    "campBuyArmor"
                  )
                }

                disabled={
                  busy ||
                  player.gold <
                    campPrices.armor
                }

                className="bg-sky-950/40 hover:bg-sky-900/50 border border-sky-900 disabled:opacity-35 rounded-xl p-4 transition text-left"
              >

                <p className="font-black">
                  🛡️ Armor
                </p>

                <p className="text-xs text-zinc-400 mt-2">
                  Lv {player.armorLevel}
                  {" → "}
                  {player.armorLevel + 1}
                </p>

                <p className="text-xs text-sky-300 font-bold mt-2">
                  +1 DAMAGE absorption
                </p>

                <p className="text-[10px] text-zinc-500 mt-1">
                  Max {MAX_ARMOR_REDUCTION_PERCENT}% reduction
                </p>

                <p className="text-amber-400 font-black mt-3">
                  <GoldAmount amount={campPrices.armor} />
                </p>

              </button>

            </div>

            {player.potions >
              0 &&
              player.hp < player.maxHp && (
                <button
                  onClick={() =>
                    runGameTransaction(
                      "usePotion"
                    )
                  }

                  disabled={busy}

                  className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold py-3 rounded-xl transition"
                >
                  🧪 USE OWN POTION +25 HP
                  {" · "}
                  {player.potions}/{MAX_POTIONS}
                </button>
              )}

            <div className="border-t border-zinc-800 mt-5 pt-5">

              <button
                onClick={() =>
                  runGameTransaction(
                    "enterNextRoom"
                  )
                }

                disabled={busy}

                className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-black text-lg py-4 rounded-xl transition"
              >
                👑 FACE MANAGEMENT
              </button>

              <p className="text-center text-xs text-zinc-600 mt-2">
                Boss combat allows {BOSS_COMBAT_POTION_LIMIT} potion uses
              </p>

            </div>

          </div>

        ) : player.supplyOpen ? (
          /*
            ==================================================
            SUPPLY ACTIONS
            ==================================================
          */

          <div className="onchain-shop-actions lg:grid lg:grid-cols-2 lg:gap-3">

            <div className="flex justify-between items-center mb-3">

              <div>

                <p className="text-[10px] text-cyan-500 tracking-wider">
                  KEVIN&apos;S SUPPLY SHOP
                </p>

                <p className="font-bold">
                  Restock before Room {currentRoom}
                </p>

              </div>

              <div className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl">
                <GoldAmount amount={player.gold} />
              </div>

            </div>

            <button
              onClick={() =>
                runSupplyTransaction(
                  "supplyBuyBandage"
                )
              }

              disabled={
                busy ||
                player.supplyBandageUsed ||
                player.hp >= player.maxHp ||
                player.gold <
                  supplyPrices.bandage
              }

              className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900 disabled:opacity-35 text-white rounded-xl p-4 transition text-left"
            >

              <div className="flex justify-between">

                <div>

                  <p className="font-black">
                    ❤️ Bandage
                  </p>

                  <p className="text-xs text-zinc-400 mt-1">
                    Recover up to +{SUPPLY_BANDAGE_HEAL} HP
                  </p>

                  {player.supplyBandageUsed && (
                    <p className="text-xs text-zinc-500 mt-2">
                      ✓ Already used
                    </p>
                  )}

                </div>

                <span className="font-black text-amber-400">
                  <GoldAmount amount={supplyPrices.bandage} />
                </span>

              </div>

            </button>

            <button
              onClick={() =>
                runSupplyTransaction(
                  "supplyBuyPotion"
                )
              }

              disabled={
                busy ||
                supplyPotionsRemaining ===
                  0 ||
                potionInventoryFull ||
                player.gold <
                  supplyPrices.potion
              }

              className="w-full mt-3 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900 disabled:opacity-35 text-white rounded-xl p-4 transition text-left"
            >

              <div className="flex justify-between">

                <div>

                  <p className="font-black">
                    🧪 Buy Potion
                  </p>

                  <p className="text-xs text-zinc-400 mt-1">
                    Inventory {player.potions}/{MAX_POTIONS}
                  </p>

                  {supplyPotionsRemaining ===
                  0 ? (
                    <p className="text-xs text-red-400 font-bold mt-2">
                      SOLD OUT
                    </p>

                  ) : potionInventoryFull ? (
                    <p className="text-xs text-amber-500 mt-2">
                      Inventory full
                    </p>

                  ) : (
                    <p className="text-xs text-cyan-500 mt-2">
                      📦 {supplyPotionsRemaining}/{SUPPLY_POTION_STOCK} left
                    </p>
                  )}

                </div>

                <span className="font-black text-amber-400">
                  <GoldAmount amount={supplyPrices.potion} />
                </span>

              </div>

            </button>

            {player.potions >
              0 &&
              player.hp < player.maxHp && (
                <button
                  onClick={() =>
                    runGameTransaction(
                      "usePotion"
                    )
                  }

                  disabled={busy}

                  className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold py-3 rounded-xl transition"
                >
                  🧪 USE OWN POTION +25 HP
                  {" · "}
                  {player.potions}/{MAX_POTIONS}
                </button>
              )}

            <div className="border-t border-zinc-800 mt-5 pt-5">

              <button
                onClick={() =>
                  runGameTransaction(
                    "enterNextRoom"
                  )
                }

                disabled={busy}

                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black text-lg py-4 rounded-xl transition"
              >
                🚪 CONTINUE TO ROOM {currentRoom}
              </button>

            </div>

          </div>

        ) : roomCleared ? (
          /*
            ==================================================
            BETWEEN ROOMS
            ==================================================
          */

          <div className="practice-action-dock practice-between-actions lg:grid lg:grid-cols-2 lg:gap-3">

            <button
              onClick={() => runGameTransaction("usePotion")}
              disabled={busy || player.potions === 0 || player.hp >= player.maxHp}
              className="mb-3 w-full rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50 to-emerald-200 p-3 text-center text-emerald-950 transition hover:from-white hover:to-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-none disabled:bg-zinc-950 disabled:text-zinc-600 disabled:opacity-70 lg:mb-0"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="font-black">🧪 HEAL +25 HP</span>
                <span className="text-xs font-bold">{player.potions}/{MAX_POTIONS}</span>
              </div>
              <p className={player.potions === 0 || player.hp >= player.maxHp ? "mt-1 text-[10px] font-bold text-red-400" : "mt-1 text-[10px] text-emerald-800"}>
                {player.potions === 0 ? "No potions available." : player.hp >= player.maxHp ? "HP is already full." : "Use one potion outside combat."}
              </p>
            </button>

            <button
              onClick={() =>
                runGameTransaction(
                  "enterNextRoom"
                )
              }

              disabled={busy}

              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-black text-lg py-4 rounded-xl transition"
            >
              🎲 NEXT ROOM
            </button>

          </div>

        ) : (
          /*
            ==================================================
            COMBAT ACTION DOCK
            ==================================================
          */

          <CombatActionDock
            busy={busy}
            stormDamage={`0–${stormMax}`}
            attackDamage={`${player.attackMin}–${player.attackMax}`}
            criticalChance={player.criticalChance}
            potionLabel={`🧪 POTION · ${player.potions}/${MAX_POTIONS}`}
            potionDetail={<>Estimated net healing: {formatNetRange(potionEstimate.min, potionEstimate.max)}</>}
            potionUsage={<>{player.combatPotionUses}/{combatPotionLimit}<span className="block text-[9px] font-normal text-zinc-400">used</span></>}
            potionDisabled={busy || player.potions === 0 || player.hp >= player.maxHp || combatPotionLimitReached}
            potionLimitReached={combatPotionLimitReached}
            relicName={equippedRelic.name}
            stormRelicSummary={stormRelicSummary}
            attackRelicSummary={attackRelicSummary}
            onStorm={() => runGameTransaction("stormAttack")}
            onPotion={() => runGameTransaction("usePotion")}
            onAttack={() => runGameTransaction("attack")}
          />
        )}

        {/* ===================================================
            LAST COMBAT
        =================================================== */}

        {player.hasStarted &&
          !randomnessPending &&
          (
            player.lastPlayerDamage >
              0 ||
            player.lastMonsterDamage >
              0
          ) && (
            <div
              className={
                player.lastCritical
                  ? "bg-orange-950/40 border border-orange-500/50 rounded-2xl p-4 mt-4"

                  : "bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-4"
              }
            >

              <p className="text-[10px] text-zinc-500 tracking-wider">
                LAST COMBAT ROLL
              </p>

              <div className="grid grid-cols-2 gap-3 mt-3">

                <div>

                  <p className="text-[10px] text-zinc-500">
                    YOUR DAMAGE
                  </p>

                  <p className="text-xl font-black mt-1">
                    {player.lastCritical
                      ? "💥"
                      : "⚔️"}
                    {" "}
                    {player.lastPlayerDamage}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] text-zinc-500">
                    DAMAGE TAKEN
                  </p>

                  <p className="text-xl font-black mt-1">
                    💔{" "}
                    {player.lastMonsterDamage}
                  </p>

                </div>

              </div>

              {player.lastCritical && (
                <p className="text-orange-400 font-black mt-3">
                  💥 CRITICAL HIT
                </p>
              )}

            </div>
          )}

        {/* ===================================================
            LAST LOOT
        =================================================== */}

        {player.hasStarted &&
          player.lastLootType !==
            0 &&
          !randomnessPending && (
            <div
              className={
                `rounded-2xl p-5 mt-4 border transition-all duration-300 ` +
                (
                  lootFlash
                    ? "bg-amber-900/40 border-amber-400 scale-[1.02]"

                    : "bg-amber-950/20 border-amber-800/40"
                )
              }
            >

              <div className="flex justify-between gap-3">

                <div>

                  <p className="text-[10px] text-amber-500 tracking-wider">
                    LAST VRF LOOT
                  </p>

                  <p className="text-xs text-zinc-600 mt-1">
                    The dungeon has made another financial decision.
                  </p>

                </div>

                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-1 rounded-full h-fit">
                  ✓ RESOLVED
                </span>

              </div>

              <div className="flex items-center gap-4 mt-4">

                <div className="text-5xl">
                  {currentLoot.icon}
                </div>

                <div>

                  <p className="font-black text-lg">
                    {currentLoot.name}
                  </p>

                  <p className="text-sm text-zinc-300 mt-1">

                    {player.lastLootType ===
                    3
                      ? `Weapon Level ${player.weaponLevel} · +${weaponBonus} DAMAGE`

                      : player.lastLootType ===
                          4
                        ? `Armor Level ${player.armorLevel} · absorbs up to ${armorAbsorption} DAMAGE · max ${MAX_ARMOR_REDUCTION_PERCENT}% reduction`

                        : player.lastLootType ===
                            1
                          ? `Potions: ${player.potions}/${MAX_POTIONS}`

                          : `Amount: +${player.lastLootAmount}`}

                  </p>

                  <p className="text-[10px] text-zinc-600 mt-1">
                    {currentLoot.chance}
                    {" drop chance"}
                  </p>

                </div>

              </div>

            </div>
          )}

        {/* ===================================================
            COMBAT LOG
        =================================================== */}

        {player.hasStarted && (
          <DungeonLog
            entries={combatLog}
            mobileOpen={mobileLogOpen}
            onToggle={() => setMobileLogOpen((open) => !open)}
          />
        )}

        {/* ===================================================
            RUN STATS
        =================================================== */}

        <div className="practice-run-summary mt-4 grid grid-cols-2 gap-3 text-center">

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">

            <p className="text-zinc-500 text-[10px]">
              ROOMS
            </p>

            <p className="text-xl font-black">
              {player.roomsCleared}
            </p>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">

            <p className="text-zinc-500 text-[10px]">
              GOLD
            </p>

            <p className="text-xl font-black">
              <GoldAmount amount={player.gold} />
            </p>

          </div>

        </div>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <footer className="practice-footer mt-6 pb-24 text-center">

          <p className="text-[10px] text-zinc-700">
            V8.6.9b · RISE Testnet · RISE Instant Play · MetaMask Standard Play
          </p>

          <p className="text-[10px] text-zinc-800 mt-1">
            Actions stay locked until VRF resolves · timed-out requests can be safely retried
          </p>

          <p className="text-[10px] text-zinc-800 mt-1">
            Armor absorbs 1 DAMAGE per level · maximum {MAX_ARMOR_REDUCTION_PERCENT}% reduction
          </p>

        </footer>

      </div>

    </main>
  );
}
