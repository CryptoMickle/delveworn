// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RelicBalanceTest} from "./RelicBalance.t.sol";
import {Delveworn} from "../src/Delveworn.sol";

/// @notice Runs every relic against the same deterministic player-address cohort
///         used by BalanceBaselineTest, removing pre-relic RNG sampling drift.
contract RelicBalanceMatchedTest is RelicBalanceTest {
    uint256 internal constant MATCHED_ADDRESS_BASE = 0xB000;

    function testMatchedBloodPriceBalance() public {
        _runSuite(Delveworn.Relic.BloodPrice, MATCHED_ADDRESS_BASE, "BLOOD PRICE MATCHED");
    }

    function testMatchedIronShellBalance() public {
        _runSuite(Delveworn.Relic.IronShell, MATCHED_ADDRESS_BASE, "IRON SHELL MATCHED");
    }

    function testMatchedEchoLensBalance() public {
        _runSuite(Delveworn.Relic.EchoLens, MATCHED_ADDRESS_BASE, "ECHO LENS MATCHED");
    }
}
