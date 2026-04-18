import { Player, SubMapEnemy, CharacterClass, DerivedStats } from '../types';
import { calculateDamage, calculateEnemyDamage } from '../utils/combatUtils';
import { handleExperienceGain } from './levelingLogic';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';

export interface AdventureCombatResult {
  newPlayer: Player;
  newSubMapEnemies: SubMapEnemy[];
  newEnemy: SubMapEnemy | null;
  newLogs: string[];
  newInCombat: boolean;
  newAttackProgress: number;
  newCooldowns: Record<string, number>;
  newBuffs: { id: string; remaining: number }[];
  shouldReturn?: boolean;
  returnState?: any;
}

export const processAdventureCombat = (
  player: Player,
  subMapEnemies: SubMapEnemy[],
  currentEnemy: SubMapEnemy | null,
  inCombat: boolean,
  attackProgress: number,
  cooldowns: Record<string, number>,
  activeBuffs: { id: string; remaining: number }[],
  combatLogs: string[],
  TICK: number,
  isAutoAttacking: boolean,
  calculateDerivedStats: (player: Player, buffs: { id: string; remaining: number }[]) => DerivedStats,
  playSound: (sound: string) => void,
  prev: any
): AdventureCombatResult => {
  let newPlayer = { ...player, inventory: [...player.inventory] };
  let newLogs = [...combatLogs];
  let newInCombat = inCombat;
  let newAttackProgress = attackProgress;
  let newCooldowns = { ...cooldowns };
  let newBuffs = [...activeBuffs];
  let newSubMapEnemies = [...subMapEnemies];
  let newEnemy = currentEnemy ? newSubMapEnemies.find(e => e.instanceId === currentEnemy.instanceId) || null : null;

  // Aggro Logic
  if (!newInCombat && prev.currentSubMap) {
    const aggroEnemy = newSubMapEnemies.find(e => e.behavior === 'active' && e.respawnTimer === 0 && e.distance <= 3);
    if (aggroEnemy) {
      newInCombat = true;
      newEnemy = aggroEnemy;
      newLogs.unshift(`${aggroEnemy.name} 發現了你並發動主動攻擊！ (距離: ${aggroEnemy.distance}m)`);
    }
  }

  if (newInCombat && newEnemy) {
    const weaponInstanceId = newPlayer.equipment.weapon;
    let playerRange = 1;
    if (weaponInstanceId) {
      const instance = newPlayer.inventory.find(i => i.instanceId === weaponInstanceId);
      if (instance) {
        const item = ITEM_DATA.find(i => i.id === instance.id);
        if (item && item.range) playerRange = item.range;
      }
    }

    if (newEnemy.distance > playerRange) {
      newEnemy.distance = Math.max(playerRange, newEnemy.distance - 1);
      newLogs.unshift(`正在向 ${newEnemy.name} 移動中... (距離: ${newEnemy.distance}m)`);
    }

    if (newEnemy.distance > newEnemy.range) {
      newEnemy.distance = Math.max(newEnemy.range, newEnemy.distance - 1);
    }

    if (newEnemy.hp > 0) {
      newPlayer.autoSkills.forEach(skillId => {
        const skill = SKILL_DATA.find(s => s.id === skillId);
        if (skill && (newCooldowns[skillId] || 0) === 0 && newPlayer.mp >= skill.mpCost) {
          const effectiveRange = skill.range || playerRange;
          if (skill.type === 'active' && newEnemy!.distance <= effectiveRange) {
            const result = skill.effect(newPlayer, newEnemy);
            const damage = calculateDamage(result.damage + newEnemy!.def, newEnemy!.def);
            newEnemy!.hp = Math.floor(Math.max(0, newEnemy!.hp - damage));
            newPlayer.mp -= skill.mpCost;
            newCooldowns[skillId] = skill.cooldown;
            newLogs.unshift(`[自動] 使用了 ${skill.name}，造成了 ${damage} 點傷害！ (距離: ${newEnemy!.distance}m)`);
          } else if (skill.type === 'buff') {
            newPlayer.mp -= skill.mpCost;
            newCooldowns[skillId] = skill.cooldown;
            newBuffs.push({ id: skillId, remaining: skill.duration || 0 });
            newLogs.unshift(`[自動] 使用了 ${skill.name}，獲得了強化效果！`);
          }
        }
      });
    }

    if (isAutoAttacking && newEnemy.hp > 0 && newEnemy.distance <= playerRange) {
      const derived = calculateDerivedStats(newPlayer, newBuffs);
      newAttackProgress += derived.attackSpeed * TICK * 100;

      if (newAttackProgress >= 100) {
        newAttackProgress -= 100;
        let playerAtk = derived.meleeAtk;
        if (newPlayer.class === CharacterClass.ELF) playerAtk = derived.rangedAtk;
        if (newPlayer.class === CharacterClass.MAGE) playerAtk = derived.magicAtk;

        const damage = calculateDamage(playerAtk, newEnemy.def);
        newEnemy.hp = Math.floor(Math.max(0, newEnemy.hp - damage));
        newLogs.unshift(`你對 ${newEnemy.name} 造成了 ${damage} 點傷害！ (距離: ${newEnemy.distance}m)`);
        playSound('attack');
      }
    } else {
      newAttackProgress = 0;
    }

    if (newEnemy.hp <= 0) {
      const expGained = newEnemy.exp;
      const goldGained = newEnemy.gold;
      newLogs.unshift(`擊敗了 ${newEnemy.name}！獲得了 ${expGained} 經驗與 ${goldGained} 金幣。`);

      // Drops
      const drops: string[] = [];
      newEnemy.dropTable.forEach(drop => {
        if (Math.random() < drop.chance) {
          const item = ITEM_DATA.find(i => i.id === drop.itemId);
          if (item) {
            drops.push(item.name);
            const isEquipment = item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory';
            const existingIndex = isEquipment ? -1 : newPlayer.inventory.findIndex(i => 
              i.id === item.id && i.enhancement === 0 && !Object.values(newPlayer.equipment).includes(i.instanceId)
            );
            if (existingIndex !== -1) {
              newPlayer.inventory[existingIndex] = { ...newPlayer.inventory[existingIndex], quantity: (newPlayer.inventory[existingIndex].quantity || 1) + 1 };
            } else {
              newPlayer.inventory.push({
                id: item.id,
                instanceId: Math.random().toString(36).substr(2, 9),
                enhancement: 0,
                quantity: 1,
              });
            }
          }
        }
      });
      if (drops.length > 0) newLogs.unshift(`掉落了道具：${drops.join(', ')}`);

      const levelResult = handleExperienceGain(newPlayer, expGained);
      newPlayer = levelResult.player;
      newPlayer.gold += goldGained;
      
      if (levelResult.leveledUp) {
        newLogs.unshift(`恭喜升級！目前等級：${newPlayer.level}`);
        playSound('levelup');
      }

      const derived = calculateDerivedStats(newPlayer, newBuffs);
      const finalEnemies = newSubMapEnemies.map(e => 
        e.instanceId === newEnemy!.instanceId ? { ...e, hp: 0, respawnTimer: e.respawnTime } : e
      );

      return {
        newPlayer: {
          ...newPlayer,
          meleeAtk: derived.meleeAtk,
          rangedAtk: derived.rangedAtk,
          magicAtk: derived.magicAtk,
          physDef: derived.physDef,
          magicDef: derived.magicDef,
          maxHp: derived.maxHp,
          maxMp: derived.maxMp,
          hp: Math.floor(Math.min(derived.maxHp, newPlayer.hp)),
          evasion: derived.evasion,
        },
        newSubMapEnemies: finalEnemies,
        newEnemy: null,
        newLogs: newLogs.slice(0, 50),
        newInCombat: false,
        newAttackProgress: 0,
        newCooldowns,
        newBuffs,
        shouldReturn: true,
        returnState: {
          ...prev,
          player: {
            ...newPlayer,
            meleeAtk: derived.meleeAtk,
            rangedAtk: derived.rangedAtk,
            magicAtk: derived.magicAtk,
            physDef: derived.physDef,
            magicDef: derived.magicDef,
            maxHp: derived.maxHp,
            maxMp: derived.maxMp,
            hp: Math.floor(Math.min(derived.maxHp, newPlayer.hp)),
            evasion: derived.evasion,
          },
          inCombat: false,
          currentEnemy: null,
          selectedEnemyInstanceId: null,
          subMapEnemies: finalEnemies,
          isAutoAttacking: false,
          attackProgress: 0,
          combatLogs: newLogs.slice(0, 50),
        }
      };
    }
  }

  // Enemy Attack (Mobbing)
  if (Math.random() < TICK * 0.5) {
    newSubMapEnemies.forEach(enemy => {
      if (enemy.hp > 0 && enemy.respawnTimer === 0 && enemy.distance <= enemy.range) {
        if (enemy.behavior === 'active' || (newEnemy && enemy.instanceId === newEnemy.instanceId)) {
          const derived = calculateDerivedStats(newPlayer, newBuffs);
          const enemyDamage = calculateEnemyDamage(enemy.atk, derived.physDef);
          newPlayer.hp = Math.max(0, Math.floor(newPlayer.hp - enemyDamage));
          
          if (newEnemy && enemy.instanceId === newEnemy.instanceId) {
            newLogs.unshift(`${enemy.name} 對你造成了 ${enemyDamage} 點傷害！`);
          } else if (enemy.behavior === 'active') {
            newLogs.unshift(`${enemy.name} 從旁偷襲，對你造成了 ${enemyDamage} 點傷害！`);
          }
          playSound('hit');
        }
      }
    });
  }

  if (newPlayer.hp <= 0) {
    newLogs.unshift('你被打敗了... 回到了旅館。');
    return {
      newPlayer,
      newSubMapEnemies,
      newEnemy,
      newLogs,
      newInCombat,
      newAttackProgress,
      newCooldowns,
      newBuffs,
      shouldReturn: true,
      returnState: {
        ...prev,
        player: { ...newPlayer, hp: Math.floor(newPlayer.maxHp * 0.5), isInWorld: false },
        currentMap: null,
        currentSubMap: null,
        subMapEnemies: [],
        inCombat: false,
        currentEnemy: null,
        selectedEnemyInstanceId: null,
        combatLogs: newLogs.slice(0, 50),
        isAutoAttacking: false,
      }
    };
  }

  return {
    newPlayer,
    newSubMapEnemies,
    newEnemy,
    newLogs: newLogs.slice(0, 50),
    newInCombat,
    newAttackProgress,
    newCooldowns,
    newBuffs
  };
};
