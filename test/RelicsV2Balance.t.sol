// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {DevRandomnessAdapter} from "../src/adapters/DevRandomnessAdapter.sol";

/// @dev Test-only hook that pins an already-open boss drop to a specific relic.
///      Combat/loot randomness and all pre-relic state stay genuine.
contract RelicsV2BalanceDungeon is Delveworn {
    constructor(address coordinatorAddress) Delveworn(coordinatorAddress) {}

    function forceRelicOffer(address playerAddress, Relic relic) external {
        require(relicOfferAvailable[playerAddress], "Offer not open");
        relicOfferId[playerAddress] = relic;
        relicOfferRarity[playerAddress] = relicRarityOf(relic);
    }
}

/// @notice Matched fresh-state balance telemetry for every V2 relic.
/// @dev Each simulated run gets a new dungeon + adapter, resetting requestNonce
///      and requestId. Every relic uses the same player-address cohort, so all
///      pre-relic random paths are identical. Two fixed strategies are measured:
///      attack-only and deterministic 50/50 attack/storm offensive actions.
contract RelicsV2BalanceTest is Test {
    uint256 internal constant RUNS = 32;
    uint256 internal constant MAX_ROOMS = 30;
    uint256 internal constant SAFETY_ACTION_LIMIT = 600;
    uint256 internal constant ADDRESS_BASE = 0xB000;

    struct Stats {
        uint256 totalRooms;
        uint256 totalGold;
        uint256 totalMaxHp;
        uint256 reached5;
        uint256 reached10;
        uint256 reached20;
        uint256 reached30;
        uint256 attacks;
        uint256 storms;
        uint256 combatPotions;
        uint256 revives;
    }

    function testAttackOnlyBaseline() public noGasMetering {
        _runAndLog(Delveworn.Relic.None, false);
    }

    function testMixedBaseline() public noGasMetering {
        _runAndLog(Delveworn.Relic.None, true);
    }

    function testAttackOnlyCommon() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Common, false);
    }

    function testAttackOnlyUncommon() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Uncommon, false);
    }

    function testAttackOnlyRare() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Rare, false);
    }

    function testAttackOnlyEpic() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Epic, false);
    }

    function testAttackOnlyLegendary() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Legendary, false);
    }

    function testMixedCommon() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Common, true);
    }

    function testMixedUncommon() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Uncommon, true);
    }

    function testMixedRare() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Rare, true);
    }

    function testMixedEpic() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Epic, true);
    }

    function testMixedLegendary() public noGasMetering {
        _runTier(Delveworn.RelicRarity.Legendary, true);
    }

    function _runTier(Delveworn.RelicRarity rarity, bool mixed) internal {
        (uint8 first, uint8 second, uint8 third) = _choiceIds(rarity);
        _runAndLog(Delveworn.Relic(first), mixed);
        _runAndLog(Delveworn.Relic(second), mixed);
        _runAndLog(Delveworn.Relic(third), mixed);
    }

    function _choiceIds(Delveworn.RelicRarity rarity) internal pure returns (uint8 first, uint8 second, uint8 third) {
        first = ((uint8(rarity) - 1) * 3) + 1;
        second = first + 1;
        third = first + 2;
    }

    function _runAndLog(Delveworn.Relic relic, bool mixed) internal {
        Stats memory stats;

        for (uint256 i = 0; i < RUNS; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            address playerAddress = address(uint160(ADDRESS_BASE + i));
            _playRun(playerAddress, relic, mixed, stats);
        }

        console2.log("=== DELVEWORN RELICS V2 BALANCE ===");
        console2.log("strategy", mixed ? uint256(1) : uint256(0));
        console2.log("relic id", uint256(relic));
        console2.log("rarity", relic == Delveworn.Relic.None ? uint256(0) : ((uint256(relic) - 1) / 3) + 1);
        console2.log("runs", RUNS);
        console2.log("average rooms x100", (stats.totalRooms * 100) / RUNS);
        console2.log("reach 5 bps", (stats.reached5 * 10_000) / RUNS);
        console2.log("reach 10 bps", (stats.reached10 * 10_000) / RUNS);
        console2.log("reach 20 bps", (stats.reached20 * 10_000) / RUNS);
        console2.log("reach 30 bps", (stats.reached30 * 10_000) / RUNS);
        console2.log("average final gold x100", (stats.totalGold * 100) / RUNS);
        console2.log("average final max hp x100", (stats.totalMaxHp * 100) / RUNS);
        console2.log("attack actions", stats.attacks);
        console2.log("storm actions", stats.storms);
        console2.log("combat potion actions", stats.combatPotions);
        console2.log("revives", stats.revives);

        assertGt(stats.totalRooms, 0);
        assertGt(stats.reached5, 0);
        assertGt(stats.attacks + stats.storms, 0);
    }

    function _playRun(address playerAddress, Delveworn.Relic relic, bool mixed, Stats memory stats) internal {
        DevRandomnessAdapter adapter = new DevRandomnessAdapter();
        RelicsV2BalanceDungeon dungeon = new RelicsV2BalanceDungeon(address(adapter));
        adapter.setConsumer(address(dungeon));

        vm.prank(playerAddress);
        dungeon.startGame();
        _fulfill(dungeon, adapter, playerAddress);

        uint256 safetyActions;
        uint256 offensiveActionIndex;

        while (safetyActions < SAFETY_ACTION_LIMIT) {
            safetyActions++;
            Delveworn.Player memory state = dungeon.getPlayer(playerAddress);

            if (!state.active || state.roomsCleared >= MAX_ROOMS) break;

            if (state.monsterHp > 0) {
                if (_shouldUseCombatPotion(dungeon, playerAddress, state)) {
                    vm.prank(playerAddress);
                    dungeon.usePotion();
                    stats.combatPotions++;
                    _fulfill(dungeon, adapter, playerAddress);
                } else {
                    bool useStorm = mixed && (offensiveActionIndex % 2 == 0);
                    offensiveActionIndex++;

                    vm.prank(playerAddress);
                    if (useStorm) {
                        dungeon.stormAttack();
                        stats.storms++;
                    } else {
                        dungeon.attack();
                        stats.attacks++;
                    }
                    _fulfill(dungeon, adapter, playerAddress);
                }
                continue;
            }

            if (dungeon.relicOfferAvailable(playerAddress)) {
                if (relic != Delveworn.Relic.None && dungeon.equippedRelic(playerAddress) == Delveworn.Relic.None) {
                    dungeon.forceRelicOffer(playerAddress, relic);
                    vm.prank(playerAddress);
                    dungeon.chooseRelic(relic);
                } else {
                    vm.prank(playerAddress);
                    dungeon.claimRelic(false);
                }
            }

            _useSupplyStop(dungeon, playerAddress);
            _useCamp(dungeon, playerAddress);
            _useBetweenRoomPotion(dungeon, playerAddress);

            state = dungeon.getPlayer(playerAddress);
            if (!state.active || state.roomsCleared >= MAX_ROOMS) break;

            vm.prank(playerAddress);
            dungeon.enterNextRoom();
            _fulfill(dungeon, adapter, playerAddress);
        }

        assertLt(safetyActions, SAFETY_ACTION_LIMIT, "V2 balance strategy hit safety limit");

        Delveworn.Player memory finalState = dungeon.getPlayer(playerAddress);
        stats.totalRooms += finalState.roomsCleared;
        stats.totalGold += finalState.gold;
        stats.totalMaxHp += dungeon.maxHp(playerAddress);
        if (finalState.roomsCleared >= 5) stats.reached5++;
        if (finalState.roomsCleared >= 10) stats.reached10++;
        if (finalState.roomsCleared >= 20) stats.reached20++;
        if (finalState.roomsCleared >= 30) stats.reached30++;
        if (dungeon.relicReviveUsed(playerAddress)) stats.revives++;
    }

    function _shouldUseCombatPotion(
        RelicsV2BalanceDungeon dungeon,
        address playerAddress,
        Delveworn.Player memory state
    ) internal view returns (bool) {
        if (state.hp > 35 || state.potions == 0 || state.hp >= dungeon.maxHp(playerAddress)) return false;

        uint256 limit = state.monsterType == Delveworn.MonsterType.DungeonLord
            ? dungeon.BOSS_COMBAT_POTION_LIMIT()
            : dungeon.NORMAL_COMBAT_POTION_LIMIT();
        return dungeon.combatPotionsUsed(playerAddress) < limit;
    }

    function _useSupplyStop(RelicsV2BalanceDungeon dungeon, address playerAddress) internal {
        if (!dungeon.supplyAvailable(playerAddress)) return;

        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);
        (uint256 bandageCost, uint256 potionCost) = dungeon.supplyPricesForStop(state.roomsCleared);

        if (
            state.hp <= 70 && state.hp < dungeon.maxHp(playerAddress) && !dungeon.supplyBandageUsed(playerAddress)
                && state.gold >= bandageCost
        ) {
            vm.prank(playerAddress);
            dungeon.supplyBuyBandage();
            state = dungeon.getPlayer(playerAddress);
        }

        while (
            state.potions < 3 && dungeon.supplyPotionsBought(playerAddress) < dungeon.SUPPLY_POTION_STOCK()
                && state.gold >= potionCost
        ) {
            vm.prank(playerAddress);
            dungeon.supplyBuyPotion();
            state = dungeon.getPlayer(playerAddress);
        }
    }

    function _useCamp(RelicsV2BalanceDungeon dungeon, address playerAddress) internal {
        if (!dungeon.campAvailable(playerAddress)) return;

        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);
        (uint256 restCost, uint256 potionCost, uint256 weaponCost, uint256 armorCost) =
            dungeon.shopPricesForBossRoom(state.roomsCleared + 1);

        if (
            state.hp <= 70 && state.hp < dungeon.maxHp(playerAddress) && !dungeon.campRestUsed(playerAddress)
                && state.gold >= restCost
        ) {
            vm.prank(playerAddress);
            dungeon.campRest();
            state = dungeon.getPlayer(playerAddress);
        }

        while (
            state.potions < 3 && dungeon.campPotionsBought(playerAddress) < dungeon.CAMP_POTION_STOCK()
                && state.gold >= potionCost
        ) {
            vm.prank(playerAddress);
            dungeon.campBuyPotion();
            state = dungeon.getPlayer(playerAddress);
        }

        if (state.gold >= weaponCost) {
            vm.prank(playerAddress);
            dungeon.campBuyWeapon();
            state = dungeon.getPlayer(playerAddress);
        }

        if (state.gold >= armorCost) {
            vm.prank(playerAddress);
            dungeon.campBuyArmor();
        }
    }

    function _useBetweenRoomPotion(RelicsV2BalanceDungeon dungeon, address playerAddress) internal {
        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);
        if (state.monsterHp != 0 || state.hp > 35 || state.potions <= 1 || state.hp >= dungeon.maxHp(playerAddress)) {
            return;
        }

        vm.prank(playerAddress);
        dungeon.usePotion();
    }

    function _fulfill(RelicsV2BalanceDungeon dungeon, DevRandomnessAdapter adapter, address playerAddress) internal {
        uint256 requestId = dungeon.pendingRequestId(playerAddress);
        assertGt(requestId, 0, "expected pending dev randomness");
        assertTrue(adapter.pendingRequests(requestId), "adapter request must be pending");
        adapter.fulfill(requestId);
    }
}
