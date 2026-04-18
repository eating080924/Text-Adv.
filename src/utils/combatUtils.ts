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

  Object.values(player.equipment).forEach(instanceId => {
    if (instanceId) {
      const instance = player.inventory.find(i => i.instanceId === instanceId);
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

  const totalStr = player.stats.str + bonusStr;
  const totalDex = player.stats.dex + bonusDex;
  const totalInt = player.stats.int + bonusInt;
  const totalCon = player.stats.con + bonusCon;

  const meleeAtk = Math.floor(1 + totalStr * 1.5 + bonusAtk);
  const rangedAtk = Math.floor(1 + totalDex * 1.5 + bonusAtk);
  const magicAtk = Math.floor(1 + totalInt * 2 + bonusMagicAtk);
  const physDef = Math.floor(1 + totalCon * 1.5 + bonusDef);
  const magicDef = Math.floor(1 + totalInt * 1 + bonusMagicDef);
  const maxHp = Math.floor(30 + totalCon * 1 + bonusHp);
  const maxMp = Math.floor(10 + totalInt * 1 + bonusMp);
  const attackSpeed = 0.5 + bonusAttackSpeed;
  const evasion = Math.floor(totalDex * 0.5 + bonusEvasion);

  return { meleeAtk, rangedAtk, magicAtk, physDef, magicDef, maxHp, maxMp, attackSpeed, evasion };
};
