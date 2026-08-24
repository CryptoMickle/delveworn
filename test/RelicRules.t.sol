// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RelicRules} from "../src/RelicRules.sol";

contract RelicRulesHarness {
    function rarity(uint8 relic) external pure returns (uint8) {
        return RelicRules.relicRarity(relic);
    }

    function choices(uint8 rarity) external pure returns (uint8, uint8, uint8) {
        return RelicRules.choicesForRarity(rarity);
    }

    function weight(uint8 rarity) external pure returns (uint16) {
        return RelicRules.rarityWeightBps(rarity);
    }

    function roll(uint256 entropy) external pure returns (uint8) {
        return RelicRules.rollRarity(entropy);
    }

    function outgoing(uint8 relic, uint256 damage, bool storm) external pure returns (uint256) {
        return RelicRules.scaleOutgoing(relic, damage, storm);
    }

    function criticalBonus(uint8 relic) external pure returns (uint8) {
        return RelicRules.criticalChanceBonus(relic);
    }

    function criticalMultiplier(uint8 relic) external pure returns (uint8) {
        return RelicRules.criticalMultiplier(relic);
    }

    function maxHpBonus(uint8 relic) external pure returns (uint16) {
        return RelicRules.maxHpBonus(relic);
    }

    function maxHpPenalty(uint8 relic) external pure returns (uint16) {
        return RelicRules.maxHpPenalty(relic);
    }

    function killHeal(uint8 relic) external pure returns (uint8) {
        return RelicRules.killHeal(relic);
    }

    function gold(uint8 relic, uint256 amount) external pure returns (uint256) {
        return RelicRules.scaleGold(relic, amount);
    }

    function incoming(uint8 relic, uint256 amount) external pure returns (uint256) {
        return RelicRules.scaleIncoming(relic, amount);
    }

    function revivePercent(uint8 relic) external pure returns (uint8) {
        return RelicRules.revivePercent(relic);
    }
}

contract RelicRulesTest is Test {
    RelicRulesHarness internal rules;

    function setUp() public {
        rules = new RelicRulesHarness();
    }

    function testFiveRaritiesContainThreeRelicsEach() public view {
        for (uint8 rarity = 1; rarity <= 5; rarity++) {
            (uint8 first, uint8 second, uint8 third) = rules.choices(rarity);
            assertEq(rules.rarity(first), rarity);
            assertEq(rules.rarity(second), rarity);
            assertEq(rules.rarity(third), rarity);
            assertEq(second, first + 1);
            assertEq(third, first + 2);
        }
    }

    function testRarityWeightsSumToOneHundredPercent() public view {
        uint256 total;
        for (uint8 rarity = 1; rarity <= 5; rarity++) {
            total += rules.weight(rarity);
        }
        assertEq(total, 10_000);
        assertEq(rules.weight(1), 5_500);
        assertEq(rules.weight(2), 2_500);
        assertEq(rules.weight(3), 1_200);
        assertEq(rules.weight(4), 600);
        assertEq(rules.weight(5), 200);
    }

    function testRarityRollBoundaries() public view {
        assertEq(rules.roll(0), 1);
        assertEq(rules.roll(5_499), 1);
        assertEq(rules.roll(5_500), 2);
        assertEq(rules.roll(7_999), 2);
        assertEq(rules.roll(8_000), 3);
        assertEq(rules.roll(9_199), 3);
        assertEq(rules.roll(9_200), 4);
        assertEq(rules.roll(9_799), 4);
        assertEq(rules.roll(9_800), 5);
        assertEq(rules.roll(9_999), 5);
    }

    function testCommonCalibrationIsPreserved() public view {
        assertEq(rules.outgoing(1, 100, false), 110); // Blood Price
        assertEq(rules.outgoing(2, 100, false), 95); // Iron Shell
        assertEq(rules.outgoing(3, 100, false), 100); // Echo Lens normal
        assertEq(rules.outgoing(3, 100, true), 80); // Echo Lens Storm
        assertEq(rules.criticalBonus(3), 5);
    }

    function testUncommonIdentity() public view {
        assertEq(rules.outgoing(4, 100, false), 120); // Glass Edge
        assertEq(rules.maxHpPenalty(4), 20);
        assertEq(rules.maxHpPenalty(5), 10); // Ashen Fang
        assertEq(rules.killHeal(5), 4);
        assertEq(rules.outgoing(6, 100, false), 95); // Stormglass
        assertEq(rules.outgoing(6, 100, true), 130);
    }

    function testRareIdentity() public view {
        assertEq(rules.outgoing(7, 100, false), 95); // Gilded Hunger
        assertEq(rules.gold(7, 100), 175);
        assertEq(rules.outgoing(8, 100, false), 95); // Grave Pact
        assertEq(rules.revivePercent(8), 35);
        assertEq(rules.outgoing(9, 100, false), 95); // Stormheart
        assertEq(rules.outgoing(9, 100, true), 145);
    }

    function testEpicIdentity() public view {
        assertEq(rules.maxHpBonus(10), 50); // Titan Bone
        assertEq(rules.outgoing(10, 100, false), 95);
        assertEq(rules.outgoing(11, 100, false), 85); // Black Mirror
        assertEq(rules.criticalBonus(11), 15);
        assertEq(rules.criticalMultiplier(11), 3);
        assertEq(rules.outgoing(12, 100, false), 105); // Blood Engine
        assertEq(rules.maxHpPenalty(12), 20);
        assertEq(rules.killHeal(12), 5);
    }

    function testLegendaryIdentity() public view {
        assertEq(rules.outgoing(13, 100, false), 135); // Crown of Ruin
        assertEq(rules.maxHpPenalty(13), 40);
        assertEq(rules.maxHpPenalty(14), 15); // Undying Flame
        assertEq(rules.revivePercent(14), 50);
        assertEq(rules.outgoing(15, 100, false), 130); // Worldbreaker
        assertEq(rules.criticalBonus(15), 10);
        assertEq(rules.incoming(15, 100), 115);
    }
}
