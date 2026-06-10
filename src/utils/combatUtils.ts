import { Player, Enemy, DerivedStats, CharacterClass } from '../types';
import { ITEM_DATA } from '../data/items';

/**
 * Calculates randomized damage based on attack and defense.
 * Formula: (atk - def) * (0.9 to 1.1)
 */
export const calculateDamage = (atk: number, def: number): number => {
  const baseDamage = Math.max(1, atk - def);
  const variance = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  return Math.floor(baseDamage * variance);
};

/**
 * Calculates randomized damage for enemies.
 */
export const calculateEnemyDamage = (atk: number, def: number): number => {
  const baseDamage = Math.max(1, atk - def);
  const variance = 0.85 + Math.random() * 0.3; // 0.85 to 1.15 (enemies have slightly more variance)
  return Math.floor(baseDamage * variance);
};

export interface LineageRegen {
  hpRegen: number; // For 10s tick
  mpRegen: number; // For 10s tick
}

export const calculateLineageRegen = (player: Player): LineageRegen => {
  let hpRegen = 2;
  let mpRegen = 1;

  const stats = player.stats || { str: 10, dex: 10, int: 10, con: 10 };
  const con = stats.con || 10;
  const int = stats.int || 10;

  if (player.class === CharacterClass.KNIGHT) {
    hpRegen = 5 + Math.floor((con - 10) * 1.5) + Math.floor(player.level * 0.2);
    mpRegen = 1 + Math.floor((int - 10) * 0.2) + Math.floor(player.level * 0.05);
  } else if (player.class === CharacterClass.ELF) {
    hpRegen = 3 + Math.floor((con - 10) * 1.0) + Math.floor(player.level * 0.15);
    mpRegen = 2 + Math.floor((int - 10) * 0.6) + Math.floor(player.level * 0.1);
  } else { // MAGE
    hpRegen = 1 + Math.floor((con - 10) * 0.5) + Math.floor(player.level * 0.1);
    mpRegen = 4 + Math.floor((int - 10) * 1.5) + Math.floor(player.level * 0.2);
  }

  return {
    hpRegen: Math.max(1, isNaN(hpRegen) ? 2 : hpRegen),
    mpRegen: Math.max(1, isNaN(mpRegen) ? 1 : mpRegen),
  };
};

/**
 * Calculates derived stats for a player.
 */
export const calculateDerivedStats = (player: Player, activeBuffs: { id: string; remaining: number }[]): DerivedStats => {
  let bonusAtk = 0;
  let bonusDef = 0;
  let bonusHp = 0;
  let bonusMp = 0;
  let bonusStr = 0;
  let bonusDex = 0;
  let bonusInt = 0;
  let bonusCon = 0;
  let bonusAttackSpeed = 0;
  let bonusEvasion = 0;
  let bonusMagicAtk = 0;
  let bonusMagicDef = 0;

  // Defensive parsing for string properties
  let inventory: any[] = player.inventory;
  if (typeof inventory === 'string') {
    try { inventory = JSON.parse(inventory); } catch (e) { inventory = []; }
  }
  if (!Array.isArray(inventory)) inventory = [];

  let equipment: any = player.equipment;
  if (typeof equipment === 'string') {
    try { equipment = JSON.parse(equipment); } catch (e) { equipment = {}; }
  }
  if (!equipment) equipment = {};

  let stats: any = player.stats;
  if (typeof stats === 'string') {
    try { stats = JSON.parse(stats); } catch (e) { stats = { str: 10, dex: 10, int: 10, con: 10 }; }
  }
  if (!stats) stats = { str: 10, dex: 10, int: 10, con: 10 };

  Object.values(equipment).forEach(instanceId => {
    if (instanceId) {
      const instance = inventory.find(i => i.instanceId === instanceId);
      if (instance) {
        const item = ITEM_DATA.find(i => i.id === instance.id);
        if (item && item.stats) {
          const enhancementBonus = instance.enhancement * 1;
          bonusAtk += (item.stats.atk || 0) + (item.type === 'weapon' ? enhancementBonus : 0);
          bonusDef += (item.stats.def || 0) + (item.type === 'armor' || item.type === 'accessory' ? enhancementBonus : 0);
          bonusHp += item.stats.hp || 0;
          bonusMp += item.stats.mp || 0;
          bonusStr += item.stats.str || 0;
          bonusDex += item.stats.dex || 0;
          bonusInt += item.stats.int || 0;
          bonusCon += item.stats.con || 0;
          bonusMagicAtk += item.stats.mAtk || 0;
          bonusMagicDef += item.stats.mDef || 0;
        }
      }
    }
  });

  activeBuffs.forEach(buff => {
    if (buff.id === 'wind_walk') bonusAttackSpeed += 0.2;
    if (buff.id === 'haste_potion') bonusAttackSpeed += 0.5;
  });

  const totalStr = (stats.str || 0) + bonusStr;
  const totalDex = (stats.dex || 0) + bonusDex;
  const totalInt = (stats.int || 0) + bonusInt;
  const totalCon = (stats.con || 0) + bonusCon;

  let meleeAtk = 1;
  let rangedAtk = 1;
  let magicAtk = 1;
  let physDef = 1;
  let magicDef = 1;
  let maxHp = 30;
  let maxMp = 10;
  let attackSpeed = 0.5;
  let evasion = 0;

  const level = player.level;

  if (player.class === CharacterClass.KNIGHT) {
    meleeAtk = Math.floor(2 + level * 0.5 + totalStr * 0.6 + bonusAtk);
    rangedAtk = Math.floor(1 + level * 0.2 + totalDex * 0.3 + bonusAtk);
    magicAtk = Math.floor(totalInt * 0.3 + bonusMagicAtk);
    physDef = Math.floor(level * 0.3 + totalCon * 0.4 + bonusDef);
    magicDef = Math.floor(level * 0.2 + totalInt * 0.3 + bonusMagicDef);
    maxHp = Math.floor(25 + level * 13 + totalCon * 1.5 + bonusHp);
    maxMp = Math.floor(4 + level * 1 + totalInt * 0.2 + bonusMp);
    attackSpeed = 0.65 + bonusAttackSpeed;
    evasion = Math.floor(totalDex * 0.3 + level * 0.1 + bonusEvasion);
  } else if (player.class === CharacterClass.ELF) {
    meleeAtk = Math.floor(1 + level * 0.3 + totalStr * 0.5 + bonusAtk);
    rangedAtk = Math.floor(2 + level * 0.4 + totalDex * 0.6 + bonusAtk);
    magicAtk = Math.floor(totalInt * 0.6 + bonusMagicAtk);
    physDef = Math.floor(level * 0.2 + totalCon * 0.3 + totalDex * 0.1 + bonusDef);
    magicDef = Math.floor(level * 0.5 + totalInt * 0.5 + bonusMagicDef);
    maxHp = Math.floor(18 + level * 9 + totalCon * 1.2 + bonusHp);
    maxMp = Math.floor(10 + level * 2.5 + totalInt * 0.5 + bonusMp);
    attackSpeed = 0.60 + bonusAttackSpeed;
    evasion = Math.floor(totalDex * 0.8 + level * 0.2 + bonusEvasion);
  } else { // MAGE
    meleeAtk = Math.floor(1 + level * 0.2 + totalStr * 0.4 + bonusAtk);
    rangedAtk = Math.floor(1 + level * 0.2 + totalDex * 0.3 + bonusAtk);
    magicAtk = Math.floor(3 + level * 0.4 + totalInt * 1.0 + bonusMagicAtk);
    physDef = Math.floor(level * 0.1 + totalCon * 0.2 + bonusDef);
    magicDef = Math.floor(level * 0.8 + totalInt * 0.8 + bonusMagicDef);
    maxHp = Math.floor(12 + level * 5 + totalCon * 0.8 + bonusHp);
    maxMp = Math.floor(15 + level * 5.5 + totalInt * 1.2 + bonusMp);
    attackSpeed = 0.50 + bonusAttackSpeed;
    evasion = Math.floor(totalDex * 0.2 + level * 0.05 + bonusEvasion);
  }

  return { meleeAtk, rangedAtk, magicAtk, physDef, magicDef, maxHp, maxMp, attackSpeed, evasion };
};
