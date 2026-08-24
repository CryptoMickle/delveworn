// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";

contract RelicsV2Dungeon is Delveworn {
    constructor(address coordinatorAddress) Delveworn(coordinatorAddress) {}

    function forceOfferRarity(address playerAddress, RelicRarity rarity) external {
        relicOfferRarity[playerAddress] = rarity;
        relicOfferAvailable[playerAddress] = true;
    }

    function forceHp(address playerAddress, uint256 hp) external {
        players[playerAddress].hp = hp;
    }

    function forceMonsterHp(address playerAddress, uint256 hp) external {
        players[playerAddress].monsterHp = hp;
    }
}

contract RelicsV2Test is Test {
    RelicsV2Dungeon internal dungeon;
    MockVRFCoordinator internal mockVRF;

    address internal player = address(0xBEEF);

    function setUp() public {
        mockVRF = new MockVRFCoordinator();
        dungeon = new RelicsV2Dungeon(address(mockVRF));
    }

    function testEveryRarityReturnsThreeMatchingRelics() public view {
        for (uint8 rarityId = 1; rarityId <= 5; rarityId++) {
            Delveworn.RelicRarity rarity = Delveworn.RelicRarity(rarityId);
            (Delveworn.Relic first, Delveworn.Relic second, Delveworn.Relic third) =
                dungeon.relicChoicesForRarity(rarity);

            assertEq(uint256(dungeon.relicRarityOf(first)), rarityId);
            assertEq(uint256(dungeon.relicRarityOf(second)), rarityId);
            assertEq(uint256(dungeon.relicRarityOf(third)), rarityId);
            assertEq(uint256(second), uint256(first) + 1);
            assertEq(uint256(third), uint256(first) + 2);
        }
    }

    function testRarityRollBoundariesAreExposedForFrontendAndTesting() public view {
        assertEq(uint256(dungeon.previewRelicRarity(0)), uint256(Delveworn.RelicRarity.Common));
        assertEq(uint256(dungeon.previewRelicRarity(5_500)), uint256(Delveworn.RelicRarity.Uncommon));
        assertEq(uint256(dungeon.previewRelicRarity(8_000)), uint256(Delveworn.RelicRarity.Rare));
        assertEq(uint256(dungeon.previewRelicRarity(9_200)), uint256(Delveworn.RelicRarity.Epic));
        assertEq(uint256(dungeon.previewRelicRarity(9_800)), uint256(Delveworn.RelicRarity.Legendary));
    }

    function testWrongTierRelicCannotBeChosen() public {
        _reachRoomFiveOffer();
        assertEq(uint256(dungeon.relicOfferRarity(player)), uint256(Delveworn.RelicRarity.Common));

        vm.expectRevert("Relic not in offer");
        vm.prank(player);
        dungeon.chooseRelic(Delveworn.Relic.GlassEdge);
    }

    function testGlassEdgeTradesMaxHpForDamage() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Uncommon, Delveworn.Relic.GlassEdge);

        assertEq(dungeon.maxHp(player), 80);
        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);
        assertEq(minDamage, 9);
        assertEq(maxDamage, 14);
    }

    function testAshenFangHealsOnKill() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Uncommon, Delveworn.Relic.AshenFang);
        assertEq(dungeon.maxHp(player), 90);

        _enterRoomSix();
        dungeon.forceHp(player, 50);
        dungeon.forceMonsterHp(player, 1);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 0, 50, 0));

        assertEq(dungeon.getPlayer(player).hp, 54);
    }

    function testStormglassSpecializesStormDamage() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Uncommon, Delveworn.Relic.Stormglass);

        (uint256 attackMin, uint256 attackMax) = dungeon.playerAttackRange(player);
        (uint256 stormMin, uint256 stormMax) = dungeon.stormAttackRange(player);

        assertEq(attackMin, 8);
        assertEq(attackMax, 12);
        assertEq(stormMin, 0);
        assertEq(stormMax, 26);
    }

    function testGravePactRevivesOnceAtThirtyFivePercentHp() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Rare, Delveworn.Relic.GravePact);
        _enterRoomSix();
        dungeon.forceMonsterHp(player, 100);
        dungeon.forceHp(player, 1);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 2, 50, 0));

        assertTrue(dungeon.getPlayer(player).active);
        assertEq(dungeon.getPlayer(player).hp, 35);
        assertTrue(dungeon.relicReviveUsed(player));

        dungeon.forceHp(player, 1);
        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 2, 50, 0));

        assertFalse(dungeon.getPlayer(player).active);
        assertEq(dungeon.getPlayer(player).hp, 0);
    }

    function testTitanBoneAddsFiftyMaxHp() public {
        _reachRoomFiveOffer();
        uint256 hpBefore = dungeon.getPlayer(player).hp;
        _choose(Delveworn.RelicRarity.Epic, Delveworn.Relic.TitanBone);

        assertEq(dungeon.maxHp(player), 150);
        assertEq(dungeon.getPlayer(player).hp, hpBefore + 50);
    }

    function testBlackMirrorTriplesCriticalBeforeDamagePenalty() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Epic, Delveworn.Relic.BlackMirror);
        assertEq(dungeon.playerCriticalChance(player), 30);

        _enterRoomSix();
        dungeon.forceMonsterHp(player, 100);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 0, 0, 50, 0));

        assertTrue(dungeon.lastCritical(player));
        assertEq(dungeon.lastPlayerDamage(player), 21);
    }

    function testBloodEngineHealsFiveOnKillAndCostsMaxHp() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Epic, Delveworn.Relic.BloodEngine);
        assertEq(dungeon.maxHp(player), 80);

        _enterRoomSix();
        dungeon.forceHp(player, 50);
        dungeon.forceMonsterHp(player, 1);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 0, 50, 0));

        assertEq(dungeon.getPlayer(player).hp, 55);
    }

    function testCrownOfRuinIsHighDamageLowHpLegendary() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Legendary, Delveworn.Relic.CrownOfRuin);

        assertEq(dungeon.maxHp(player), 60);
        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);
        assertEq(minDamage, 10);
        assertEq(maxDamage, 16);
    }

    function testUndyingFlameRevivesAtHalfOfReducedMaxHp() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Legendary, Delveworn.Relic.UndyingFlame);
        assertEq(dungeon.maxHp(player), 85);

        _enterRoomSix();
        dungeon.forceMonsterHp(player, 100);
        dungeon.forceHp(player, 1);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 2, 50, 0));

        assertTrue(dungeon.getPlayer(player).active);
        assertEq(dungeon.getPlayer(player).hp, 42);
        assertTrue(dungeon.relicReviveUsed(player));
    }

    function testWorldbreakerAmplifiesOutgoingCritAndIncomingDamage() public {
        _reachRoomFiveOffer();
        _choose(Delveworn.RelicRarity.Legendary, Delveworn.Relic.Worldbreaker);
        assertEq(dungeon.playerCriticalChance(player), 25);

        _enterRoomSix();
        dungeon.forceMonsterHp(player, 100);
        dungeon.forceHp(player, 100);

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 2, 50, 0));

        assertEq(dungeon.lastPlayerDamage(player), 10);
        assertEq(dungeon.lastMonsterDamage(player), 7);
        assertEq(dungeon.getPlayer(player).hp, 93);
    }

    function _reachRoomFiveOffer() internal {
        vm.prank(player);
        dungeon.startGame();
        _fulfill(_one(0));

        while (dungeon.getPlayer(player).roomsCleared < 5) {
            while (dungeon.getPlayer(player).monsterHp > 0) {
                vm.prank(player);
                dungeon.attack();
                // Critical max roll, minimum retaliation and amountRoll=0.
                // The room-5 offer therefore naturally rolls Common.
                _fulfill(_attackWords(4, 0, 0, 50, 0));
            }

            if (dungeon.getPlayer(player).roomsCleared < 5) {
                vm.prank(player);
                dungeon.enterNextRoom();
                _fulfill(_one(0));
            }
        }

        assertTrue(dungeon.relicOfferAvailable(player));
    }

    function _choose(Delveworn.RelicRarity rarity, Delveworn.Relic relic) internal {
        dungeon.forceOfferRarity(player, rarity);
        vm.prank(player);
        dungeon.chooseRelic(relic);
        assertEq(uint256(dungeon.equippedRelic(player)), uint256(relic));
    }

    function _enterRoomSix() internal {
        vm.prank(player);
        dungeon.enterNextRoom();
        _fulfill(_one(0));
    }

    function _fulfill(uint256[] memory words) internal {
        mockVRF.fulfill(dungeon.pendingRequestId(player), words);
    }

    function _one(uint256 a) internal pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = a;
    }

    function _attackWords(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        internal
        pure
        returns (uint256[] memory words)
    {
        words = new uint256[](5);
        words[0] = a;
        words[1] = b;
        words[2] = c;
        words[3] = d;
        words[4] = e;
    }
}
