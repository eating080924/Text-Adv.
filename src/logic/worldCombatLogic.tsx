import { Player, CharacterClass, DerivedStats, SubMapEnemy } from '../types';
import { calculateDamage } from '../utils/combatUtils';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';
import { supabase } from '../supabase';

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
        if (item && item.range) playerRange = item.range;
      }
    }

    if (newEnemy.distance > playerRange) {
      newEnemy.distance = Math.max(playerRange, newEnemy.distance - 1);
      newLogs.unshift(`正在向 ${newEnemy.name} 移動中... (距離: ${newEnemy.distance}m)`);
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

            if (newEnemy.instanceId === 'world_boss') {
              supabase.from('world_boss').update({ hp: Math.max(0, newEnemy.hp) }).eq('id', 'boss');
            }

            if (newEnemy.instanceId.startsWith('player-') && newEnemy.targetUid) {
              supabase.from('users').update({
                hp: Math.max(0, newEnemy.hp),
                lastAttackerName: newPlayer.id,
                lastUpdate: new Date().toISOString()
              }).eq('id', newEnemy.targetUid);
            }
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

        if (newEnemy.instanceId === 'world_boss') {
          supabase.from('world_boss').update({ hp: Math.max(0, newEnemy.hp) }).eq('id', 'boss');
        }

        if (newEnemy.instanceId.startsWith('player-') && newEnemy.targetUid) {
          // 🛡️ PvP Kill Protection:
          // Don't let the attacker's local calculation trigger the final blow.
          // We cap the local HP at 1 and wait for the victim to broadcast their own death.
          // This prevents "killing" someone who just healed on their screen.
          if (newEnemy.hp <= 0) {
            newEnemy.hp = 1;
          }

          supabase.from('users').update({
            hp: Math.max(1, newEnemy.hp),
            lastAttackerName: newPlayer.id
          }).eq('id', newEnemy.targetUid);

          // ✅ Send broadcast for immediate feedback
          const worldChannel = (window as any).worldChannel;
          if (worldChannel) {
            worldChannel.send({
              type: 'broadcast',
              event: 'pvp_damage',
              payload: {
                attackerId: newPlayer.uid,
                attackerName: newPlayer.id,
                victimId: newEnemy.targetUid,
                damage: damage,
                newHp: newEnemy.hp
              }
            });
          }
        }
      }
    } else {
      newAttackProgress = 0;
    }

    // Only trigger kill logic for non-players or if HP is truly 0 (from sync)
    if (newEnemy.hp <= 0) {
      if (newEnemy.instanceId === 'world_boss') {
        supabase.from('world_boss').update({
          status: 'cooldown',
          lastKillFaction: newPlayer.faction,
          nextSpawnTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          hp: 1000000
        }).eq('id', 'boss');
        newLogs.unshift(`恭喜！你的陣營 ${newPlayer.faction} 成功擊敗了世界級 BOSS！`);
      }

      // Note: Player kill logic is now handled via pvp_death broadcast and GameContext listeners
      // to ensure the victim's own HP state is the source of truth.
      
      const derived = calculateDerivedStats(newPlayer, newBuffs);
      const finalWorldEnemies = newWorldEnemies.map(e => 
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
        newWorldEnemies: finalWorldEnemies,
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
          worldEnemies: finalWorldEnemies,
          isAutoAttacking: false,
          attackProgress: 0,
          combatLogs: newLogs.slice(0, 50),
        }
      };
    }

    // Enemy Attack Logic (Counter-attack)
    // For World Boss: Always counter-attack since it's a shared entity
    // For Players: We rely on the other player's client to auto-retaliate via user-sync
    if (newEnemy.hp > 0 && newEnemy.distance <= newEnemy.range && newEnemy.instanceId === 'world_boss') {
      if (Math.random() < TICK * 0.5) { // Boss attacks once per 2 seconds on average
        const enemyDamage = Math.max(1, Math.floor(newEnemy.atk - newPlayer.physDef));
        newPlayer.hp = Math.max(0, Math.floor(newPlayer.hp - enemyDamage));
        newPlayer.lastAttackerName = newEnemy.name; 
        newLogs.unshift(`${newEnemy.name} 對你造成了 ${enemyDamage} 點傷害！`);
        playSound('hit');

        // Sync player HP to Supabase immediately if attacked by boss
        supabase.from('users').update({
          hp: newPlayer.hp,
          lastAttackerName: newEnemy.name,
          lastUpdate: new Date().toISOString()
        }).eq('id', player.uid);
      }
    }
  }

  if (newPlayer.hp <= 0) {
    newLogs.unshift('你被打敗了... 回到了旅館。');
    
    // Broadcast death for immediate feedback to the attacker
    const worldChannel = (window as any).worldChannel;
    if (worldChannel) {
      worldChannel.send({
        type: 'broadcast',
        event: 'pvp_death',
        payload: {
          playerId: newPlayer.uid,
          playerName: newPlayer.id,
          attackerName: newPlayer.lastAttackerName
        }
      });
    }

    return {
      newPlayer,
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
    newWorldEnemies,
    newEnemy,
    newLogs: newLogs.slice(0, 50),
    newInCombat,
    newAttackProgress,
    newCooldowns,
    newBuffs
  };
};
