import { Player, CharacterClass, DerivedStats, SubMapEnemy } from '../types';
import { calculateDamage } from '../utils/combatUtils';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';
import { sendAttack } from '../lib/firebase';

export interface WorldCombatResult {
  newPlayer: Player;
  newWorldEnemies: SubMapEnemy[];
  newEnemy: SubMapEnemy | null;
  newLogs: string[];
  newInCombat: boolean;
  newAttackProgress: number;
  newCooldowns: Record<string, number>;
  newBuffs: { id: string; remaining: number }[];
  shouldReturn?: boolean;
  returnState?: any;
}

export const processWorldCombat = (
  player: Player,
  worldEnemies: any[],
  currentEnemy: any | null,
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
): WorldCombatResult => {
  let newPlayer = { ...player, inventory: [...player.inventory] };
  let newLogs = [...combatLogs];
  let newInCombat = inCombat;
  let newAttackProgress = attackProgress;
  let newCooldowns = { ...cooldowns };
  let newBuffs = [...activeBuffs];
  let newWorldEnemies = [...worldEnemies];
  let newEnemy = currentEnemy ? newWorldEnemies.find(e => e.instanceId === currentEnemy.instanceId) || null : null;

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

    // Movement: Canceled for World Map
    const targetDistance = Math.min(playerRange, newEnemy.range);

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
          if (skill.type === 'active') {
            const result = skill.effect(newPlayer, newEnemy);
            const damage = calculateDamage(result.damage + newEnemy!.def, newEnemy!.def);
            newEnemy!.hp = Math.floor(Math.max(0, newEnemy!.hp - damage));
            newPlayer.mp -= skill.mpCost;
            newCooldowns[skillId] = skill.cooldown;
            newLogs.unshift(`[自動] 使用了 ${skill.name}，造成了 ${damage} 點傷害！`);
            // Real-time remote PvP sync
            sendAttack(newEnemy!.id, newPlayer.uid || 'unknown', newPlayer.id || '冒險者', damage);
          } else if (skill.type === 'buff') {
            newPlayer.mp -= skill.mpCost;
            newCooldowns[skillId] = skill.cooldown;
            newBuffs.push({ id: skillId, remaining: skill.duration || 0 });
            newLogs.unshift(`[自動] 使用了 ${skill.name}，獲得了強化效果！`);
          }
        }
      });
    }

    if (isAutoAttacking && newEnemy.hp > 0) {
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
        newLogs.unshift(`你對 ${newEnemy.name} 造成了 ${damage} 點傷害！`);
        playSound('attack');
        // Real-time remote PvP sync
        sendAttack(newEnemy.id, newPlayer.uid || 'unknown', newPlayer.id || '冒險者', damage);
      }
    } else {
      newAttackProgress = 0;
    }

    // Only trigger kill logic if HP is truly 0 (from sync)
    if (newEnemy.hp <= 0) {
      const derived = calculateDerivedStats(newPlayer, newBuffs);
      const finalWorldEnemies = newWorldEnemies.map(e => 
        e.instanceId === newEnemy!.instanceId ? { ...e, hp: 0, respawnTimer: e.respawnTime } : e
      );

      let updatedPlayerKills = newPlayer.pvpKills || 0;
      if (newEnemy.isPlayer) {
        updatedPlayerKills += 1;
        newLogs.unshift(`[PVP] 擊殺成功！你成功擊敗了玩家 ${newEnemy.name}！`);
      }

      // In Auto Play, find next target automatically
      let nextEnemy = null;
      if (prev.isAutoPlay) {
        const aliveEnemies = finalWorldEnemies.filter(e => e.hp > 0 && e.respawnTimer === 0);
        if (aliveEnemies.length > 0) {
          aliveEnemies.sort((a, b) => {
            if (a.behavior === 'active' && b.behavior !== 'active') return -1;
            if (b.behavior === 'active' && a.behavior !== 'active') return 1;
            return 0;
          });
          nextEnemy = aliveEnemies[0];
          newLogs.unshift(`[自動] 自動瞄準下一個目標：${nextEnemy.name}`);
        }
      }

      const nextInCombat = nextEnemy ? true : false;
      const nextIsAutoAttacking = nextEnemy ? true : false;

      return {
        newPlayer: {
          ...newPlayer,
          pvpKills: updatedPlayerKills,
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
        newWorldEnemies: finalWorldEnemies,
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
            pvpKills: updatedPlayerKills,
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
          worldEnemies: finalWorldEnemies,
          isAutoAttacking: nextIsAutoAttacking,
          attackProgress: 0,
          combatLogs: newLogs.slice(0, 50),
        }
      };
    }

    // Enemy Attack Logic (Counter-attack - No distance limit on World Map, only for non-player targets like World Bosses)
    const canEnemyReach = true;
    if (newEnemy.hp > 0 && canEnemyReach && !newEnemy.isPlayer) {
      if (Math.random() < TICK * 0.5) { // NPC/Bot attacks once per 2 seconds on average
        const enemyDamage = Math.max(1, Math.floor(newEnemy.atk - newPlayer.physDef));
        newPlayer.hp = Math.max(0, Math.floor(newPlayer.hp - enemyDamage));
        newPlayer.lastAttackerName = newEnemy.name; 
        newLogs.unshift(`${newEnemy.name} 對你造成了 ${enemyDamage} 點傷害！`);
        playSound('hit');
      }
    }
  }

  if (newPlayer.hp <= 0) {
    const updatedPlayerDeaths = (newPlayer.pvpDeaths || 0) + 1;
    newLogs.unshift('你被打敗了... 回到了旅館。');

    return {
      newPlayer: {
        ...newPlayer,
        pvpDeaths: updatedPlayerDeaths,
      },
      newWorldEnemies,
      newEnemy,
      newLogs,
      newInCombat,
      newAttackProgress,
      newCooldowns,
      newBuffs,
      shouldReturn: true,
      returnState: {
        ...prev,
        player: { 
          ...newPlayer, 
          pvpDeaths: updatedPlayerDeaths,
          hp: Math.floor(newPlayer.maxHp * 0.5), 
          isInWorld: false 
        },
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
    newWorldEnemies,
    newEnemy,
    newLogs: newLogs.slice(0, 50),
    newInCombat,
    newAttackProgress,
    newCooldowns,
    newBuffs
  };
};
