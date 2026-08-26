// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {MockVRFCoordinator} from "../src/MockVRFCoordinator.sol";

contract RelicsV1Dungeon is Delveworn {
    constructor(address coordinatorAddress) Delveworn(coordinatorAddress) {}

    function forceOffer(address playerAddress, Relic relic) external {
        relicOfferId[playerAddress] = relic;
        relicOfferRarity[playerAddress] = relicRarityOf(relic);
        relicOfferAvailable[playerAddress] = true;
    }
}

contract RelicsV1Test is Test {
    RelicsV1Dungeon internal dungeon;
    MockVRFCoordinator internal mockVRF;

    address internal player = address(0xA11CE);

    function setUp() public {
        mockVRF = new MockVRFCoordinator();
        dungeon = new RelicsV1Dungeon(address(mockVRF));
    }

    function testOneRandomRelicOfferAppearsAfterFirstBoss() public {
        _start();

        assertFalse(dungeon.relicOfferAvailable(player));

        _clearThroughFirstBoss();

        assertEq(dungeon.getPlayer(player).roomsCleared, 10);
        assertTrue(dungeon.relicOfferAvailable(player));
        assertEq(uint256(dungeon.equippedRelic(player)), uint256(Delveworn.Relic.None));
        assertEq(uint256(dungeon.relicOfferId(player)), uint256(Delveworn.Relic.BloodPrice));
    }

    function testBossRelicMustBeClaimedBeforeContinuing() public {
        _start();
        _clearThroughFirstBoss();

        vm.expectRevert("Claim boss relic first");
        vm.prank(player);
        dungeon.enterNextRoom();

        vm.prank(player);
        dungeon.claimRelic(false);

        assertFalse(dungeon.relicOfferAvailable(player));
        assertEq(dungeon.maxHp(player), 100);
        assertEq(uint256(dungeon.equippedRelic(player)), uint256(Delveworn.Relic.None));

        vm.prank(player);
        dungeon.enterNextRoom();
        _fulfill(_one(0));

        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);
        assertEq(minDamage, 8);
        assertEq(maxDamage, 12);
    }

    function testBloodPriceBoostsDamageAndPaysMaxHpOnRoomEntry() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.BloodPrice);

        assertEq(dungeon.maxHp(player), 100);
        assertEq(dungeon.playerCriticalChance(player), 15);

        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);
        assertEq(minDamage, 8);
        assertEq(maxDamage, 13);

        vm.prank(player);
        dungeon.enterNextRoom();

        assertEq(dungeon.maxHp(player), 98);
        assertLe(dungeon.getPlayer(player).hp, 98);

        _fulfill(_one(0));

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 99, 0, 50, 0));

        assertEq(dungeon.lastPlayerDamage(player), 8);
    }

    function testBloodPriceRetryDoesNotChargeRoomPenaltyTwice() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.BloodPrice);

        vm.prank(player);
        dungeon.enterNextRoom();

        assertEq(dungeon.maxHp(player), 98);

        uint256 requestedAt = dungeon.pendingRequestTimestamp(player);
        vm.warp(requestedAt + dungeon.VRF_TIMEOUT());

        vm.prank(player);
        dungeon.retryRandomness();

        assertEq(dungeon.maxHp(player), 98);
    }

    function testIronShellAddsMaxHpAndTradesDamageForDurability() public {
        _start();
        _clearThroughFirstBoss();

        uint256 hpBefore = dungeon.getPlayer(player).hp;
        _choose(Delveworn.Relic.IronShell);

        assertEq(dungeon.maxHp(player), 120);
        assertEq(dungeon.getPlayer(player).hp, _min(hpBefore + 20, 120));

        (uint256 minDamage, uint256 maxDamage) = dungeon.playerAttackRange(player);
        assertEq(minDamage, 8);
        assertEq(maxDamage, 12);

        (uint256 stormMin, uint256 stormMax) = dungeon.stormAttackRange(player);
        assertEq(stormMin, 0);
        assertEq(stormMax, 19);
    }

    function testIronShellHealingUsesNewMaxHp() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.IronShell);

        Delveworn.Player memory before = dungeon.getPlayer(player);
        assertLt(before.hp, 120);
        assertTrue(dungeon.supplyAvailable(player));

        vm.prank(player);
        dungeon.supplyBuyBandage();

        Delveworn.Player memory afterState = dungeon.getPlayer(player);
        assertEq(afterState.hp, _min(before.hp + dungeon.SUPPLY_BANDAGE_HEAL(), 120));
        assertLe(afterState.hp, dungeon.maxHp(player));
    }

    function testEchoLensRaisesCritChanceButCutsStormDamage() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.EchoLens);

        assertEq(dungeon.playerCriticalChance(player), 20);

        (uint256 normalMin, uint256 normalMax) = dungeon.playerAttackRange(player);
        assertEq(normalMin, 8);
        assertEq(normalMax, 12);

        (uint256 stormMin, uint256 stormMax) = dungeon.stormAttackRange(player);
        assertEq(stormMin, 0);
        assertEq(stormMax, 16);
    }

    function testEchoLensNineteenRollBecomesCritical() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.EchoLens);

        vm.prank(player);
        dungeon.enterNextRoom();
        _fulfill(_one(0));

        vm.prank(player);
        dungeon.attack();
        _fulfill(_attackWords(0, 19, 0, 50, 0));

        assertTrue(dungeon.lastCritical(player));
        assertEq(dungeon.lastPlayerDamage(player), 16);
    }

    function testOwnedRelicsCanBeSwitchedAndUnequippedBetweenRooms() public {
        _start();
        _clearThroughFirstBoss();
        _choose(Delveworn.Relic.BloodPrice);

        dungeon.forceOffer(player, Delveworn.Relic.IronShell);
        vm.prank(player);
        dungeon.claimRelic(false);

        assertEq(uint256(dungeon.equippedRelic(player)), uint256(Delveworn.Relic.BloodPrice));

        vm.prank(player);
        dungeon.equipOwnedRelic(Delveworn.Relic.IronShell);
        assertEq(uint256(dungeon.equippedRelic(player)), uint256(Delveworn.Relic.IronShell));

        vm.prank(player);
        dungeon.equipOwnedRelic(Delveworn.Relic.None);
        assertEq(uint256(dungeon.equippedRelic(player)), uint256(Delveworn.Relic.None));
    }

    function _start() internal {
        vm.prank(player);
        dungeon.startGame();
        _fulfill(_one(0));
    }

    function _clearThroughFirstBoss() internal {
        while (dungeon.getPlayer(player).roomsCleared < 10) {
            _clearCurrentMonster();

            if (dungeon.getPlayer(player).roomsCleared < 10) {
                vm.prank(player);
                dungeon.enterNextRoom();
                _fulfill(_one(0));
            }
        }
    }

    function _clearCurrentMonster() internal {
        while (dungeon.getPlayer(player).monsterHp > 0) {
            vm.prank(player);
            dungeon.attack();

            // Maximum base roll, guaranteed critical, minimum retaliation,
            // deterministic bonus-gold loot on the killing hit.
            _fulfill(_attackWords(4, 0, 0, 50, 0));
        }
    }

    function _choose(Delveworn.Relic relic) internal {
        dungeon.forceOffer(player, relic);
        vm.prank(player);
        dungeon.chooseRelic(relic);

        assertEq(uint256(dungeon.equippedRelic(player)), uint256(relic));
        assertFalse(dungeon.relicOfferAvailable(player));
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

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
