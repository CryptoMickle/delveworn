// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {DevRandomnessAdapter} from "../src/adapters/DevRandomnessAdapter.sol";

/// @notice Deterministic telemetry harness for the pre-relic Delveworn balance.
/// @dev This is intentionally a strategy simulation, not a claim about human play.
///      The exact same strategy can be rerun after balance/relic changes to measure drift.
contract BalanceBaselineTest is Test {
    uint256 internal constant RUNS = 32;
    uint256 internal constant MAX_ROOMS = 30;
    uint256 internal constant SAFETY_ACTION_LIMIT = 500;

    DevRandomnessAdapter internal adapter;
    Delveworn internal dungeon;

    uint256 internal totalRoomsCleared;
    uint256 internal totalBossesCleared;
    uint256 internal totalFinalGold;
    uint256 internal totalFinalPotions;
    uint256 internal totalFinalWeaponLevel;
    uint256 internal totalFinalArmorLevel;

    uint256 internal reached5;
    uint256 internal reached10;
    uint256 internal reached20;
    uint256 internal reached30;

    uint256 internal attackActions;
    uint256 internal combatPotionActions;
    uint256 internal betweenRoomPotionUses;
    uint256 internal supplyBandagesBought;
    uint256 internal supplyPotionsBought;
    uint256 internal campRestsBought;
    uint256 internal campPotionsBought;
    uint256 internal campWeaponsBought;
    uint256 internal campArmorBought;

    uint256 internal potionLoots;
    uint256 internal goldLoots;
    uint256 internal weaponLoots;
    uint256 internal armorLoots;

    function setUp() public {
        adapter = new DevRandomnessAdapter();
        dungeon = new Delveworn(address(adapter));
        adapter.setConsumer(address(dungeon));
    }

    function testPreRelicConservativeAttackBaseline() public {
        for (uint256 i = 0; i < RUNS; i++) {
            _playRun(address(uint160(0xB000 + i)));
        }

        console2.log("=== DELVEWORN PRE-RELIC BASELINE ===");
        console2.log("runs", RUNS);
        console2.log("room cap", MAX_ROOMS);
        console2.log("average rooms x100", (totalRoomsCleared * 100) / RUNS);
        console2.log("reach 5 bps", (reached5 * 10_000) / RUNS);
        console2.log("reach 10 bps", (reached10 * 10_000) / RUNS);
        console2.log("reach 20 bps", (reached20 * 10_000) / RUNS);
        console2.log("reach 30 bps", (reached30 * 10_000) / RUNS);
        console2.log("bosses cleared", totalBossesCleared);
        console2.log("average final gold x100", (totalFinalGold * 100) / RUNS);
        console2.log("average final potions x100", (totalFinalPotions * 100) / RUNS);
        console2.log("average final weapon level x100", (totalFinalWeaponLevel * 100) / RUNS);
        console2.log("average final armor level x100", (totalFinalArmorLevel * 100) / RUNS);
        console2.log("attack actions", attackActions);
        console2.log("combat potion actions", combatPotionActions);
        console2.log("between-room potion uses", betweenRoomPotionUses);
        console2.log("supply bandages bought", supplyBandagesBought);
        console2.log("supply potions bought", supplyPotionsBought);
        console2.log("camp rests bought", campRestsBought);
        console2.log("camp potions bought", campPotionsBought);
        console2.log("camp weapons bought", campWeaponsBought);
        console2.log("camp armor bought", campArmorBought);
        console2.log("potion loot drops", potionLoots);
        console2.log("gold loot drops", goldLoots);
        console2.log("weapon loot drops", weaponLoots);
        console2.log("armor loot drops", armorLoots);

        assertEq(reached30 <= RUNS, true);
        assertGt(totalRoomsCleared, 0);
        assertGt(attackActions, 0);
    }

    function _playRun(address playerAddress) internal {
        vm.prank(playerAddress);
        dungeon.startGame();
        _fulfill(playerAddress);

        uint256 safetyActions;

        while (safetyActions < SAFETY_ACTION_LIMIT) {
            safetyActions++;

            Delveworn.Player memory state = dungeon.getPlayer(playerAddress);

            if (!state.active || state.roomsCleared >= MAX_ROOMS) {
                break;
            }

            if (state.monsterHp > 0) {
                uint256 beforeRooms = state.roomsCleared;

                if (_shouldUseCombatPotion(playerAddress, state)) {
                    vm.prank(playerAddress);
                    dungeon.usePotion();
                    combatPotionActions++;
                    _fulfill(playerAddress);
                } else {
                    vm.prank(playerAddress);
                    dungeon.attack();
                    attackActions++;
                    _fulfill(playerAddress);
                }

                Delveworn.Player memory afterAction = dungeon.getPlayer(playerAddress);

                if (afterAction.roomsCleared > beforeRooms) {
                    _recordLoot(afterAction.lastLootType);
                }

                continue;
            }

            _useSupplyStop(playerAddress);
            _useCamp(playerAddress);
            _useBetweenRoomPotion(playerAddress);

            state = dungeon.getPlayer(playerAddress);

            if (!state.active || state.roomsCleared >= MAX_ROOMS) {
                break;
            }

            vm.prank(playerAddress);
            dungeon.enterNextRoom();
            _fulfill(playerAddress);
        }

        assertLt(safetyActions, SAFETY_ACTION_LIMIT, "baseline strategy hit safety limit");

        Delveworn.Player memory finalState = dungeon.getPlayer(playerAddress);

        totalRoomsCleared += finalState.roomsCleared;
        totalBossesCleared += finalState.roomsCleared / 10;
        totalFinalGold += finalState.gold;
        totalFinalPotions += finalState.potions;
        totalFinalWeaponLevel += finalState.weaponLevel;
        totalFinalArmorLevel += finalState.armorLevel;

        if (finalState.roomsCleared >= 5) reached5++;
        if (finalState.roomsCleared >= 10) reached10++;
        if (finalState.roomsCleared >= 20) reached20++;
        if (finalState.roomsCleared >= 30) reached30++;
    }

    function _shouldUseCombatPotion(address playerAddress, Delveworn.Player memory state) internal view returns (bool) {
        if (state.hp > 35 || state.potions == 0) {
            return false;
        }

        uint256 limit = state.monsterType == Delveworn.MonsterType.DungeonLord
            ? dungeon.BOSS_COMBAT_POTION_LIMIT()
            : dungeon.NORMAL_COMBAT_POTION_LIMIT();

        return dungeon.combatPotionsUsed(playerAddress) < limit;
    }

    function _useSupplyStop(address playerAddress) internal {
        if (!dungeon.supplyAvailable(playerAddress)) {
            return;
        }

        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);
        (uint256 bandageCost, uint256 potionCost) = dungeon.supplyPricesForStop(state.roomsCleared);

        if (state.hp <= 70 && !dungeon.supplyBandageUsed(playerAddress) && state.gold >= bandageCost) {
            vm.prank(playerAddress);
            dungeon.supplyBuyBandage();
            supplyBandagesBought++;
            state = dungeon.getPlayer(playerAddress);
        }

        while (
            state.potions < 3 && dungeon.supplyPotionsBought(playerAddress) < dungeon.SUPPLY_POTION_STOCK()
                && state.gold >= potionCost
        ) {
            vm.prank(playerAddress);
            dungeon.supplyBuyPotion();
            supplyPotionsBought++;
            state = dungeon.getPlayer(playerAddress);
        }
    }

    function _useCamp(address playerAddress) internal {
        if (!dungeon.campAvailable(playerAddress)) {
            return;
        }

        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);
        (uint256 restCost, uint256 potionCost, uint256 weaponCost, uint256 armorCost) =
            dungeon.shopPricesForBossRoom(state.roomsCleared + 1);

        if (state.hp <= 70 && !dungeon.campRestUsed(playerAddress) && state.gold >= restCost) {
            vm.prank(playerAddress);
            dungeon.campRest();
            campRestsBought++;
            state = dungeon.getPlayer(playerAddress);
        }

        while (
            state.potions < 3 && dungeon.campPotionsBought(playerAddress) < dungeon.CAMP_POTION_STOCK()
                && state.gold >= potionCost
        ) {
            vm.prank(playerAddress);
            dungeon.campBuyPotion();
            campPotionsBought++;
            state = dungeon.getPlayer(playerAddress);
        }

        if (state.gold >= weaponCost) {
            vm.prank(playerAddress);
            dungeon.campBuyWeapon();
            campWeaponsBought++;
            state = dungeon.getPlayer(playerAddress);
        }

        if (state.gold >= armorCost) {
            vm.prank(playerAddress);
            dungeon.campBuyArmor();
            campArmorBought++;
        }
    }

    function _useBetweenRoomPotion(address playerAddress) internal {
        Delveworn.Player memory state = dungeon.getPlayer(playerAddress);

        if (state.monsterHp != 0 || state.hp > 35 || state.potions <= 1) {
            return;
        }

        vm.prank(playerAddress);
        dungeon.usePotion();
        betweenRoomPotionUses++;
    }

    function _fulfill(address playerAddress) internal {
        uint256 requestId = dungeon.pendingRequestId(playerAddress);
        assertGt(requestId, 0, "expected pending dev randomness");
        assertTrue(adapter.pendingRequests(requestId), "adapter request must be pending");
        adapter.fulfill(requestId);
    }

    function _recordLoot(Delveworn.LootType lootType) internal {
        if (lootType == Delveworn.LootType.Potion) {
            potionLoots++;
        } else if (lootType == Delveworn.LootType.BonusGold) {
            goldLoots++;
        } else if (lootType == Delveworn.LootType.Weapon) {
            weaponLoots++;
        } else if (lootType == Delveworn.LootType.Armor) {
            armorLoots++;
        }
    }
}
