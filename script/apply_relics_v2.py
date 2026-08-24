from pathlib import Path

path = Path("src/Delveworn.sol")
text = path.read_text()

if "enum RelicRarity" in text and "Worldbreaker" in text:
    print("Relics V2 already applied")
    raise SystemExit(0)


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one occurrence, found {count}: {old[:120]!r}")
    text = text.replace(old, new, 1)


replace_once(
    'pragma solidity ^0.8.24;\n\ninterface IVRFCoordinator',
    'pragma solidity ^0.8.24;\n\nimport {RelicRules} from "./RelicRules.sol";\n\ninterface IVRFCoordinator',
)

replace_once(
'''    enum Relic {
        None,
        BloodPrice,
        IronShell,
        EchoLens
    }
''',
'''    enum Relic {
        None,
        // Common
        BloodPrice,
        IronShell,
        EchoLens,
        // Uncommon
        GlassEdge,
        AshenFang,
        Stormglass,
        // Rare
        GildedHunger,
        GravePact,
        Stormheart,
        // Epic
        TitanBone,
        BlackMirror,
        BloodEngine,
        // Legendary
        CrownOfRuin,
        UndyingFlame,
        Worldbreaker
    }

    enum RelicRarity {
        None,
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }
''')

replace_once(
'''        bool supplyOpen;
        bool bandageUsed;
        uint256 supplyPotionPurchases;
''',
'''        bool supplyOpen;
        bool bandageUsed;
        uint256 supplyPotionPurchases;
        Relic equippedRelic;
        bool relicOfferAvailable;
        RelicRarity relicOfferRarity;
        uint256 maxHp;
        uint256 criticalChance;
        bool relicReviveUsed;
''')

start = text.index('    /*\n        Relics V1')
end_marker = '    uint256 public constant ECHO_LENS_STORM_DAMAGE_PENALTY_PERCENT = 20;\n'
end = text.index(end_marker, start) + len(end_marker)
text = text[:start] + '''    /*
        Relics V2

        Relics are run-only and occupy one slot. After room 5 the killing
        VRF callback rolls one rarity tier without an extra randomness
        request, then offers all three relics in that tier.

        Rarity odds:
        Common 55%, Uncommon 25%, Rare 12%, Epic 6%, Legendary 2%.

        The full catalog and numeric modifiers live in RelicRules.sol.
        Common retains the calibrated V1 identities; higher tiers become
        progressively more run-defining while preserving explicit tradeoffs.
    */
    uint256 public constant BASE_MAX_HP = 100;
    uint256 public constant RELIC_OFFER_ROOM = 5;
    uint256 public constant RELIC_MIN_MAX_HP = 20;
    uint256 public constant BASE_CRITICAL_CHANCE = 15;
''' + text[end:]

replace_once(
'''    mapping(address => Relic) public equippedRelic;
    mapping(address => bool) public relicOfferAvailable;
    mapping(address => uint256) public playerMaxHp;
''',
'''    mapping(address => Relic) public equippedRelic;
    mapping(address => bool) public relicOfferAvailable;
    mapping(address => RelicRarity) public relicOfferRarity;
    mapping(address => uint256) public playerMaxHp;
    mapping(address => bool) public relicReviveUsed;
''')

replace_once(
'''    event RelicOffered(address indexed player, uint256 indexed roomCleared);

    event RelicChosen(address indexed player, Relic relic, uint256 maxHp);

    event BloodPricePaid(address indexed player, uint256 newMaxHp, uint256 currentHp);
''',
'''    event RelicOffered(address indexed player, uint256 indexed roomCleared);

    event RelicOfferRolled(address indexed player, RelicRarity rarity);

    event RelicChosen(address indexed player, Relic relic, RelicRarity rarity, uint256 maxHp);

    event BloodPricePaid(address indexed player, uint256 newMaxHp, uint256 currentHp);

    event RelicRevived(address indexed player, Relic relic, uint256 hp);
''')

replace_once(
'''        equippedRelic[msg.sender] = Relic.None;
        relicOfferAvailable[msg.sender] = false;
        playerMaxHp[msg.sender] = BASE_MAX_HP;
''',
'''        equippedRelic[msg.sender] = Relic.None;
        relicOfferAvailable[msg.sender] = false;
        relicOfferRarity[msg.sender] = RelicRarity.None;
        playerMaxHp[msg.sender] = BASE_MAX_HP;
        relicReviveUsed[msg.sender] = false;
''')

old_relic_block_start = text.index('    /*\n        ========================================================\n        RELICS V1')
old_relic_block_end = text.index('    /*\n        ========================================================\n        GAME ACTIONS', old_relic_block_start)
new_relic_block = '''    /*
        ========================================================
        RELICS V2
        ========================================================
    */

    /// @notice Backwards-compatible Common choices preview.
    function relicChoices() external pure returns (Relic first, Relic second, Relic third) {
        return (Relic.BloodPrice, Relic.IronShell, Relic.EchoLens);
    }

    function relicChoicesForRarity(RelicRarity rarity) public pure returns (Relic first, Relic second, Relic third) {
        (uint8 firstId, uint8 secondId, uint8 thirdId) = RelicRules.choicesForRarity(uint8(rarity));
        return (Relic(firstId), Relic(secondId), Relic(thirdId));
    }

    function currentRelicChoices(address playerAddress)
        external
        view
        returns (RelicRarity rarity, Relic first, Relic second, Relic third)
    {
        rarity = relicOfferRarity[playerAddress];
        require(rarity != RelicRarity.None, "No relic offer");
        (first, second, third) = relicChoicesForRarity(rarity);
    }

    function relicRarityOf(Relic relic) public pure returns (RelicRarity) {
        return RelicRarity(RelicRules.relicRarity(uint8(relic)));
    }

    function relicRarityWeightBps(RelicRarity rarity) external pure returns (uint16) {
        return RelicRules.rarityWeightBps(uint8(rarity));
    }

    function previewRelicRarity(uint256 entropy) external pure returns (RelicRarity) {
        return RelicRarity(RelicRules.rollRarity(entropy));
    }

    function chooseRelic(Relic relic) external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(player.active, "Game is not active");
        require(player.monsterHp == 0, "Choose relic between rooms");
        require(relicOfferAvailable[msg.sender], "No relic offer");
        require(equippedRelic[msg.sender] == Relic.None, "Relic slot occupied");
        require(relic != Relic.None && uint256(relic) <= uint256(Relic.Worldbreaker), "Invalid relic");

        RelicRarity rarity = relicRarityOf(relic);
        require(rarity == relicOfferRarity[msg.sender], "Relic not in offer");

        equippedRelic[msg.sender] = relic;
        relicOfferAvailable[msg.sender] = false;

        uint256 currentMaxHp = _maxHp(msg.sender);
        uint256 bonus = RelicRules.maxHpBonus(uint8(relic));
        uint256 penalty = RelicRules.maxHpPenalty(uint8(relic));
        uint256 newMaxHp = currentMaxHp + bonus;

        if (penalty >= newMaxHp - RELIC_MIN_MAX_HP) {
            newMaxHp = RELIC_MIN_MAX_HP;
        } else {
            newMaxHp -= penalty;
        }

        if (newMaxHp != currentMaxHp) {
            playerMaxHp[msg.sender] = newMaxHp;
            if (bonus > 0) {
                uint256 newHp = player.hp + bonus;
                player.hp = newHp > newMaxHp ? newMaxHp : newHp;
            } else if (player.hp > newMaxHp) {
                player.hp = newMaxHp;
            }
        }

        emit RelicChosen(msg.sender, relic, rarity, _maxHp(msg.sender));
    }

    function maxHp(address playerAddress) external view returns (uint256) {
        return _maxHp(playerAddress);
    }

    function playerCriticalChance(address playerAddress) external view returns (uint256) {
        return _criticalChance(playerAddress);
    }

'''
text = text[:old_relic_block_start] + new_relic_block + text[old_relic_block_end:]

replace_once(
'''        if (critical) {
            rolledDamage *= 2;
        }
''',
'''        if (critical) {
            rolledDamage *= RelicRules.criticalMultiplier(uint8(equippedRelic[playerAddress]));
        }
''')

text = text.replace(
    '_rollMonsterDamage(player, randomNumbers[2])',
    '_rollMonsterDamage(playerAddress, player, randomNumbers[2])',
)
text = text.replace(
    '_rollMonsterDamage(player, randomNumbers[1])',
    '_rollMonsterDamage(playerAddress, player, randomNumbers[1])',
)
text = text.replace(
    '_rollMonsterDamage(player, randomNumber)',
    '_rollMonsterDamage(playerAddress, player, randomNumber)',
)
text = text.replace('_takeDamage(player, monsterDamage);', '_takeDamage(playerAddress, player, monsterDamage);')

replace_once(
'''        if (player.hp == 0) {
            player.active = false;
        }
''',
'''        if (player.hp == 0) {
            _handleLethalDamage(playerAddress, player);
        }
''')

replace_once(
'''        player.gold += _scaledGoldReward(player.monsterType, room);
        player.roomsCleared += 1;

        _grantLoot(playerAddress, player, lootRoll, amountRoll);

        if (player.roomsCleared == RELIC_OFFER_ROOM && equippedRelic[playerAddress] == Relic.None) {
            relicOfferAvailable[playerAddress] = true;
            emit RelicOffered(playerAddress, player.roomsCleared);
        }
''',
'''        uint256 roomGold = _scaledGoldReward(player.monsterType, room);
        player.gold += RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), roomGold);
        player.roomsCleared += 1;

        _grantLoot(playerAddress, player, lootRoll, amountRoll);
        _applyKillRelic(playerAddress, player);

        if (player.roomsCleared == RELIC_OFFER_ROOM && equippedRelic[playerAddress] == Relic.None) {
            RelicRarity rarity = RelicRarity(RelicRules.rollRarity(amountRoll));
            relicOfferRarity[playerAddress] = rarity;
            relicOfferAvailable[playerAddress] = true;
            emit RelicOfferRolled(playerAddress, rarity);
            emit RelicOffered(playerAddress, player.roomsCleared);
        }
''')

replace_once(
'''                player.gold += FULL_POTION_LOOT_GOLD;
                player.lastLootType = LootType.BonusGold;
                player.lastLootAmount = FULL_POTION_LOOT_GOLD;
''',
'''                uint256 convertedGold =
                    RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), FULL_POTION_LOOT_GOLD);
                player.gold += convertedGold;
                player.lastLootType = LootType.BonusGold;
                player.lastLootAmount = convertedGold;
''')

replace_once(
'''            player.gold += bonusGold;
            player.lastLootType = LootType.BonusGold;
            player.lastLootAmount = bonusGold;
''',
'''            bonusGold = RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), bonusGold);
            player.gold += bonusGold;
            player.lastLootType = LootType.BonusGold;
            player.lastLootAmount = bonusGold;
''')

relic_internal_start = text.index('    /*\n        ========================================================\n        RELIC INTERNAL')
relic_internal_end = text.index('    /*\n        ========================================================\n        SUPPLY COSTS', relic_internal_start)
new_relic_internal = '''    /*
        ========================================================
        RELIC INTERNAL
        ========================================================
    */

    function _maxHp(address playerAddress) internal view returns (uint256) {
        uint256 configuredMaxHp = playerMaxHp[playerAddress];
        return configuredMaxHp == 0 ? BASE_MAX_HP : configuredMaxHp;
    }

    function _criticalChance(address playerAddress) internal view returns (uint256) {
        return BASE_CRITICAL_CHANCE + RelicRules.criticalChanceBonus(uint8(equippedRelic[playerAddress]));
    }

    function _applyOutgoingRelicDamage(address playerAddress, uint256 damage, bool storm)
        internal
        view
        returns (uint256)
    {
        return RelicRules.scaleOutgoing(uint8(equippedRelic[playerAddress]), damage, storm);
    }

    function _applyRoomEntryRelic(address playerAddress, Player storage player) internal {
        uint256 hpLoss = RelicRules.roomMaxHpLoss(uint8(equippedRelic[playerAddress]));
        if (hpLoss == 0) return;

        uint256 currentMaxHp = _maxHp(playerAddress);
        if (currentMaxHp <= RELIC_MIN_MAX_HP) return;

        uint256 newMaxHp = currentMaxHp <= RELIC_MIN_MAX_HP + hpLoss
            ? RELIC_MIN_MAX_HP
            : currentMaxHp - hpLoss;

        playerMaxHp[playerAddress] = newMaxHp;
        if (player.hp > newMaxHp) player.hp = newMaxHp;

        emit BloodPricePaid(playerAddress, newMaxHp, player.hp);
    }

    function _applyKillRelic(address playerAddress, Player storage player) internal {
        uint256 healing = RelicRules.killHeal(uint8(equippedRelic[playerAddress]));
        if (healing == 0 || player.hp == 0) return;

        uint256 maximumHp = _maxHp(playerAddress);
        uint256 newHp = player.hp + healing;
        player.hp = newHp > maximumHp ? maximumHp : newHp;
    }

    function _handleLethalDamage(address playerAddress, Player storage player) internal {
        uint8 revive = RelicRules.revivePercent(uint8(equippedRelic[playerAddress]));
        if (revive == 0 || relicReviveUsed[playerAddress]) {
            player.active = false;
            return;
        }

        relicReviveUsed[playerAddress] = true;
        uint256 restoredHp = (_maxHp(playerAddress) * revive) / 100;
        player.hp = restoredHp == 0 ? 1 : restoredHp;
        player.active = true;
        emit RelicRevived(playerAddress, equippedRelic[playerAddress], player.hp);
    }

'''
text = text[:relic_internal_start] + new_relic_internal + text[relic_internal_end:]

replace_once(
'''    function _rollMonsterDamage(Player storage player, uint256 randomNumber) internal view returns (uint256) {
        uint256 room = player.roomsCleared + 1;
        uint256 baseDamage = _scaledMonsterDamage(player.monsterType, room);
        uint256 rawDamage = (baseDamage - 1) + (randomNumber % 3);

        return _applyArmor(player, rawDamage);
    }
''',
'''    function _rollMonsterDamage(address playerAddress, Player storage player, uint256 randomNumber)
        internal
        view
        returns (uint256)
    {
        uint256 room = player.roomsCleared + 1;
        uint256 baseDamage = _scaledMonsterDamage(player.monsterType, room);
        uint256 rawDamage = (baseDamage - 1) + (randomNumber % 3);
        uint256 armoredDamage = _applyArmor(player, rawDamage);

        return RelicRules.scaleIncoming(uint8(equippedRelic[playerAddress]), armoredDamage);
    }
''')

replace_once(
'''    function _takeDamage(Player storage player, uint256 damage) internal {
        if (player.hp <= damage) {
            player.hp = 0;
            player.active = false;
        } else {
            player.hp -= damage;
        }
    }
''',
'''    function _takeDamage(address playerAddress, Player storage player, uint256 damage) internal {
        if (player.hp <= damage) {
            player.hp = 0;
            _handleLethalDamage(playerAddress, player);
        } else {
            player.hp -= damage;
        }
    }
''')

replace_once(
'''        snapshot.supplyOpen = _supplyAvailable(playerAddress);
        snapshot.bandageUsed = supplyBandageUsed[playerAddress];
        snapshot.supplyPotionPurchases = supplyPotionsBought[playerAddress];
''',
'''        snapshot.supplyOpen = _supplyAvailable(playerAddress);
        snapshot.bandageUsed = supplyBandageUsed[playerAddress];
        snapshot.supplyPotionPurchases = supplyPotionsBought[playerAddress];
        snapshot.equippedRelic = equippedRelic[playerAddress];
        snapshot.relicOfferAvailable = relicOfferAvailable[playerAddress];
        snapshot.relicOfferRarity = relicOfferRarity[playerAddress];
        snapshot.maxHp = _maxHp(playerAddress);
        snapshot.criticalChance = _criticalChance(playerAddress);
        snapshot.relicReviveUsed = relicReviveUsed[playerAddress];
''')

path.write_text(text)
print("Applied Relics V2 integration")
