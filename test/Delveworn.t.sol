// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Vm} from "forge-std/Vm.sol";

import {Delveworn} from "../src/Delveworn.sol";

import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";

contract DelvewornTest is Test {
    Delveworn dungeon;
    MockVRFCoordinator mockVRF;

    address player = address(0x1234);

    function setUp() public {
        mockVRF = new MockVRFCoordinator();

        dungeon = new Delveworn(address(mockVRF));
    }

    /*
        ========================================================
        START
        ========================================================
    */

    function testStartGame() public {
        vm.prank(player);
        dungeon.startGame();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 100);
        assertEq(p.monsterHp, 0);
        assertEq(p.roomsCleared, 0);
        assertEq(p.potions, 3);
        assertEq(p.weaponLevel, 0);
        assertEq(p.armorLevel, 0);

        assertTrue(p.hasStarted);
        assertTrue(p.active);

        assertGt(dungeon.pendingRequestId(player), 0);
    }

    function testLeanRandomnessFulfilledEventAndFrontendSnapshot() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);

        vm.recordLogs();

        mockVRF.fulfill(requestId, _one(0));

        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 eventSignature = keccak256(bytes("RandomnessFulfilled(address,uint256,uint8)"));

        bool found = false;

        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter != address(dungeon) || logs[i].topics.length != 3 || logs[i].topics[0] != eventSignature
            ) {
                continue;
            }

            found = true;

            address eventPlayer = address(uint160(uint256(logs[i].topics[1])));

            assertEq(eventPlayer, player);

            assertEq(uint256(logs[i].topics[2]), requestId);

            uint8 kind = abi.decode(logs[i].data, (uint8));

            assertEq(kind, uint8(Delveworn.RequestKind.Monster));
        }

        assertTrue(found);

        Delveworn.FrontendSnapshot memory directSnapshot = dungeon.frontendSnapshot(player);

        assertEq(directSnapshot.hp, 100);

        assertEq(directSnapshot.monsterHp, 30);

        assertEq(directSnapshot.monsterMaxHp, 30);

        assertEq(directSnapshot.roomsCleared, 0);

        assertEq(directSnapshot.potions, 3);

        assertEq(directSnapshot.requestId, 0);

        assertEq(uint256(directSnapshot.requestKind), uint256(Delveworn.RequestKind.None));

        assertTrue(directSnapshot.hasStarted);

        assertTrue(directSnapshot.active);
    }

    /*
        ========================================================
        VRF TIMEOUT / RETRY
        ========================================================
    */

    function testNormalFulfillmentClearsVrfTimeoutState() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);

        assertEq(dungeon.pendingRequestTimestamp(player), block.timestamp);

        assertFalse(dungeon.randomnessRetryAvailable(player));

        mockVRF.fulfill(requestId, _one(0));

        assertEq(dungeon.pendingRequestId(player), 0);

        assertEq(dungeon.pendingRequestTimestamp(player), 0);

        assertFalse(dungeon.randomnessRetryAvailable(player));
    }

    function testRetryBeforeTimeoutReverts() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestedAt = dungeon.pendingRequestTimestamp(player);

        vm.warp(requestedAt + dungeon.VRF_TIMEOUT() - 1);

        assertFalse(dungeon.randomnessRetryAvailable(player));

        vm.startPrank(player);

        vm.expectRevert(bytes("VRF request not timed out"));

        dungeon.retryRandomness();

        vm.stopPrank();
    }

    function testTimedOutAttackCanBeRetried() public {
        _startWithMonster(0);

        vm.prank(player);
        dungeon.attack();

        uint256 oldRequestId = dungeon.pendingRequestId(player);

        uint256 requestedAt = dungeon.pendingRequestTimestamp(player);

        assertEq(uint256(dungeon.pendingRequestKind(player)), uint256(Delveworn.RequestKind.Attack));

        assertEq(mockVRF.requestedNumberCount(oldRequestId), 5);

        vm.warp(requestedAt + dungeon.VRF_TIMEOUT());

        assertTrue(dungeon.randomnessRetryAvailable(player));

        vm.prank(player);

        uint256 newRequestId = dungeon.retryRandomness();

        assertGt(newRequestId, oldRequestId);

        assertEq(dungeon.pendingRequestId(player), newRequestId);

        assertEq(uint256(dungeon.pendingRequestKind(player)), uint256(Delveworn.RequestKind.Attack));

        assertEq(mockVRF.requestedNumberCount(newRequestId), 5);

        assertEq(dungeon.pendingRequestTimestamp(player), block.timestamp);

        assertFalse(dungeon.randomnessRetryAvailable(player));
    }

    function testLateOldCallbackAfterRetryCannotResolveAttack() public {
        _startWithMonster(0);

        vm.prank(player);
        dungeon.attack();

        uint256 oldRequestId = dungeon.pendingRequestId(player);

        uint256 requestedAt = dungeon.pendingRequestTimestamp(player);

        vm.warp(requestedAt + dungeon.VRF_TIMEOUT());

        vm.prank(player);

        uint256 newRequestId = dungeon.retryRandomness();

        Delveworn.Player memory beforeLateCallback = dungeon.getPlayer(player);

        uint256[] memory numbers = new uint256[](5);

        numbers[0] = 2;
        numbers[1] = 99;
        numbers[2] = 1;
        numbers[3] = 50;
        numbers[4] = 0;

        vm.expectRevert(bytes("Unknown VRF request"));

        mockVRF.fulfill(oldRequestId, numbers);

        Delveworn.Player memory afterLateCallback = dungeon.getPlayer(player);

        assertEq(afterLateCallback.hp, beforeLateCallback.hp);

        assertEq(afterLateCallback.monsterHp, beforeLateCallback.monsterHp);

        assertEq(dungeon.pendingRequestId(player), newRequestId);

        mockVRF.fulfill(newRequestId, numbers);

        assertEq(dungeon.pendingRequestId(player), 0);

        Delveworn.Player memory afterRealCallback = dungeon.getPlayer(player);

        assertLt(afterRealCallback.monsterHp, beforeLateCallback.monsterHp);
    }

    /*
        ========================================================
        MONSTER SPAWNS
        ========================================================
    */

    function testRandomZombieSpawn() public {
        _startWithMonster(0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(uint256(p.monsterType), uint256(Delveworn.MonsterType.Zombie));

        assertEq(p.monsterHp, 30);

        assertEq(p.monsterMaxHp, 30);
    }

    function testRandomGoblinSpawn() public {
        _startWithMonster(50);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(uint256(p.monsterType), uint256(Delveworn.MonsterType.Goblin));

        assertEq(p.monsterHp, 40);
    }

    function testRandomOrcSpawn() public {
        _startWithMonster(90);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(uint256(p.monsterType), uint256(Delveworn.MonsterType.Orc));

        assertEq(p.monsterHp, 60);
    }

    /*
        ========================================================
        NORMAL ATTACK
        ========================================================
    */

    function testNormalAttack() public {
        _startWithMonster(0);

        _attackResolve(2, 99, 1, 50, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 95);

        assertEq(p.monsterHp, 20);

        assertEq(dungeon.lastPlayerDamage(player), 10);

        assertEq(dungeon.lastMonsterDamage(player), 5);

        assertFalse(dungeon.lastCritical(player));
    }

    function testCriticalHit() public {
        _startWithMonster(0);

        _attackResolve(2, 0, 1, 50, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 95);

        assertEq(p.monsterHp, 10);

        assertEq(dungeon.lastPlayerDamage(player), 20);

        assertTrue(dungeon.lastCritical(player));
    }

    /*
        ========================================================
        STORM ATTACK
        ========================================================
    */

    function testStormRangeStartsAtZeroToTwenty() public {
        _startWithMonster(0);

        (uint256 minDamage, uint256 maxDamage) = dungeon.stormAttackRange(player);

        assertEq(minDamage, 0);

        assertEq(maxDamage, 20);
    }

    function testStormRangeScalesWithWeapon() public {
        _killRoomOne(85, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.weaponLevel, 1);

        (uint256 minDamage, uint256 maxDamage) = dungeon.stormAttackRange(player);

        assertEq(minDamage, 0);

        assertEq(maxDamage, 24);
    }

    function testStormCanDealZeroDamage() public {
        _startWithMonster(0);

        _stormResolve(0, 1, 50, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.monsterHp, 30);

        assertEq(p.hp, 95);

        assertEq(dungeon.lastPlayerDamage(player), 0);

        assertEq(dungeon.lastMonsterDamage(player), 5);

        assertFalse(dungeon.lastCritical(player));
    }

    function testStormCanDealMaximumDamage() public {
        _startWithMonster(0);

        _stormResolve(20, 1, 50, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.monsterHp, 10);

        assertEq(p.hp, 95);

        assertEq(dungeon.lastPlayerDamage(player), 20);

        assertFalse(dungeon.lastCritical(player));
    }

    function testStormNeverCriticals() public {
        _startWithMonster(0);

        _attackResolve(2, 0, 0, 50, 0);

        assertTrue(dungeon.lastCritical(player));

        _stormResolve(20, 0, 50, 0);

        assertFalse(dungeon.lastCritical(player));
    }

    function testStormKillHasNoRetaliation() public {
        _startWithMonster(0);

        _attackResolve(2, 0, 0, 50, 0);

        Delveworn.Player memory before = dungeon.getPlayer(player);

        assertEq(before.hp, 96);

        assertEq(before.monsterHp, 10);

        _stormResolve(20, 2, 50, 0);

        Delveworn.Player memory afterState = dungeon.getPlayer(player);

        assertEq(afterState.hp, 96);

        assertEq(afterState.monsterHp, 0);

        assertEq(afterState.roomsCleared, 1);

        assertEq(dungeon.lastMonsterDamage(player), 0);
    }

    function testStormRequestsFourRandomNumbers() public {
        _startWithMonster(0);

        vm.prank(player);
        dungeon.stormAttack();

        uint256 requestId = dungeon.pendingRequestId(player);

        assertEq(mockVRF.requestedNumberCount(requestId), 4);

        assertEq(uint256(dungeon.pendingRequestKind(player)), uint256(Delveworn.RequestKind.Storm));
    }

    /*
        ========================================================
        V8.5 ARMOR CAP
        ========================================================
    */

    function testArmorStillReducesDamageOnePerLevelBelowCap() public {
        _reachCamp();

        vm.prank(player);
        dungeon.campBuyArmor();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        (uint256 minDamage, uint256 maxDamage) = dungeon.monsterDamageRange(player);

        /*
            Dungeon Lord Room 10 raw:
            12-14

            Armor Lv1:
            11-13

            This is nowhere near the
            50% cap, so flat Armor
            behaves exactly as before.
        */

        assertEq(minDamage, 11);

        assertEq(maxDamage, 13);
    }

    function testHighArmorCannotReduceMoreThanFiftyPercent() public {
        /*
            Earn Armor loot in Rooms 1-9.

            Armor Lv9 at Boss Room 10.

            Boss raw damage:
            12-14

            Old behavior:
            3-5

            V8.5:
            6-7

            Because Armor may not reduce
            more than 50%.
        */

        _reachCampWithNineArmor();

        Delveworn.Player memory beforeBoss = dungeon.getPlayer(player);

        assertEq(beforeBoss.armorLevel, 9);

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        (uint256 minDamage, uint256 maxDamage) = dungeon.monsterDamageRange(player);

        assertEq(minDamage, 6);

        assertEq(maxDamage, 7);
    }

    function testArmorCapRoundsOddDamageUp() public {
        _reachCampWithNineArmor();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        /*
            Dungeon Lord Room 10:

            base damage = 13

            monsterRoll 1 =>
            raw damage 13.

            Armor Lv9 would normally
            reduce this to 4.

            50% cap requires at least:

            ceil(13 / 2) = 7.
        */

        _attackResolve(2, 99, 1, 50, 0);

        assertEq(dungeon.lastMonsterDamage(player), 7);
    }

    function testArmorCapAppliesToActualCombatDamage() public {
        _reachCampWithNineArmor();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        Delveworn.Player memory before = dungeon.getPlayer(player);

        _attackResolve(2, 99, 0, 50, 0);

        Delveworn.Player memory afterState = dungeon.getPlayer(player);

        /*
            raw = 12

            Armor Lv9:
            flat result 3

            cap result 6
        */

        assertEq(dungeon.lastMonsterDamage(player), 6);

        assertEq(afterState.hp, before.hp - 6);
    }

    function testArmorReductionPercentConstant() public {
        assertEq(dungeon.MAX_ARMOR_REDUCTION_PERCENT(), 50);
    }

    /*
        ========================================================
        POTIONS
        ========================================================
    */

    function testPotionDuringCombat() public {
        _startWithMonster(90);

        _attackResolve(2, 99, 2, 50, 0);

        vm.prank(player);
        dungeon.usePotion();

        _fulfillCurrent(_one(2));

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 100);

        assertEq(p.potions, 2);

        assertEq(dungeon.combatPotionsUsed(player), 1);
    }

    function testPotionBetweenRoomsDoesNotUseCombatLimit() public {
        _killRoomOne(50, 0);

        Delveworn.Player memory before = dungeon.getPlayer(player);

        assertEq(before.hp, 90);

        vm.prank(player);
        dungeon.usePotion();

        Delveworn.Player memory afterState = dungeon.getPlayer(player);

        assertEq(afterState.hp, 100);

        assertEq(afterState.potions, 2);

        assertEq(dungeon.combatPotionsUsed(player), 0);
    }

    function testNormalFightPotionLimitIsTwo() public {
        _killRoomOne(10, 0);

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(90));

        _attackResolve(2, 99, 2, 50, 0);

        vm.prank(player);
        dungeon.usePotion();

        _fulfillCurrent(_one(0));

        _attackResolve(2, 99, 2, 50, 0);

        vm.prank(player);
        dungeon.usePotion();

        _fulfillCurrent(_one(0));

        assertEq(dungeon.combatPotionsUsed(player), 2);

        _attackResolve(2, 99, 2, 50, 0);

        vm.expectRevert("Potion limit reached");

        vm.prank(player);
        dungeon.usePotion();
    }

    /*
        ========================================================
        INVENTORY / LOOT
        ========================================================
    */

    function testPotionInventoryCapsAtFive() public {
        _startWithMonster(0);

        _killCurrentMonsterWithPotionLoot();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        _killCurrentMonsterWithPotionLoot();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.potions, 5);
    }

    function testPotionLootAtCapBecomesGold() public {
        _startWithMonster(0);

        _killCurrentMonsterWithPotionLoot();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        _killCurrentMonsterWithPotionLoot();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        Delveworn.Player memory before = dungeon.getPlayer(player);

        uint256 goldBefore = before.gold;

        _killCurrentMonsterWithPotionLoot();

        Delveworn.Player memory afterState = dungeon.getPlayer(player);

        assertEq(afterState.potions, 5);

        assertEq(afterState.gold, goldBefore + 15);

        assertEq(afterState.lastLootAmount, 10);
    }

    function testPotionLoot() public {
        _killRoomOne(10, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.potions, 4);

        assertEq(uint256(p.lastLootType), uint256(Delveworn.LootType.Potion));
    }

    function testBonusGoldLoot() public {
        _killRoomOne(50, 10);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.gold, 20);

        assertEq(p.lastLootAmount, 15);
    }

    function testWeaponLoot() public {
        _killRoomOne(85, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.weaponLevel, 1);
    }

    function testArmorLoot() public {
        _killRoomOne(95, 0);

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.armorLevel, 1);
    }

    /*
        ========================================================
        SCALING
        ========================================================
    */

    function testZombieStatsRoomOne() public {
        (uint256 hp, uint256 minDamage, uint256 maxDamage, uint256 goldReward) =
            dungeon.monsterStatsForRoom(Delveworn.MonsterType.Zombie, 1);

        assertEq(hp, 30);
        assertEq(minDamage, 4);
        assertEq(maxDamage, 6);
        assertEq(goldReward, 5);
    }

    function testGoblinRoom43Scaling() public {
        (uint256 hp, uint256 minDamage, uint256 maxDamage, uint256 goldReward) =
            dungeon.monsterStatsForRoom(Delveworn.MonsterType.Goblin, 43);

        assertEq(hp, 107);
        assertEq(minDamage, 11);
        assertEq(maxDamage, 13);
        assertEq(goldReward, 24);
    }

    function testDungeonLordRoom10StatsUnchanged() public {
        (uint256 hp, uint256 minDamage, uint256 maxDamage, uint256 goldReward) =
            dungeon.monsterStatsForRoom(Delveworn.MonsterType.DungeonLord, 10);

        assertEq(hp, 122);
        assertEq(minDamage, 12);
        assertEq(maxDamage, 14);
        assertEq(goldReward, 43);
    }

    /*
        ========================================================
        SUPPLY PRICES
        ========================================================
    */

    function testSupplyPricesRoom5() public {
        (uint256 bandage, uint256 potion) = dungeon.supplyPricesForStop(5);

        assertEq(bandage, 20);
        assertEq(potion, 25);
    }

    function testSupplyPricesRoom10() public {
        (uint256 bandage, uint256 potion) = dungeon.supplyPricesForStop(10);

        assertEq(bandage, 20);
        assertEq(potion, 25);
    }

    function testSupplyPricesRoom15() public {
        (uint256 bandage, uint256 potion) = dungeon.supplyPricesForStop(15);

        assertEq(bandage, 25);
        assertEq(potion, 30);
    }

    function testSupplyPricesRoom20() public {
        (uint256 bandage, uint256 potion) = dungeon.supplyPricesForStop(20);

        assertEq(bandage, 25);
        assertEq(potion, 30);
    }

    function testSupplyPricesRoom25() public {
        (uint256 bandage, uint256 potion) = dungeon.supplyPricesForStop(25);

        assertEq(bandage, 30);
        assertEq(potion, 35);
    }

    function testInvalidSupplyRoomReverts() public {
        vm.expectRevert("Invalid supply stop");

        dungeon.supplyPricesForStop(12);
    }

    /*
        ========================================================
        SUPPLY STOP
        ========================================================
    */

    function testSupplyNotAvailableEarly() public {
        _startWithMonster(0);

        assertFalse(dungeon.supplyAvailable(player));
    }

    function testSupplyOpensAfterRoomFive() public {
        _reachSupplyStop();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.roomsCleared, 5);

        assertTrue(dungeon.supplyAvailable(player));
    }

    function testSupplyBandageHeals25() public {
        _reachSupplyStop();

        vm.prank(player);
        dungeon.supplyBuyBandage();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 100);

        assertTrue(dungeon.supplyBandageUsed(player));
    }

    function testSupplyBandageOnlyOnce() public {
        _reachSupplyStop();

        vm.prank(player);
        dungeon.supplyBuyBandage();

        vm.expectRevert("Bandage already used");

        vm.prank(player);
        dungeon.supplyBuyBandage();
    }

    function testSupplySellsTwoPotions() public {
        _reachSupplyStop();

        vm.startPrank(player);

        dungeon.supplyBuyPotion();
        dungeon.supplyBuyPotion();

        vm.stopPrank();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.potions, 5);

        assertEq(dungeon.supplyPotionsBought(player), 2);
    }

    function testSupplyThirdPotionIsSoldOut() public {
        _reachSupplyStop();

        vm.startPrank(player);

        dungeon.supplyBuyPotion();
        dungeon.supplyBuyPotion();

        vm.expectRevert("Supply potion stock empty");

        dungeon.supplyBuyPotion();

        vm.stopPrank();
    }

    function testCanSkipSupplyStop() public {
        _reachSupplyStop();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        assertFalse(dungeon.supplyAvailable(player));
    }

    /*
        ========================================================
        CAMP PRICES
        ========================================================
    */

    function testCampPricesRoom10() public {
        (uint256 rest, uint256 potion, uint256 weapon, uint256 armor) = dungeon.shopPricesForBossRoom(10);

        assertEq(rest, 25);
        assertEq(potion, 20);
        assertEq(weapon, 60);
        assertEq(armor, 60);
    }

    function testCampPricesRoom20() public {
        (uint256 rest, uint256 potion, uint256 weapon, uint256 armor) = dungeon.shopPricesForBossRoom(20);

        assertEq(rest, 30);
        assertEq(potion, 25);
        assertEq(weapon, 80);
        assertEq(armor, 80);
    }

    function testCampPricesRoom40() public {
        (uint256 rest, uint256 potion, uint256 weapon, uint256 armor) = dungeon.shopPricesForBossRoom(40);

        assertEq(rest, 40);
        assertEq(potion, 35);
        assertEq(weapon, 120);
        assertEq(armor, 120);
    }

    /*
        ========================================================
        CAMP
        ========================================================
    */

    function testCampOpensAfterRoomNine() public {
        _reachCamp();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.roomsCleared, 9);

        assertTrue(dungeon.campAvailable(player));

        assertFalse(dungeon.supplyAvailable(player));
    }

    function testCampRest() public {
        _reachCamp();

        vm.prank(player);
        dungeon.campRest();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.hp, 100);

        assertTrue(dungeon.campRestUsed(player));
    }

    function testCampSellsTwoPotions() public {
        _reachCamp();

        vm.startPrank(player);

        dungeon.campBuyPotion();
        dungeon.campBuyPotion();

        vm.stopPrank();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.potions, 5);

        assertEq(dungeon.campPotionsBought(player), 2);
    }

    function testCampThirdPotionSoldOut() public {
        _reachCamp();

        vm.startPrank(player);

        dungeon.campBuyPotion();
        dungeon.campBuyPotion();

        vm.expectRevert("Camp potion stock empty");

        dungeon.campBuyPotion();

        vm.stopPrank();
    }

    function testCampBuyWeapon() public {
        _reachCamp();

        vm.prank(player);
        dungeon.campBuyWeapon();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.weaponLevel, 1);

        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);

        assertEq(minDamage, 10);

        assertEq(maxDamage, 14);
    }

    function testCampBuyArmor() public {
        _reachCamp();

        vm.prank(player);
        dungeon.campBuyArmor();

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.armorLevel, 1);
    }

    function testCanEnterBossWithoutShopping() public {
        _reachCamp();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(uint256(p.monsterType), uint256(Delveworn.MonsterType.DungeonLord));

        assertEq(p.monsterHp, 122);
    }

    /*
        ========================================================
        SUPPLY AFTER BOSS
        ========================================================
    */

    function testSupplyOpensAfterDungeonLordRoom10() public {
        _reachCamp();

        vm.prank(player);
        dungeon.enterNextRoom();

        _fulfillCurrent(_one(0));

        _killCurrentMonsterWithBonusGold();

        Delveworn.Player memory afterBoss = dungeon.getPlayer(player);

        assertEq(afterBoss.roomsCleared, 10);

        assertTrue(dungeon.relicOfferAvailable(player));
        assertFalse(dungeon.supplyAvailable(player));

        vm.prank(player);
        dungeon.claimRelic(false);

        assertTrue(dungeon.supplyAvailable(player));
    }

    /*
        ========================================================
        SNAPSHOT
        ========================================================
    */

    function testCombatSnapshotShowsSupplyState() public {
        _reachSupplyStop();

        (
            uint256 attackMin,
            uint256 attackMax,,,
            uint256 requestId,
            Delveworn.RequestKind requestKind,,,,
            bool campOpen,,,,
            bool supplyOpen,,
            uint256 supplyPotionPurchases
        ) = dungeon.combatSnapshot(player);

        assertEq(attackMin, 8);

        assertEq(attackMax, 12);

        assertEq(requestId, 0);

        assertEq(uint256(requestKind), uint256(Delveworn.RequestKind.None));

        assertFalse(campOpen);

        assertTrue(supplyOpen);

        assertEq(supplyPotionPurchases, 0);
    }

    /*
        ========================================================
        VRF SECURITY
        ========================================================
    */

    function testOnlyCoordinatorCanFulfill() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);

        vm.expectRevert("Only VRF coordinator");

        vm.prank(player);

        dungeon.rawFulfillRandomNumbers(requestId, _one(0));
    }

    function testWrongRandomNumberCountReverts() public {
        vm.prank(player);
        dungeon.startGame();

        uint256 requestId = dungeon.pendingRequestId(player);

        vm.expectRevert("Wrong random number count");

        vm.prank(address(mockVRF));

        dungeon.rawFulfillRandomNumbers(requestId, _five(0, 0, 0, 0, 0));
    }

    function testWrongStormRandomNumberCountReverts() public {
        _startWithMonster(0);

        vm.prank(player);
        dungeon.stormAttack();

        uint256 requestId = dungeon.pendingRequestId(player);

        vm.expectRevert("Wrong random number count");

        vm.prank(address(mockVRF));

        dungeon.rawFulfillRandomNumbers(requestId, _five(0, 0, 0, 0, 0));
    }

    function testUnknownRequestReverts() public {
        vm.expectRevert("Unknown VRF request");

        vm.prank(address(mockVRF));

        dungeon.rawFulfillRandomNumbers(999999, _one(0));
    }

    /*
        ========================================================
        HELPERS
        ========================================================
    */

    function _startWithMonster(uint256 monsterRoll) internal {
        vm.prank(player);
        dungeon.startGame();

        _fulfillCurrent(_one(monsterRoll));
    }

    function _killRoomOne(uint256 lootRoll, uint256 amountRoll) internal {
        _startWithMonster(0);

        _attackResolve(2, 99, 1, 50, 0);

        _attackResolve(2, 99, 1, 50, 0);

        _attackResolve(2, 99, 1, lootRoll, amountRoll);
    }

    function _reachSupplyStop() internal {
        _startWithMonster(0);

        for (uint256 room = 1; room <= 5; room++) {
            _killCurrentMonsterWithBonusGold();

            if (room < 5) {
                vm.prank(player);
                dungeon.enterNextRoom();

                _fulfillCurrent(_one(0));
            }
        }
    }

    function _reachCamp() internal {
        _startWithMonster(0);

        for (uint256 room = 1; room <= 9; room++) {
            _killCurrentMonsterWithBonusGold();

            if (room < 9) {
                vm.prank(player);
                dungeon.enterNextRoom();

                _fulfillCurrent(_one(0));
            }
        }
    }

    /*
        V8.5 helper.

        Defeat Rooms 1-9 with Armor loot
        every time.

        Result:
        Armor Lv9 before Boss Room 10.
    */

    function _reachCampWithNineArmor() internal {
        _startWithMonster(0);

        for (uint256 room = 1; room <= 9; room++) {
            _killCurrentMonsterWithArmorLoot();

            if (room < 9) {
                vm.prank(player);
                dungeon.enterNextRoom();

                _fulfillCurrent(_one(0));
            }
        }

        Delveworn.Player memory p = dungeon.getPlayer(player);

        assertEq(p.roomsCleared, 9);

        assertEq(p.armorLevel, 9);

        assertTrue(p.active);

        assertTrue(dungeon.campAvailable(player));
    }

    function _killCurrentMonsterWithBonusGold() internal {
        while (true) {
            Delveworn.Player memory p = dungeon.getPlayer(player);

            assertTrue(p.active);

            if (p.monsterHp == 0) {
                break;
            }

            _attackResolve(2, 0, 0, 50, 10);
        }
    }

    function _killCurrentMonsterWithPotionLoot() internal {
        while (true) {
            Delveworn.Player memory p = dungeon.getPlayer(player);

            assertTrue(p.active);

            if (p.monsterHp == 0) {
                break;
            }

            _attackResolve(2, 0, 0, 10, 0);
        }
    }

    function _killCurrentMonsterWithArmorLoot() internal {
        while (true) {
            Delveworn.Player memory p = dungeon.getPlayer(player);

            assertTrue(p.active);

            if (p.monsterHp == 0) {
                break;
            }

            /*
                95 => Armor loot
                when the final hit lands.
            */

            _attackResolve(2, 0, 0, 95, 0);
        }
    }

    function _attackResolve(
        uint256 attackRoll,
        uint256 criticalRoll,
        uint256 monsterRoll,
        uint256 lootRoll,
        uint256 amountRoll
    ) internal {
        vm.prank(player);
        dungeon.attack();

        _fulfillCurrent(_five(attackRoll, criticalRoll, monsterRoll, lootRoll, amountRoll));
    }

    function _stormResolve(uint256 stormRoll, uint256 monsterRoll, uint256 lootRoll, uint256 amountRoll) internal {
        vm.prank(player);
        dungeon.stormAttack();

        _fulfillCurrent(_four(stormRoll, monsterRoll, lootRoll, amountRoll));
    }

    function _fulfillCurrent(uint256[] memory numbers) internal {
        uint256 requestId = dungeon.pendingRequestId(player);

        assertGt(requestId, 0);

        mockVRF.fulfill(requestId, numbers);
    }

    function _one(uint256 a) internal pure returns (uint256[] memory numbers) {
        numbers = new uint256[](1);

        numbers[0] = a;
    }

    function _four(uint256 a, uint256 b, uint256 c, uint256 d) internal pure returns (uint256[] memory numbers) {
        numbers = new uint256[](4);

        numbers[0] = a;
        numbers[1] = b;
        numbers[2] = c;
        numbers[3] = d;
    }

    function _five(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        internal
        pure
        returns (uint256[] memory numbers)
    {
        numbers = new uint256[](5);

        numbers[0] = a;
        numbers[1] = b;
        numbers[2] = c;
        numbers[3] = d;
        numbers[4] = e;
    }
}
