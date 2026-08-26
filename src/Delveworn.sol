// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RelicRules} from "./RelicRules.sol";

interface IVRFCoordinator {
    function requestRandomNumbers(uint32 numNumbers, uint256 seed) external returns (uint256 requestId);
}

interface IVRFConsumer {
    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external;
}

contract Delveworn is IVRFConsumer {
    enum MonsterType {
        Zombie,
        Goblin,
        Orc,
        DungeonLord
    }

    enum LootType {
        None,
        Potion,
        BonusGold,
        Weapon,
        Armor
    }

    enum RequestKind {
        None,
        Monster,
        Attack,
        Storm,
        Potion
    }

    enum CampItem {
        Rest,
        Potion,
        Weapon,
        Armor
    }

    enum SupplyItem {
        Bandage,
        Potion
    }

    enum Relic {
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

    struct Player {
        uint256 hp;
        uint256 monsterHp;
        uint256 monsterMaxHp;
        uint256 roomsCleared;
        uint256 gold;
        uint256 potions;
        uint256 weaponLevel;
        uint256 armorLevel;
        MonsterType monsterType;
        LootType lastLootType;
        uint256 lastLootAmount;
        bool hasStarted;
        bool active;
    }

    struct RequestInfo {
        address player;
        RequestKind kind;
        uint32 expectedNumbers;
    }

    /*
        Snapshot encoded into the VRF completion event.

        The field order intentionally mirrors the frontend's
        PlayerState shape: players() first, then combatSnapshot().
        This lets the UI update immediately from the Shred event
        without waiting for canonical eth_call state to catch up.
    */
    struct FrontendSnapshot {
        uint256 hp;
        uint256 monsterHp;
        uint256 monsterMaxHp;
        uint256 roomsCleared;
        uint256 gold;
        uint256 potions;
        uint256 weaponLevel;
        uint256 armorLevel;
        MonsterType monsterType;
        LootType lastLootType;
        uint256 lastLootAmount;
        bool hasStarted;
        bool active;
        uint256 attackMin;
        uint256 attackMax;
        uint256 monsterMin;
        uint256 monsterMax;
        uint256 requestId;
        RequestKind requestKind;
        uint256 playerDamage;
        uint256 monsterDamage;
        bool critical;
        bool campOpen;
        bool restUsed;
        uint256 campPotionPurchases;
        uint256 combatPotionUses;
        bool supplyOpen;
        bool bandageUsed;
        uint256 supplyPotionPurchases;
        Relic equippedRelic;
        bool relicOfferAvailable;
        RelicRarity relicOfferRarity;
        uint256 maxHp;
        uint256 criticalChance;
        bool relicReviveUsed;
    }

    struct FrontendSnapshotV3 {
        FrontendSnapshot base;
        Relic relicOffer;
        uint16 ownedRelicsMask;
        uint16[15] relicCounts;
        uint256 baseMaxHp;
        uint256 stormMax;
    }

    /*
        ========================================================
        BALANCE
        ========================================================
    */

    uint256 public constant STARTING_POTIONS = 3;
    uint256 public constant MAX_POTIONS = 5;

    uint256 public constant NORMAL_COMBAT_POTION_LIMIT = 2;
    uint256 public constant BOSS_COMBAT_POTION_LIMIT = 3;

    uint256 public constant FULL_POTION_LOOT_GOLD = 10;
    uint256 public constant MAX_ARMOR_REDUCTION_PERCENT = 50;

    uint256 public constant CAMP_ARRIVAL_HEAL = 15;
    uint256 public constant REST_HEAL = 30;
    uint256 public constant CAMP_POTION_STOCK = 2;

    uint256 public constant BASE_REST_COST = 25;
    uint256 public constant BASE_POTION_COST = 20;
    uint256 public constant BASE_WEAPON_COST = 60;
    uint256 public constant BASE_ARMOR_COST = 60;

    uint256 public constant REST_COST_STEP = 5;
    uint256 public constant POTION_COST_STEP = 5;
    uint256 public constant WEAPON_COST_STEP = 20;
    uint256 public constant ARMOR_COST_STEP = 20;

    uint256 public constant SUPPLY_BANDAGE_HEAL = 25;
    uint256 public constant SUPPLY_POTION_STOCK = 2;

    uint256 public constant BASE_SUPPLY_BANDAGE_COST = 20;
    uint256 public constant BASE_SUPPLY_POTION_COST = 25;
    uint256 public constant SUPPLY_COST_STEP = 5;

    uint256 public constant VRF_TIMEOUT = 30 seconds;

    /*
        Relics V2

        Relics are run-only and occupy one active slot. Every defeated boss
        drops one randomly selected relic. The player always owns the drop,
        including duplicates, and decides whether to equip it or keep the
        currently active relic.

        Rarity odds:
        Common 55%, Uncommon 25%, Rare 12%, Epic 6%, Legendary 2%.

        The full catalog and numeric modifiers live in RelicRules.sol.
        Common retains the calibrated V1 identities; higher tiers become
        progressively more run-defining while preserving explicit tradeoffs.
    */
    uint256 public constant BASE_MAX_HP = 100;
    uint256 public constant RELIC_MIN_MAX_HP = 20;
    uint256 public constant BASE_CRITICAL_CHANCE = 15;

    /*
        ========================================================
        CORE STATE
        ========================================================
    */

    IVRFCoordinator public immutable coordinator;

    mapping(address => Player) public players;

    mapping(address => uint256) public pendingRequestId;
    mapping(address => RequestKind) public pendingRequestKind;
    mapping(address => uint256) public pendingRequestTimestamp;

    mapping(uint256 => RequestInfo) public requests;

    mapping(address => uint256) public lastPlayerDamage;
    mapping(address => uint256) public lastMonsterDamage;
    mapping(address => bool) public lastCritical;

    mapping(address => uint256) public combatPotionsUsed;

    mapping(address => bool) public campRestUsed;
    mapping(address => uint256) public campPotionsBought;

    mapping(address => bool) public supplyBandageUsed;
    mapping(address => uint256) public supplyPotionsBought;

    mapping(address => Relic) public equippedRelic;
    mapping(address => bool) public relicOfferAvailable;
    mapping(address => RelicRarity) public relicOfferRarity;
    mapping(address => Relic) public relicOfferId;
    mapping(address => uint16) public ownedRelicsMask;
    mapping(address => uint16[15]) internal relicDropCounts;
    mapping(address => uint256) public playerBaseMaxHp;
    mapping(address => uint256) public playerMaxHp;
    mapping(address => bool) public relicReviveUsed;

    uint256 public requestNonce;

    /*
        ========================================================
        EVENTS
        ========================================================
    */

    event RandomnessRequested(address indexed player, uint256 indexed requestId, RequestKind kind, uint32 numberCount);

    event RandomnessRetried(
        address indexed player, uint256 indexed oldRequestId, uint256 indexed newRequestId, RequestKind kind
    );

    event RandomnessFulfilled(address indexed player, uint256 indexed requestId, RequestKind kind);

    event MonsterSpawned(address indexed player, uint256 indexed room, MonsterType monsterType, uint256 hp);

    event CombatResolved(
        address indexed player,
        RequestKind action,
        uint256 playerDamage,
        uint256 monsterDamage,
        bool critical,
        bool monsterDefeated
    );

    event LootGranted(address indexed player, LootType lootType, uint256 amount);

    event CampOpened(address indexed player, uint256 indexed nextBossRoom, uint256 healingReceived);

    event CampPurchase(address indexed player, CampItem item, uint256 goldSpent);

    event SupplyStopOpened(address indexed player, uint256 indexed roomCleared);

    event SupplyPurchase(address indexed player, SupplyItem item, uint256 goldSpent);

    event RelicOffered(address indexed player, uint256 indexed roomCleared);

    event RelicOfferRolled(address indexed player, RelicRarity rarity);

    event RelicDropped(address indexed player, Relic relic, RelicRarity rarity, uint256 copyCount);

    event RelicClaimed(address indexed player, Relic relic, uint256 copyCount, bool equipped);

    event RelicEquipped(address indexed player, Relic previousRelic, Relic relic, uint256 maxHp);

    event RelicChosen(address indexed player, Relic relic, RelicRarity rarity, uint256 maxHp);

    event BloodPricePaid(address indexed player, uint256 newMaxHp, uint256 currentHp);

    event RelicRevived(address indexed player, Relic relic, uint256 hp);

    /*
        ========================================================
        CONSTRUCTOR
        ========================================================
    */

    constructor(address coordinatorAddress) {
        require(coordinatorAddress != address(0), "Invalid coordinator");

        coordinator = IVRFCoordinator(coordinatorAddress);
    }

    modifier onlyCoordinator() {
        require(msg.sender == address(coordinator), "Only VRF coordinator");

        _;
    }

    modifier noPending(address playerAddress) {
        require(pendingRequestId[playerAddress] == 0, "Randomness pending");

        _;
    }

    /*
        ========================================================
        RUN
        ========================================================
    */

    function startGame() external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(!player.active, "Run already active");

        player.hp = BASE_MAX_HP;
        player.monsterHp = 0;
        player.monsterMaxHp = 0;
        player.roomsCleared = 0;
        player.gold = 0;
        player.potions = STARTING_POTIONS;
        player.weaponLevel = 0;
        player.armorLevel = 0;

        player.monsterType = MonsterType.Zombie;

        player.lastLootType = LootType.None;
        player.lastLootAmount = 0;

        player.hasStarted = true;
        player.active = true;

        combatPotionsUsed[msg.sender] = 0;

        campRestUsed[msg.sender] = false;
        campPotionsBought[msg.sender] = 0;

        supplyBandageUsed[msg.sender] = false;
        supplyPotionsBought[msg.sender] = 0;

        lastPlayerDamage[msg.sender] = 0;
        lastMonsterDamage[msg.sender] = 0;
        lastCritical[msg.sender] = false;

        equippedRelic[msg.sender] = Relic.None;
        relicOfferAvailable[msg.sender] = false;
        relicOfferRarity[msg.sender] = RelicRarity.None;
        relicOfferId[msg.sender] = Relic.None;
        ownedRelicsMask[msg.sender] = 0;
        delete relicDropCounts[msg.sender];
        playerBaseMaxHp[msg.sender] = BASE_MAX_HP;
        playerMaxHp[msg.sender] = BASE_MAX_HP;
        relicReviveUsed[msg.sender] = false;

        _requestRandomness(msg.sender, RequestKind.Monster, 1);
    }

    /*
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

    function ownsRelic(address playerAddress, Relic relic) public view returns (bool) {
        if (relic == Relic.None || uint256(relic) > uint256(Relic.Worldbreaker)) return false;
        uint16 bit = uint16(1) << (uint8(relic) - 1);
        return ownedRelicsMask[playerAddress] & bit != 0;
    }

    function chooseRelic(Relic relic) external noPending(msg.sender) {
        require(relic == relicOfferId[msg.sender], "Relic not in offer");
        _claimRelic(msg.sender, true);
    }

    function claimRelic(bool equip) external noPending(msg.sender) {
        _claimRelic(msg.sender, equip);
    }

    function equipOwnedRelic(Relic relic) external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(player.active, "Game is not active");
        require(player.monsterHp == 0, "Equip relic between rooms");
        require(!relicOfferAvailable[msg.sender], "Claim boss relic first");
        require(
            relic == Relic.None || (uint256(relic) <= uint256(Relic.Worldbreaker) && ownsRelic(msg.sender, relic)),
            "Relic not owned"
        );

        _equipRelic(msg.sender, relic, false);
    }

    function maxHp(address playerAddress) external view returns (uint256) {
        return _maxHp(playerAddress);
    }

    function playerCriticalChance(address playerAddress) external view returns (uint256) {
        return _criticalChance(playerAddress);
    }

    /*
        ========================================================
        GAME ACTIONS
        ========================================================
    */

    function attack() external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(player.active, "Game is not active");
        require(player.monsterHp > 0, "No monster");

        _requestRandomness(msg.sender, RequestKind.Attack, 5);
    }

    function stormAttack() external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(player.active, "Game is not active");
        require(player.monsterHp > 0, "No monster");

        _requestRandomness(msg.sender, RequestKind.Storm, 4);
    }

    function usePotion() external noPending(msg.sender) {
        Player storage player = players[msg.sender];
        uint256 maximumHp = _maxHp(msg.sender);

        require(player.active, "Game is not active");
        require(player.potions > 0, "No potions left");
        require(player.hp < maximumHp, "HP already full");

        if (player.monsterHp == 0) {
            player.potions -= 1;

            uint256 newHp = player.hp + 25;
            if (newHp > maximumHp) {
                newHp = maximumHp;
            }
            player.hp = newHp;

            lastPlayerDamage[msg.sender] = 0;
            lastMonsterDamage[msg.sender] = 0;
            lastCritical[msg.sender] = false;

            return;
        }

        uint256 limit = _combatPotionLimit(player);
        require(combatPotionsUsed[msg.sender] < limit, "Potion limit reached");

        _requestRandomness(msg.sender, RequestKind.Potion, 1);
    }

    function enterNextRoom() external noPending(msg.sender) {
        Player storage player = players[msg.sender];

        require(player.active, "Game over");
        require(player.monsterHp == 0, "Defeat monster first");
        require(!relicOfferAvailable[msg.sender], "Claim boss relic first");

        _applyRoomEntryRelic(msg.sender, player);
        _requestRandomness(msg.sender, RequestKind.Monster, 1);
    }

    function retryRandomness() external returns (uint256 newRequestId) {
        uint256 oldRequestId = pendingRequestId[msg.sender];

        require(oldRequestId != 0, "No pending randomness");

        uint256 requestedAt = pendingRequestTimestamp[msg.sender];
        require(requestedAt != 0, "Missing request timestamp");
        require(block.timestamp >= requestedAt + VRF_TIMEOUT, "VRF request not timed out");

        RequestInfo memory oldRequest = requests[oldRequestId];

        require(oldRequest.player == msg.sender, "Request mismatch");
        require(oldRequest.kind != RequestKind.None, "Invalid request kind");

        delete requests[oldRequestId];

        pendingRequestId[msg.sender] = 0;
        pendingRequestKind[msg.sender] = RequestKind.None;
        pendingRequestTimestamp[msg.sender] = 0;

        _requestRandomness(msg.sender, oldRequest.kind, oldRequest.expectedNumbers);

        newRequestId = pendingRequestId[msg.sender];

        emit RandomnessRetried(msg.sender, oldRequestId, newRequestId, oldRequest.kind);
    }

    /*
        ========================================================
        SUPPLY STOP
        ========================================================
    */

    function supplyAvailable(address playerAddress) public view returns (bool) {
        return _supplyAvailable(playerAddress);
    }

    function supplyBuyBandage() external noPending(msg.sender) {
        require(_supplyAvailable(msg.sender), "Supply stop not available");
        require(!supplyBandageUsed[msg.sender], "Bandage already used");

        Player storage player = players[msg.sender];
        uint256 maximumHp = _maxHp(msg.sender);

        require(player.hp < maximumHp, "HP already full");

        uint256 cost = _currentSupplyBandageCost(player);
        _spendGold(player, cost);

        supplyBandageUsed[msg.sender] = true;

        uint256 newHp = player.hp + SUPPLY_BANDAGE_HEAL;
        if (newHp > maximumHp) {
            newHp = maximumHp;
        }
        player.hp = newHp;

        emit SupplyPurchase(msg.sender, SupplyItem.Bandage, cost);
    }

    function supplyBuyPotion() external noPending(msg.sender) {
        require(_supplyAvailable(msg.sender), "Supply stop not available");
        require(supplyPotionsBought[msg.sender] < SUPPLY_POTION_STOCK, "Supply potion stock empty");

        Player storage player = players[msg.sender];

        require(player.potions < MAX_POTIONS, "Potion inventory full");

        uint256 cost = _currentSupplyPotionCost(player);
        _spendGold(player, cost);

        player.potions += 1;
        supplyPotionsBought[msg.sender] += 1;

        emit SupplyPurchase(msg.sender, SupplyItem.Potion, cost);
    }

    /*
        ========================================================
        BOSS CAMP
        ========================================================
    */

    function campAvailable(address playerAddress) public view returns (bool) {
        return _campAvailable(playerAddress);
    }

    function campRest() external noPending(msg.sender) {
        require(_campAvailable(msg.sender), "Camp not available");
        require(!campRestUsed[msg.sender], "Rest already used");

        Player storage player = players[msg.sender];
        uint256 maximumHp = _maxHp(msg.sender);

        require(player.hp < maximumHp, "HP already full");

        uint256 cost = _currentRestCost(player);
        _spendGold(player, cost);

        campRestUsed[msg.sender] = true;

        uint256 newHp = player.hp + REST_HEAL;
        if (newHp > maximumHp) {
            newHp = maximumHp;
        }
        player.hp = newHp;

        emit CampPurchase(msg.sender, CampItem.Rest, cost);
    }

    function campBuyPotion() external noPending(msg.sender) {
        require(_campAvailable(msg.sender), "Camp not available");
        require(campPotionsBought[msg.sender] < CAMP_POTION_STOCK, "Camp potion stock empty");

        Player storage player = players[msg.sender];

        require(player.potions < MAX_POTIONS, "Potion inventory full");

        uint256 cost = _currentPotionCost(player);
        _spendGold(player, cost);

        player.potions += 1;
        campPotionsBought[msg.sender] += 1;

        emit CampPurchase(msg.sender, CampItem.Potion, cost);
    }

    function campBuyWeapon() external noPending(msg.sender) {
        require(_campAvailable(msg.sender), "Camp not available");

        Player storage player = players[msg.sender];
        uint256 cost = _currentWeaponCost(player);

        _spendGold(player, cost);
        player.weaponLevel += 1;

        emit CampPurchase(msg.sender, CampItem.Weapon, cost);
    }

    function campBuyArmor() external noPending(msg.sender) {
        require(_campAvailable(msg.sender), "Camp not available");

        Player storage player = players[msg.sender];
        uint256 cost = _currentArmorCost(player);

        _spendGold(player, cost);
        player.armorLevel += 1;

        emit CampPurchase(msg.sender, CampItem.Armor, cost);
    }

    /*
        ========================================================
        VRF CALLBACK
        ========================================================
    */

    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers)
        external
        override
        onlyCoordinator
    {
        RequestInfo memory request = requests[requestId];

        require(request.player != address(0), "Unknown VRF request");
        require(pendingRequestId[request.player] == requestId, "Request mismatch");
        require(randomNumbers.length == request.expectedNumbers, "Wrong random number count");

        delete requests[requestId];

        pendingRequestId[request.player] = 0;
        pendingRequestKind[request.player] = RequestKind.None;
        pendingRequestTimestamp[request.player] = 0;

        Player storage player = players[request.player];

        if (request.kind == RequestKind.Monster) {
            _resolveMonster(request.player, player, randomNumbers[0]);
            _emitRandomnessFulfilled(requestId, request);
            return;
        }

        if (request.kind == RequestKind.Attack) {
            _resolveAttack(request.player, player, randomNumbers);
            _emitRandomnessFulfilled(requestId, request);
            return;
        }

        if (request.kind == RequestKind.Storm) {
            _resolveStorm(request.player, player, randomNumbers);
            _emitRandomnessFulfilled(requestId, request);
            return;
        }

        if (request.kind == RequestKind.Potion) {
            _resolvePotion(request.player, player, randomNumbers[0]);
            _emitRandomnessFulfilled(requestId, request);
            return;
        }

        revert("Invalid request kind");
    }

    /*
        ========================================================
        VIEW HELPERS
        ========================================================
    */

    function getPlayer(address playerAddress) external view returns (Player memory) {
        return players[playerAddress];
    }

    function frontendSnapshot(address playerAddress) external view returns (FrontendSnapshot memory) {
        Player storage player = players[playerAddress];
        return _frontendSnapshot(playerAddress, player);
    }

    function frontendSnapshotV3(address playerAddress) external view returns (FrontendSnapshotV3 memory snapshot) {
        Player storage player = players[playerAddress];
        snapshot.base = _frontendSnapshot(playerAddress, player);
        snapshot.relicOffer = relicOfferId[playerAddress];
        snapshot.ownedRelicsMask = ownedRelicsMask[playerAddress];
        snapshot.relicCounts = relicDropCounts[playerAddress];
        snapshot.baseMaxHp = _baseMaxHp(playerAddress);
        snapshot.stormMax = _applyOutgoingRelicDamage(playerAddress, _playerBaseDamage(player) * 2, true);
    }

    function playerAttackDamage(address playerAddress) external view returns (uint256) {
        uint256 baseDamage = _playerBaseDamage(players[playerAddress]);
        return _applyOutgoingRelicDamage(playerAddress, baseDamage, false);
    }

    function playerAttackRange(address playerAddress) external view returns (uint256 minDamage, uint256 maxDamage) {
        Player storage player = players[playerAddress];
        uint256 baseDamage = _playerBaseDamage(player);

        minDamage = _applyOutgoingRelicDamage(playerAddress, baseDamage - 2, false);
        maxDamage = _applyOutgoingRelicDamage(playerAddress, baseDamage + 2, false);
    }

    function stormAttackRange(address playerAddress) external view returns (uint256 minDamage, uint256 maxDamage) {
        Player storage player = players[playerAddress];

        minDamage = 0;
        maxDamage = _applyOutgoingRelicDamage(playerAddress, _playerBaseDamage(player) * 2, true);
    }

    function monsterDamageRange(address playerAddress) external view returns (uint256 minDamage, uint256 maxDamage) {
        Player storage player = players[playerAddress];
        uint256 room = player.roomsCleared + 1;
        uint256 baseDamage = _scaledMonsterDamage(player.monsterType, room);

        minDamage = _applyArmor(player, baseDamage - 1);
        maxDamage = _applyArmor(player, baseDamage + 1);
    }

    function combatSnapshot(address playerAddress)
        external
        view
        returns (
            uint256 attackMin,
            uint256 attackMax,
            uint256 monsterMin,
            uint256 monsterMax,
            uint256 requestId,
            RequestKind requestKind,
            uint256 playerDamage,
            uint256 monsterDamage,
            bool critical,
            bool campOpen,
            bool restUsed,
            uint256 campPotionPurchases,
            uint256 combatPotionUses,
            bool supplyOpen,
            bool bandageUsed,
            uint256 supplyPotionPurchases
        )
    {
        Player storage player = players[playerAddress];

        uint256 attackBase = _playerBaseDamage(player);
        attackMin = _applyOutgoingRelicDamage(playerAddress, attackBase - 2, false);
        attackMax = _applyOutgoingRelicDamage(playerAddress, attackBase + 2, false);

        uint256 room = player.roomsCleared + 1;
        uint256 monsterBase = _scaledMonsterDamage(player.monsterType, room);

        monsterMin = _applyArmor(player, monsterBase - 1);
        monsterMax = _applyArmor(player, monsterBase + 1);

        requestId = pendingRequestId[playerAddress];
        requestKind = pendingRequestKind[playerAddress];
        playerDamage = lastPlayerDamage[playerAddress];
        monsterDamage = lastMonsterDamage[playerAddress];
        critical = lastCritical[playerAddress];
        campOpen = _campAvailable(playerAddress);
        restUsed = campRestUsed[playerAddress];
        campPotionPurchases = campPotionsBought[playerAddress];
        combatPotionUses = combatPotionsUsed[playerAddress];
        supplyOpen = _supplyAvailable(playerAddress);
        bandageUsed = supplyBandageUsed[playerAddress];
        supplyPotionPurchases = supplyPotionsBought[playerAddress];
    }

    function monsterStatsForRoom(MonsterType monsterType, uint256 room)
        external
        pure
        returns (uint256 hp, uint256 minDamage, uint256 maxDamage, uint256 goldReward)
    {
        require(room > 0, "Invalid room");

        hp = _scaledMonsterHp(monsterType, room);

        uint256 baseDamage = _scaledMonsterDamage(monsterType, room);
        minDamage = baseDamage - 1;
        maxDamage = baseDamage + 1;
        goldReward = _scaledGoldReward(monsterType, room);
    }

    /*
        ========================================================
        PRICE PREVIEWS
        ========================================================
    */

    function shopPricesForBossRoom(uint256 bossRoom)
        public
        pure
        returns (uint256 restCost, uint256 potionCost, uint256 weaponCost, uint256 armorCost)
    {
        require(bossRoom > 0 && bossRoom % 10 == 0, "Invalid boss room");

        uint256 tier = (bossRoom / 10) - 1;

        restCost = BASE_REST_COST + (tier * REST_COST_STEP);
        potionCost = BASE_POTION_COST + (tier * POTION_COST_STEP);
        weaponCost = BASE_WEAPON_COST + (tier * WEAPON_COST_STEP);
        armorCost = BASE_ARMOR_COST + (tier * ARMOR_COST_STEP);
    }

    function supplyPricesForStop(uint256 roomCleared) public pure returns (uint256 bandageCost, uint256 potionCost) {
        require(roomCleared >= 5 && roomCleared % 5 == 0, "Invalid supply stop");

        uint256 tier = (roomCleared - 5) / 10;

        bandageCost = BASE_SUPPLY_BANDAGE_COST + (tier * SUPPLY_COST_STEP);
        potionCost = BASE_SUPPLY_POTION_COST + (tier * SUPPLY_COST_STEP);
    }

    function criticalChance() external pure returns (uint256) {
        return BASE_CRITICAL_CHANCE;
    }

    function randomnessPending(address playerAddress) external view returns (bool) {
        return pendingRequestId[playerAddress] != 0;
    }

    function randomnessRetryAvailable(address playerAddress) external view returns (bool) {
        uint256 requestId = pendingRequestId[playerAddress];
        uint256 requestedAt = pendingRequestTimestamp[playerAddress];

        return requestId != 0 && requestedAt != 0 && block.timestamp >= requestedAt + VRF_TIMEOUT;
    }

    /*
        ========================================================
        FRONTEND / VRF SNAPSHOT
        ========================================================
    */

    function _emitRandomnessFulfilled(uint256 requestId, RequestInfo memory request) internal {
        emit RandomnessFulfilled(request.player, requestId, request.kind);
    }

    function _frontendSnapshot(address playerAddress, Player storage player)
        internal
        view
        returns (FrontendSnapshot memory snapshot)
    {
        snapshot.hp = player.hp;
        snapshot.monsterHp = player.monsterHp;
        snapshot.monsterMaxHp = player.monsterMaxHp;
        snapshot.roomsCleared = player.roomsCleared;
        snapshot.gold = player.gold;
        snapshot.potions = player.potions;
        snapshot.weaponLevel = player.weaponLevel;
        snapshot.armorLevel = player.armorLevel;
        snapshot.monsterType = player.monsterType;
        snapshot.lastLootType = player.lastLootType;
        snapshot.lastLootAmount = player.lastLootAmount;
        snapshot.hasStarted = player.hasStarted;
        snapshot.active = player.active;

        uint256 attackBase = _playerBaseDamage(player);
        snapshot.attackMin = _applyOutgoingRelicDamage(playerAddress, attackBase - 2, false);
        snapshot.attackMax = _applyOutgoingRelicDamage(playerAddress, attackBase + 2, false);

        uint256 room = player.roomsCleared + 1;
        uint256 monsterBase = _scaledMonsterDamage(player.monsterType, room);

        snapshot.monsterMin = _applyArmor(player, monsterBase - 1);
        snapshot.monsterMax = _applyArmor(player, monsterBase + 1);
        snapshot.requestId = pendingRequestId[playerAddress];
        snapshot.requestKind = pendingRequestKind[playerAddress];
        snapshot.playerDamage = lastPlayerDamage[playerAddress];
        snapshot.monsterDamage = lastMonsterDamage[playerAddress];
        snapshot.critical = lastCritical[playerAddress];
        snapshot.campOpen = _campAvailable(playerAddress);
        snapshot.restUsed = campRestUsed[playerAddress];
        snapshot.campPotionPurchases = campPotionsBought[playerAddress];
        snapshot.combatPotionUses = combatPotionsUsed[playerAddress];
        snapshot.supplyOpen = _supplyAvailable(playerAddress);
        snapshot.bandageUsed = supplyBandageUsed[playerAddress];
        snapshot.supplyPotionPurchases = supplyPotionsBought[playerAddress];
        snapshot.equippedRelic = equippedRelic[playerAddress];
        snapshot.relicOfferAvailable = relicOfferAvailable[playerAddress];
        snapshot.relicOfferRarity = relicOfferRarity[playerAddress];
        snapshot.maxHp = _maxHp(playerAddress);
        snapshot.criticalChance = _criticalChance(playerAddress);
        snapshot.relicReviveUsed = relicReviveUsed[playerAddress];
    }

    /*
        ========================================================
        RANDOMNESS REQUEST
        ========================================================
    */

    function _requestRandomness(address playerAddress, RequestKind kind, uint32 numberCount) internal {
        require(pendingRequestId[playerAddress] == 0, "Randomness already pending");

        uint256 seed = uint256(
            keccak256(abi.encode(playerAddress, players[playerAddress].roomsCleared, uint8(kind), requestNonce))
        );

        requestNonce += 1;

        uint256 requestId = coordinator.requestRandomNumbers(numberCount, seed);
        require(requestId != 0, "Invalid request id");

        requests[requestId] = RequestInfo({player: playerAddress, kind: kind, expectedNumbers: numberCount});

        pendingRequestId[playerAddress] = requestId;
        pendingRequestKind[playerAddress] = kind;
        pendingRequestTimestamp[playerAddress] = block.timestamp;

        emit RandomnessRequested(playerAddress, requestId, kind, numberCount);
    }

    /*
        ========================================================
        MONSTER SPAWN
        ========================================================
    */

    function _resolveMonster(address playerAddress, Player storage player, uint256 randomNumber) internal {
        require(player.active, "Game is not active");

        uint256 room = player.roomsCleared + 1;

        if (room % 10 == 0) {
            player.monsterType = MonsterType.DungeonLord;
        } else {
            uint256 roll = randomNumber % 100;

            if (roll < 45) {
                player.monsterType = MonsterType.Zombie;
            } else if (roll < 80) {
                player.monsterType = MonsterType.Goblin;
            } else {
                player.monsterType = MonsterType.Orc;
            }
        }

        uint256 hp = _scaledMonsterHp(player.monsterType, room);

        player.monsterHp = hp;
        player.monsterMaxHp = hp;

        combatPotionsUsed[playerAddress] = 0;
        lastPlayerDamage[playerAddress] = 0;
        lastMonsterDamage[playerAddress] = 0;
        lastCritical[playerAddress] = false;

        emit MonsterSpawned(playerAddress, room, player.monsterType, hp);
    }

    /*
        ========================================================
        ATTACK
        ========================================================
    */

    function _resolveAttack(address playerAddress, Player storage player, uint256[] memory randomNumbers) internal {
        require(player.active, "Game is not active");
        require(player.monsterHp > 0, "No monster");

        uint256 minDamage = _playerBaseDamage(player) - 2;
        uint256 rolledDamage = minDamage + (randomNumbers[0] % 5);

        bool critical = (randomNumbers[1] % 100) < _criticalChance(playerAddress);

        if (critical) {
            rolledDamage *= RelicRules.criticalMultiplier(uint8(equippedRelic[playerAddress]));
        }

        rolledDamage = _applyOutgoingRelicDamage(playerAddress, rolledDamage, false);

        uint256 actualDamage = rolledDamage;
        if (actualDamage > player.monsterHp) {
            actualDamage = player.monsterHp;
        }

        lastPlayerDamage[playerAddress] = actualDamage;
        lastCritical[playerAddress] = critical;

        if (player.monsterHp <= rolledDamage) {
            lastMonsterDamage[playerAddress] = 0;

            _defeatMonster(playerAddress, player, randomNumbers[3], randomNumbers[4]);

            emit CombatResolved(playerAddress, RequestKind.Attack, actualDamage, 0, critical, true);
            return;
        }

        player.monsterHp -= rolledDamage;

        uint256 monsterDamage = _rollMonsterDamage(playerAddress, player, randomNumbers[2]);
        lastMonsterDamage[playerAddress] = monsterDamage;

        _takeDamage(playerAddress, player, monsterDamage);

        emit CombatResolved(playerAddress, RequestKind.Attack, actualDamage, monsterDamage, critical, false);
    }

    /*
        ========================================================
        STORM ATTACK
        ========================================================
    */

    function _resolveStorm(address playerAddress, Player storage player, uint256[] memory randomNumbers) internal {
        require(player.active, "Game is not active");
        require(player.monsterHp > 0, "No monster");

        uint256 maxDamage = _playerBaseDamage(player) * 2;
        uint256 rolledDamage = randomNumbers[0] % (maxDamage + 1);
        rolledDamage = _applyOutgoingRelicDamage(playerAddress, rolledDamage, true);

        uint256 actualDamage = rolledDamage;
        if (actualDamage > player.monsterHp) {
            actualDamage = player.monsterHp;
        }

        lastPlayerDamage[playerAddress] = actualDamage;
        lastCritical[playerAddress] = false;

        if (player.monsterHp <= rolledDamage) {
            lastMonsterDamage[playerAddress] = 0;

            _defeatMonster(playerAddress, player, randomNumbers[2], randomNumbers[3]);

            emit CombatResolved(playerAddress, RequestKind.Storm, actualDamage, 0, false, true);
            return;
        }

        player.monsterHp -= rolledDamage;

        uint256 monsterDamage = _rollMonsterDamage(playerAddress, player, randomNumbers[1]);
        lastMonsterDamage[playerAddress] = monsterDamage;

        _takeDamage(playerAddress, player, monsterDamage);

        emit CombatResolved(playerAddress, RequestKind.Storm, actualDamage, monsterDamage, false, false);
    }

    /*
        ========================================================
        POTION
        ========================================================
    */

    function _resolvePotion(address playerAddress, Player storage player, uint256 randomNumber) internal {
        require(player.active, "Game is not active");
        require(player.potions > 0, "No potions left");

        uint256 maximumHp = _maxHp(playerAddress);
        require(player.hp < maximumHp, "HP already full");

        uint256 limit = _combatPotionLimit(player);
        require(combatPotionsUsed[playerAddress] < limit, "Potion limit reached");

        combatPotionsUsed[playerAddress] += 1;
        player.potions -= 1;

        uint256 monsterDamage = _rollMonsterDamage(playerAddress, player, randomNumber);
        uint256 incomingDamage = (monsterDamage + 1) / 2;

        uint256 newHp = player.hp + 25;

        if (newHp > incomingDamage) {
            newHp -= incomingDamage;
        } else {
            newHp = 0;
        }

        if (newHp > maximumHp) {
            newHp = maximumHp;
        }

        player.hp = newHp;

        lastPlayerDamage[playerAddress] = 0;
        lastMonsterDamage[playerAddress] = incomingDamage;
        lastCritical[playerAddress] = false;

        if (player.hp == 0) {
            _handleLethalDamage(playerAddress, player);
        }

        emit CombatResolved(playerAddress, RequestKind.Potion, 0, incomingDamage, false, false);
    }

    /*
        ========================================================
        MONSTER DEFEAT
        ========================================================
    */

    function _defeatMonster(address playerAddress, Player storage player, uint256 lootRoll, uint256 amountRoll)
        internal
    {
        uint256 room = player.roomsCleared + 1;

        player.monsterHp = 0;
        uint256 roomGold = _scaledGoldReward(player.monsterType, room);
        player.gold += RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), roomGold);
        player.roomsCleared += 1;

        _grantLoot(playerAddress, player, lootRoll, amountRoll);
        _applyKillRelic(playerAddress, player);

        if (player.monsterType == MonsterType.DungeonLord) {
            uint256 bossTier = room / 10;
            RelicRarity rarity = RelicRarity(RelicRules.rollRarityForBossTier(amountRoll, bossTier));
            Relic relic = Relic(RelicRules.rollRelic(uint8(rarity), amountRoll / 10_000));
            relicOfferRarity[playerAddress] = rarity;
            relicOfferId[playerAddress] = relic;
            relicOfferAvailable[playerAddress] = true;
            emit RelicOfferRolled(playerAddress, rarity);
            emit RelicDropped(
                playerAddress, relic, rarity, uint256(relicDropCounts[playerAddress][uint8(relic) - 1]) + 1
            );
            emit RelicOffered(playerAddress, player.roomsCleared);
        }

        if (player.roomsCleared % 5 == 0) {
            _openSupplyStop(playerAddress, player);
        }

        if (player.roomsCleared % 10 == 9) {
            _openCamp(playerAddress, player);
        }
    }

    /*
        ========================================================
        SUPPLY STOP INTERNAL
        ========================================================
    */

    function _openSupplyStop(address playerAddress, Player storage player) internal {
        supplyBandageUsed[playerAddress] = false;
        supplyPotionsBought[playerAddress] = 0;

        emit SupplyStopOpened(playerAddress, player.roomsCleared);
    }

    function _supplyAvailable(address playerAddress) internal view returns (bool) {
        Player storage player = players[playerAddress];

        return player.hasStarted && player.active && player.monsterHp == 0 && player.roomsCleared >= 5
            && (player.roomsCleared % 5) == 0 && pendingRequestId[playerAddress] == 0
            && !relicOfferAvailable[playerAddress];
    }

    /*
        ========================================================
        CAMP INTERNAL
        ========================================================
    */

    function _openCamp(address playerAddress, Player storage player) internal {
        campRestUsed[playerAddress] = false;
        campPotionsBought[playerAddress] = 0;

        uint256 hpBefore = player.hp;
        uint256 newHp = player.hp + CAMP_ARRIVAL_HEAL;
        uint256 maximumHp = _maxHp(playerAddress);

        if (newHp > maximumHp) {
            newHp = maximumHp;
        }

        player.hp = newHp;

        emit CampOpened(playerAddress, player.roomsCleared + 1, newHp - hpBefore);
    }

    function _campAvailable(address playerAddress) internal view returns (bool) {
        Player storage player = players[playerAddress];

        return player.hasStarted && player.active && player.monsterHp == 0 && player.roomsCleared > 0
            && (player.roomsCleared % 10) == 9 && pendingRequestId[playerAddress] == 0;
    }

    /*
        ========================================================
        LOOT
        ========================================================
    */

    function _grantLoot(address playerAddress, Player storage player, uint256 randomLoot, uint256 randomAmount)
        internal
    {
        uint256 lootRoll = randomLoot % 100;

        if (lootRoll < 30) {
            if (player.potions >= MAX_POTIONS) {
                uint256 convertedGold = RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), FULL_POTION_LOOT_GOLD);
                player.gold += convertedGold;
                player.lastLootType = LootType.BonusGold;
                player.lastLootAmount = convertedGold;
            } else {
                player.potions += 1;
                player.lastLootType = LootType.Potion;
                player.lastLootAmount = 1;
            }
        } else if (lootRoll < 80) {
            uint256 bonusGold = 5 + (randomAmount % 16) + (player.roomsCleared / 5);

            bonusGold = RelicRules.scaleGold(uint8(equippedRelic[playerAddress]), bonusGold);
            player.gold += bonusGold;
            player.lastLootType = LootType.BonusGold;
            player.lastLootAmount = bonusGold;
        } else if (lootRoll < 90) {
            player.weaponLevel += 1;
            player.lastLootType = LootType.Weapon;
            player.lastLootAmount = 1;
        } else {
            player.armorLevel += 1;
            player.lastLootType = LootType.Armor;
            player.lastLootAmount = 1;
        }

        emit LootGranted(playerAddress, player.lastLootType, player.lastLootAmount);
    }

    /*
        ========================================================
        RELIC INTERNAL
        ========================================================
    */

    function _claimRelic(address playerAddress, bool equip) internal {
        Player storage player = players[playerAddress];

        require(player.active, "Game is not active");
        require(player.monsterHp == 0, "Claim relic between rooms");
        require(relicOfferAvailable[playerAddress], "No relic offer");

        Relic relic = relicOfferId[playerAddress];
        require(relic != Relic.None && uint256(relic) <= uint256(Relic.Worldbreaker), "Invalid relic offer");
        require(relicRarityOf(relic) == relicOfferRarity[playerAddress], "Relic offer mismatch");

        bool alreadyOwned = ownsRelic(playerAddress, relic);
        uint8 relicIndex = uint8(relic) - 1;
        uint16 newCount = relicDropCounts[playerAddress][relicIndex] + 1;
        relicDropCounts[playerAddress][relicIndex] = newCount;

        if (!alreadyOwned) {
            ownedRelicsMask[playerAddress] |= uint16(1) << relicIndex;
        }

        relicOfferAvailable[playerAddress] = false;
        relicOfferRarity[playerAddress] = RelicRarity.None;
        relicOfferId[playerAddress] = Relic.None;

        if (equip) {
            _equipRelic(playerAddress, relic, !alreadyOwned);
            emit RelicChosen(playerAddress, relic, relicRarityOf(relic), _maxHp(playerAddress));
        }

        emit RelicClaimed(playerAddress, relic, newCount, equip);
    }

    function _equipRelic(address playerAddress, Relic relic, bool healPositiveModifier) internal {
        Player storage player = players[playerAddress];
        Relic previousRelic = equippedRelic[playerAddress];
        uint256 newMaxHp = _maxHpForRelic(_baseMaxHp(playerAddress), relic);
        uint256 bonusHealing = healPositiveModifier ? RelicRules.maxHpBonus(uint8(relic)) : 0;

        equippedRelic[playerAddress] = relic;
        playerMaxHp[playerAddress] = newMaxHp;

        uint256 newHp = player.hp + bonusHealing;
        player.hp = newHp > newMaxHp ? newMaxHp : newHp;

        emit RelicEquipped(playerAddress, previousRelic, relic, newMaxHp);
    }

    function _baseMaxHp(address playerAddress) internal view returns (uint256) {
        uint256 configuredBaseMaxHp = playerBaseMaxHp[playerAddress];
        return configuredBaseMaxHp == 0 ? BASE_MAX_HP : configuredBaseMaxHp;
    }

    function _maxHpForRelic(uint256 baseMaxHp, Relic relic) internal pure returns (uint256) {
        uint256 bonus = RelicRules.maxHpBonus(uint8(relic));
        uint256 penalty = RelicRules.maxHpPenalty(uint8(relic));
        uint256 modifiedMaxHp = baseMaxHp + bonus;

        if (penalty >= modifiedMaxHp - RELIC_MIN_MAX_HP) return RELIC_MIN_MAX_HP;
        return modifiedMaxHp - penalty;
    }

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

        uint256 currentBaseMaxHp = _baseMaxHp(playerAddress);
        if (currentBaseMaxHp <= RELIC_MIN_MAX_HP) return;

        uint256 newBaseMaxHp =
            currentBaseMaxHp <= RELIC_MIN_MAX_HP + hpLoss ? RELIC_MIN_MAX_HP : currentBaseMaxHp - hpLoss;
        uint256 newMaxHp = _maxHpForRelic(newBaseMaxHp, equippedRelic[playerAddress]);

        playerBaseMaxHp[playerAddress] = newBaseMaxHp;
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

    /*
        ========================================================
        SUPPLY COSTS
        ========================================================
    */

    function _supplyPriceTier(Player storage player) internal view returns (uint256) {
        return (player.roomsCleared - 5) / 10;
    }

    function _currentSupplyBandageCost(Player storage player) internal view returns (uint256) {
        return BASE_SUPPLY_BANDAGE_COST + (_supplyPriceTier(player) * SUPPLY_COST_STEP);
    }

    function _currentSupplyPotionCost(Player storage player) internal view returns (uint256) {
        return BASE_SUPPLY_POTION_COST + (_supplyPriceTier(player) * SUPPLY_COST_STEP);
    }

    /*
        ========================================================
        CAMP COSTS
        ========================================================
    */

    function _campPriceTier(Player storage player) internal view returns (uint256) {
        uint256 bossRoom = player.roomsCleared + 1;
        return (bossRoom / 10) - 1;
    }

    function _currentRestCost(Player storage player) internal view returns (uint256) {
        return BASE_REST_COST + (_campPriceTier(player) * REST_COST_STEP);
    }

    function _currentPotionCost(Player storage player) internal view returns (uint256) {
        return BASE_POTION_COST + (_campPriceTier(player) * POTION_COST_STEP);
    }

    function _currentWeaponCost(Player storage player) internal view returns (uint256) {
        return BASE_WEAPON_COST + (_campPriceTier(player) * WEAPON_COST_STEP);
    }

    function _currentArmorCost(Player storage player) internal view returns (uint256) {
        return BASE_ARMOR_COST + (_campPriceTier(player) * ARMOR_COST_STEP);
    }

    function _spendGold(Player storage player, uint256 amount) internal {
        require(player.gold >= amount, "Not enough gold");
        player.gold -= amount;
    }

    /*
        ========================================================
        DAMAGE / SCALING
        ========================================================
    */

    function _playerBaseDamage(Player storage player) internal view returns (uint256) {
        return 10 + (player.weaponLevel * 2);
    }

    function _combatPotionLimit(Player storage player) internal view returns (uint256) {
        if (player.monsterType == MonsterType.DungeonLord) {
            return BOSS_COMBAT_POTION_LIMIT;
        }

        return NORMAL_COMBAT_POTION_LIMIT;
    }

    function _rollMonsterDamage(address playerAddress, Player storage player, uint256 randomNumber)
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

    function _scaledMonsterHp(MonsterType monsterType, uint256 room) internal pure returns (uint256) {
        uint256 baseHp = _monsterBaseHp(monsterType);
        return baseHp + (baseHp * (room - 1)) / 25;
    }

    function _scaledMonsterDamage(MonsterType monsterType, uint256 room) internal pure returns (uint256) {
        uint256 baseDamage = _monsterBaseDamage(monsterType);
        return baseDamage + ((room - 1) / 8);
    }

    function _scaledGoldReward(MonsterType monsterType, uint256 room) internal pure returns (uint256) {
        uint256 baseGold = _monsterBaseGold(monsterType);
        return baseGold + (baseGold * (room - 1)) / 20;
    }

    /*
        ========================================================
        V8.5 ARMOR
        ========================================================
    */

    function _applyArmor(Player storage player, uint256 damage) internal view returns (uint256) {
        uint256 flatReducedDamage;

        if (damage <= player.armorLevel) {
            flatReducedDamage = 1;
        } else {
            flatReducedDamage = damage - player.armorLevel;
        }

        uint256 minimumDamage = (damage + 1) / 2;

        if (flatReducedDamage < minimumDamage) {
            return minimumDamage;
        }

        return flatReducedDamage;
    }

    function _takeDamage(address playerAddress, Player storage player, uint256 damage) internal {
        if (player.hp <= damage) {
            player.hp = 0;
            _handleLethalDamage(playerAddress, player);
        } else {
            player.hp -= damage;
        }
    }

    /*
        ========================================================
        BASE MONSTER STATS
        ========================================================
    */

    function _monsterBaseHp(MonsterType monsterType) internal pure returns (uint256) {
        if (monsterType == MonsterType.Zombie) {
            return 30;
        }

        if (monsterType == MonsterType.Goblin) {
            return 40;
        }

        if (monsterType == MonsterType.Orc) {
            return 60;
        }

        return 90;
    }

    function _monsterBaseDamage(MonsterType monsterType) internal pure returns (uint256) {
        if (monsterType == MonsterType.Zombie) {
            return 5;
        }

        if (monsterType == MonsterType.Goblin) {
            return 7;
        }

        if (monsterType == MonsterType.Orc) {
            return 9;
        }

        return 12;
    }

    function _monsterBaseGold(MonsterType monsterType) internal pure returns (uint256) {
        if (monsterType == MonsterType.Zombie) {
            return 5;
        }

        if (monsterType == MonsterType.Goblin) {
            return 8;
        }

        if (monsterType == MonsterType.Orc) {
            return 12;
        }

        return 30;
    }
}
