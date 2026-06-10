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
      newLogs.unshift(`${aggroEnemy.name} 發現了你並發動主動攻擊！ (距離: ${aggroEnemy.distance.toFixed(1)}m)`);
    }
  }

  if (newInCombat && newEnemy) {
    const weaponInstanceId = newPlayer.equipment.weapon;
    let playerRange = 1;
    if (weaponInstanceId) {
      const instance = newPlayer.inventory.find(i => i.instanceId === weaponInstanceId);
      if (instance) {
        const item = ITEM_DATA.find(i => i.id === instance.id);
        if (item) {
          if (item.range) playerRange = item.range;
          if (item.name.includes('弓') || item.id.includes('bow')) {
            playerRange = 6; // Range is 6m when holding a bow
          }
        }
      } else {
        // Fallback: search ITEM_DATA directly if weaponInstanceId is item ID or mapping mismatch
        const item = ITEM_DATA.find(i => i.id === weaponInstanceId);
        if (item) {
          if (item.range) playerRange = item.range;
          if (item.name.includes('弓') || item.id.includes('bow')) {
            playerRange = 6;
          }
        }
      }
    }

    const isPlayerRanged = playerRange > 1;

    // Movement: Decrease distance if outside player range or enemy range. No backstepping/retreat function.
    const targetDistance = Math.min(playerRange, newEnemy.range);
    if (newEnemy.distance > targetDistance) {
      // Decrease by 0.2m per tick instead of 1m per tick to give player time to use ranged weapons/skills
      newEnemy.distance = parseFloat(Math.max(targetDistance, newEnemy.distance - 0.2).toFixed(1));
    }

    if (newEnemy.hp > 0) {
      // Collect autoSkills, plus quickSkills if in auto play
      const targetAutoSkills = [...newPlayer.autoSkills];
      if (prev.isAutoPlay) {
        newPlayer.quickSkills.forEach(sid => {
          if (sid && !targetAutoSkills.includes(sid)) {
            targetAutoSkills.push(sid);
          }
        });
      }

      targetAutoSkills.forEach(skillId => {
        const skill = SKILL_DATA.find(s => s.id === skillId);
        if (skill && (newCooldowns[skillId] || 0) === 0 && newPlayer.mp >= skill.mpCost) {
          const effectiveRange = skill.range || playerRange;
          if (skill.type === 'active' && newEnemy!.distance <= effectiveRange) {
            const result = skill.effect(newPlayer, newEnemy);
            const damage = calculateDamage(result.damage + newEnemy!.def, newEnemy!.def);
            newEnemy!.hp = Math.floor(Math.max(0, newEnemy!.hp - damage));
            newPlayer.mp -= skill.mpCost;
            newCooldowns[skillId] = skill.cooldown;
            newLogs.unshift(`[自動] 使用了 ${skill.name}，造成了 ${damage} 點傷害！ (距離: ${newEnemy!.distance.toFixed(1)}m)`);
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
        if (newPlayer.class === CharacterClass.ELF) {
          playerAtk = isPlayerRanged ? derived.rangedAtk : derived.meleeAtk;
        }
        if (newPlayer.class === CharacterClass.MAGE) playerAtk = derived.magicAtk;

        const damage = calculateDamage(playerAtk, newEnemy.def);
        newEnemy.hp = Math.floor(Math.max(0, newEnemy.hp - damage));
        newLogs.unshift(`你對 ${newEnemy.name} 造成了 ${damage} 點傷害！ (距離: ${newEnemy.distance.toFixed(1)}m)`);
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

      // In Auto Play, find next target automatically
      let nextEnemy = null;
      if (prev.isAutoPlay) {
        const aliveEnemies = finalEnemies.filter(e => e.hp > 0 && e.respawnTimer === 0);
        if (aliveEnemies.length > 0) {
          aliveEnemies.sort((a, b) => {
            if (a.behavior === 'active' && b.behavior !== 'active') return -1;
            if (b.behavior === 'active' && a.behavior !== 'active') return 1;
            return a.distance - b.distance;
          });
          nextEnemy = aliveEnemies[0];
          newLogs.unshift(`[自動] 自動瞄準下一個目標：${nextEnemy.name} (距離: ${nextEnemy.distance}m)`);
        }
      }

      const nextInCombat = nextEnemy ? true : false;
      const nextIsAutoAttacking = nextEnemy ? true : false;

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
        newEnemy: nextEnemy,
        newLogs: newLogs.slice(0, 50),
        newInCombat: nextInCombat,
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
          inCombat: nextInCombat,
          currentEnemy: nextEnemy,
          selectedEnemyInstanceId: nextEnemy ? nextEnemy.instanceId : null,
          subMapEnemies: finalEnemies,
          isAutoAttacking: nextIsAutoAttacking,
          attackProgress: 0,
          combatLogs: newLogs.slice(0, 50),
        }
      };
    }
  }

  // Enemy Attack (Mobbing)
  if (Math.random() < TICK * 0.5) {
    const weaponInstanceId = newPlayer.equipment.weapon;
    let isPlayerRanged = false;
    let activePlayerRange = 1;
    if (weaponInstanceId) {
      const instance = newPlayer.inventory.find(i => i.instanceId === weaponInstanceId);
      if (instance) {
        const item = ITEM_DATA.find(i => i.id === instance.id);
        if (item) {
          if (item.range) activePlayerRange = item.range;
          if (item.name.includes('弓') || item.id.includes('bow')) {
            activePlayerRange = 6;
          }
        }
      } else {
        const item = ITEM_DATA.find(i => i.id === weaponInstanceId);
        if (item) {
          if (item.range) activePlayerRange = item.range;
          if (item.name.includes('弓') || item.id.includes('bow')) {
            activePlayerRange = 6;
          }
        }
      }
    }

    isPlayerRanged = activePlayerRange > 1;

    newSubMapEnemies.forEach(enemy => {
      const canEnemyReach = enemy.distance <= enemy.range || (isPlayerRanged && enemy.distance <= activePlayerRange);
      if (enemy.hp > 0 && enemy.respawnTimer === 0 && canEnemyReach) {
        if (enemy.behavior === 'active' || (newEnemy && enemy.instanceId === newEnemy.instanceId)) {
          const derived = calculateDerivedStats(newPlayer, newBuffs);
          const enemyDamage = calculateEnemyDamage(enemy.atk, derived.physDef);
          newPlayer.hp = Math.max(0, Math.floor(newPlayer.hp - enemyDamage));
          
          if (newEnemy && enemy.instanceId === newEnemy.instanceId) {
            newLogs.unshift(`${enemy.name} 對你造成了 ${enemyDamage} 點傷害！`);
          } else if (enemy.behavior === 'active') {
            newLogs.unshift(`${enemy.name} 從旁偷襲，對你造成了 ${enemyDamage} 點傷害！`);
            
            // In Auto Play, automatically counter-attack when attacked
            if (prev.isAutoPlay && !newInCombat) {
              newEnemy = enemy;
              newInCombat = true;
              newLogs.unshift(`[反擊] 受到 ${enemy.name} 攻擊，自動開始攻擊！`);
            }
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
