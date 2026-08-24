// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Pure Relics V2 catalog and balance rules.
/// @dev Relic and rarity IDs intentionally mirror Delveworn's enums so the core
///      contract can stay compact while the catalog remains easy to extend.
library RelicRules {
    uint8 internal constant RELIC_COUNT = 15;
    uint8 internal constant RARITY_COUNT = 5;

    uint16 internal constant COMMON_WEIGHT_BPS = 5_500;
    uint16 internal constant UNCOMMON_WEIGHT_BPS = 2_500;
    uint16 internal constant RARE_WEIGHT_BPS = 1_200;
    uint16 internal constant EPIC_WEIGHT_BPS = 600;
    uint16 internal constant LEGENDARY_WEIGHT_BPS = 200;

    error InvalidRelic();
    error InvalidRarity();

    function relicRarity(uint8 relic) internal pure returns (uint8 rarity) {
        if (relic == 0 || relic > RELIC_COUNT) revert InvalidRelic();
        return ((relic - 1) / 3) + 1;
    }

    function choicesForRarity(uint8 rarity) internal pure returns (uint8 first, uint8 second, uint8 third) {
        if (rarity == 0 || rarity > RARITY_COUNT) revert InvalidRarity();
        first = ((rarity - 1) * 3) + 1;
        second = first + 1;
        third = first + 2;
    }

    function rarityWeightBps(uint8 rarity) internal pure returns (uint16) {
        if (rarity == 1) return COMMON_WEIGHT_BPS;
        if (rarity == 2) return UNCOMMON_WEIGHT_BPS;
        if (rarity == 3) return RARE_WEIGHT_BPS;
        if (rarity == 4) return EPIC_WEIGHT_BPS;
        if (rarity == 5) return LEGENDARY_WEIGHT_BPS;
        revert InvalidRarity();
    }

    function rollRarity(uint256 entropy) internal pure returns (uint8) {
        uint256 roll = entropy % 10_000;
        if (roll < 5_500) return 1;
        if (roll < 8_000) return 2;
        if (roll < 9_200) return 3;
        if (roll < 9_800) return 4;
        return 5;
    }

    /// @dev Percent of normal outgoing damage after the relic modifier.
    function outgoingDamagePercent(uint8 relic, bool storm) internal pure returns (uint16) {
        if (relic == 0) return 100;
        if (relic > RELIC_COUNT) revert InvalidRelic();

        // Common
        if (relic == 1) return 110; // Blood Price
        if (relic == 2) return 95; // Iron Shell
        if (relic == 3) return storm ? 80 : 100; // Echo Lens

        // Uncommon
        if (relic == 4) return 120; // Glass Edge
        if (relic == 5) return 100; // Ashen Fang
        if (relic == 6) return storm ? 130 : 95; // Stormglass

        // Rare
        if (relic == 7) return 90; // Gilded Hunger
        if (relic == 8) return 90; // Grave Pact
        if (relic == 9) return storm ? 145 : 90; // Stormheart

        // Epic
        if (relic == 10) return 90; // Titan Bone
        if (relic == 11) return storm ? 100 : 85; // Black Mirror
        if (relic == 12) return 110; // Blood Engine

        // Legendary
        if (relic == 13) return 135; // Crown of Ruin
        if (relic == 14) return 100; // Undying Flame
        return 125; // Worldbreaker
    }

    function criticalChanceBonus(uint8 relic) internal pure returns (uint8) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        if (relic == 3) return 5; // Echo Lens
        if (relic == 11) return 15; // Black Mirror
        if (relic == 15) return 10; // Worldbreaker
        return 0;
    }

    function criticalMultiplier(uint8 relic) internal pure returns (uint8) {
        if (relic > RELIC_COUNT) revert InvalidRelic();
        return relic == 11 ? 3 : 2; // Black Mirror
    }

    function maxHpBonus(uint8 relic) internal pure returns (uint16) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        if (relic == 2) return 20; // Iron Shell
        if (relic == 10) return 50; // Titan Bone
        return 0;
    }

    function maxHpPenalty(uint8 relic) internal pure returns (uint16) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        if (relic == 4) return 20; // Glass Edge
        if (relic == 5) return 10; // Ashen Fang
        if (relic == 12) return 15; // Blood Engine
        if (relic == 13) return 40; // Crown of Ruin -> 60 base max HP
        if (relic == 14) return 15; // Undying Flame
        return 0;
    }

    function roomMaxHpLoss(uint8 relic) internal pure returns (uint8) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        return relic == 1 ? 2 : 0; // Blood Price
    }

    function killHeal(uint8 relic) internal pure returns (uint8) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        if (relic == 5) return 4; // Ashen Fang
        if (relic == 12) return 8; // Blood Engine
        return 0;
    }

    function goldBonusPercent(uint8 relic) internal pure returns (uint8) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        return relic == 7 ? 60 : 0; // Gilded Hunger
    }

    function incomingDamagePercent(uint8 relic) internal pure returns (uint16) {
        if (relic == 0) return 100;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        return relic == 15 ? 125 : 100; // Worldbreaker
    }

    function revivePercent(uint8 relic) internal pure returns (uint8) {
        if (relic == 0) return 0;
        if (relic > RELIC_COUNT) revert InvalidRelic();
        if (relic == 8) return 25; // Grave Pact
        if (relic == 14) return 50; // Undying Flame
        return 0;
    }

    function scaleOutgoing(uint8 relic, uint256 damage, bool storm) internal pure returns (uint256) {
        uint256 percent = outgoingDamagePercent(relic, storm);
        if (percent >= 100) return (damage * percent) / 100;
        // Round penalties in the player's favor so low damage values are not
        // disproportionately punished by integer truncation.
        return (damage * percent + 99) / 100;
    }

    function scaleIncoming(uint8 relic, uint256 damage) internal pure returns (uint256) {
        uint256 percent = incomingDamagePercent(relic);
        return (damage * percent + 99) / 100;
    }

    function scaleGold(uint8 relic, uint256 gold) internal pure returns (uint256) {
        uint256 bonus = goldBonusPercent(relic);
        return (gold * (100 + bonus)) / 100;
    }
}
