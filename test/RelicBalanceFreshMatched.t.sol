// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Test.sol";
import {BalanceBaselineTest} from "./BalanceBaseline.t.sol";
import {RelicBalanceTest} from "./RelicBalance.t.sol";
import {Delveworn} from "../src/Delveworn.sol";
import {DevRandomnessAdapter} from "../src/adapters/DevRandomnessAdapter.sol";

/// @notice Calibration harness where every simulated run gets a fresh dungeon and
///         randomness adapter. This resets requestNonce/requestId for every address,
///         guaranteeing identical pre-relic randomness across control and relic suites.
contract FreshBaselineMatchedTest is BalanceBaselineTest {
    uint256 internal constant MATCHED_ADDRESS_BASE = 0xB000;

    function testFreshMatchedBaseline() public noGasMetering {
        for (uint256 i = 0; i < RUNS; i++) {
            adapter = new DevRandomnessAdapter();
            dungeon = new Delveworn(address(adapter));
            adapter.setConsumer(address(dungeon));
            _playRun(address(uint160(MATCHED_ADDRESS_BASE + i)));
        }

        console2.log("=== DELVEWORN FRESH MATCHED BASELINE ===");
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

        assertGt(totalRoomsCleared, 0);
        assertGt(reached5, 0);
        assertGt(attackActions, 0);
    }
}

contract FreshRelicMatchedTest is RelicBalanceTest {
    uint256 internal constant MATCHED_ADDRESS_BASE = 0xB000;

    function testFreshMatchedBloodPrice() public {
        _runFreshSuite(Delveworn.Relic.BloodPrice, "BLOOD PRICE FRESH MATCHED");
    }

    function testFreshMatchedIronShell() public {
        _runFreshSuite(Delveworn.Relic.IronShell, "IRON SHELL FRESH MATCHED");
    }

    function testFreshMatchedEchoLens() public {
        _runFreshSuite(Delveworn.Relic.EchoLens, "ECHO LENS FRESH MATCHED");
    }

    function _runFreshSuite(Delveworn.Relic relic, string memory label) internal noGasMetering {
        for (uint256 i = 0; i < RUNS; i++) {
            adapter = new DevRandomnessAdapter();
            dungeon = new Delveworn(address(adapter));
            adapter.setConsumer(address(dungeon));
            _playRun(address(uint160(MATCHED_ADDRESS_BASE + i)), relic);
        }

        console2.log("=== DELVEWORN FRESH MATCHED RELIC BALANCE ===");
        console2.log(label);
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
        console2.log("average final max hp x100", (totalFinalMaxHp * 100) / RUNS);
        console2.log("attack actions", attackActions);
        console2.log("combat potion actions", combatPotionActions);
        console2.log("between-room potion uses", betweenRoomPotionUses);
        console2.log("supply bandages bought", supplyBandagesBought);
        console2.log("supply potions bought", supplyPotionsBought);
        console2.log("camp rests bought", campRestsBought);
        console2.log("camp potions bought", campPotionsBought);
        console2.log("camp weapons bought", campWeaponsBought);
        console2.log("camp armor bought", campArmorBought);

        assertGt(totalRoomsCleared, 0);
        assertGt(reached5, 0);
        assertGt(attackActions, 0);
    }
}
