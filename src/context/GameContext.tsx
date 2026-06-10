import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CharacterClass, Faction, Stats, Enemy, Item, Skill, MainMap, SubMap, ItemInstance, Player, GameState, DerivedStats } from '../types';
import { CLASS_DATA } from '../data/classes';
import { MAP_DATA } from '../data/maps';
import { ENEMY_DATA } from '../data/enemies';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';
import { WORLD_BOSS_DATA } from '../data/worldBoss';
import { calculateDamage, calculateEnemyDamage, calculateDerivedStats, calculateLineageRegen } from '../utils/combatUtils';
import { calculateEnhancement } from '../utils/enhancement';
import { handleExperienceGain } from '../logic/levelingLogic';
import { processAdventureCombat } from '../logic/adventureCombatLogic';
import { processWorldCombat } from '../logic/worldCombatLogic';
import { syncHeartbeat, listenToActivePlayers, listenToIncomingAttacks, sendAttack } from '../lib/firebase';

interface SubMapEnemy extends Enemy {
  instanceId: string;
  distance: number;
  respawnTimer: number;
  isPlayer?: boolean;
  faction?: Faction;
  targetUid?: string;
}

interface GameContextType extends GameState {
  createCharacter: (id: string, charClass: CharacterClass, stats: Stats, faction: Faction) => void;
  selectMap: (mapId: string, subMapId: string) => void;
  startCombat: (instanceId?: string) => void;
  cancelCombat: () => void;
  setSelectedEnemy: (instanceId: string | null) => void;
  useSkill: (skillId: string) => void;
  useItem: (instanceId: string) => void;
  equipItem: (instanceId: string) => void;
  unequipItem: (slot: keyof Player['equipment']) => void;
  enhanceItem: (scrollInstanceId: string, targetInstanceId: string) => { success: boolean; destroyed: boolean; message: string } | undefined;
  setQuickItem: (slot: number, itemId: string | null) => void;
  setQuickSkill: (slot: number, skillId: string | null) => void;
  useQuickItem: (slot: number) => void;
  toggleAutoAttack: () => void;
  toggleAutoPlay: () => void;
  restAtInn: () => void;
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  updateSettings: (settings: Partial<Player>) => void;
  addLog: (log: string) => void;
  learnSkill: (skillId: string) => void;
  deleteCharacter: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'rpg_game_player_data';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const lastInWorldRef = React.useRef(false);
  const lastSyncedHpRef = React.useRef<number | null>(null);
  const lastSyncedAtRef = React.useRef<number>(0);
  const [state, setState] = useState<GameState>(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed) {
          if (!parsed.quickSkills) parsed.quickSkills = [];
          while (parsed.quickSkills.length < 8) parsed.quickSkills.push(null);
          if (!parsed.quickItems) parsed.quickItems = [];
          while (parsed.quickItems.length < 8) parsed.quickItems.push(null);
        }
        return {
          player: parsed,
          currentMap: null,
          currentSubMap: null,
          subMapEnemies: [],
          inCombat: false,
          currentEnemy: null,
          selectedEnemyInstanceId: null,
          combatLogs: ['歡迎回來！冒險者。'],
          isAutoAttacking: false,
          isAutoPlay: true,
          activeBuffs: [],
          cooldowns: {},
          attackProgress: 0,
          timeInMap: 0,
          isWorldBossActive: false,
          worldBoss: null,
          worldPlayers: [],
          worldEnemies: [],
        };
      } catch (e) {
        console.error('Failed to load saved data', e);
      }
    }
    return {
      player: null,
      currentMap: null,
      currentSubMap: null,
      subMapEnemies: [],
      inCombat: false,
      currentEnemy: null,
      selectedEnemyInstanceId: null,
      combatLogs: [],
      isAutoAttacking: false,
      isAutoPlay: true,
      activeBuffs: [],
      cooldowns: {},
      attackProgress: 0,
      timeInMap: 0,
      isWorldBossActive: false,
      worldBoss: null,
      worldPlayers: [],
      worldEnemies: [],
    };
  });

  const playerRef = React.useRef(state.player);

  useEffect(() => {
    playerRef.current = state.player;
  }, [state.player]);

  // Offline-First Auth & Local Player Fetch
  useEffect(() => {
    const initAuth = () => {
      try {
        let currentUserId = localStorage.getItem('rpg_game_user_id');
        if (!currentUserId) {
          currentUserId = 'char_' + Math.random().toString(36).substring(2, 11);
          localStorage.setItem('rpg_game_user_id', currentUserId);
        }
        const currentUser = { id: currentUserId, email: 'adventure_player@game.com' };
        setUser(currentUser);
        
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
          setState(prev => {
            if (prev.player) {
              return {
                ...prev,
                player: {
                  ...prev.player,
                  uid: currentUser.id
                }
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Player initialization failed:', err);
      }
    };

    initAuth();
  }, []);

  // Real-Time PvP Multiplayer Synchronization Listeners
  useEffect(() => {
    if (!state.player?.isInWorld || !user) return;

    // Use our unique user identifier (uid) as active key
    const myId = state.player.uid || state.player.id || user.id;

    console.log("PVP system activated for player:", myId);

    // 1. Listen to active world players
    const unsubscribePlayers = listenToActivePlayers(myId, (remotePlayers) => {
      // Map RemotePlayer data format to SubMapEnemy shape to register them on map
      const mappedEnemies = remotePlayers.map(p => {
        return {
          id: p.id,
          name: p.name,
          type: 'normal' as const,
          hp: p.hp,
          maxHp: p.maxHp,
          mp: p.mp,
          maxMp: p.maxMp,
          atk: p.atk,
          def: p.def,
          range: p.class === CharacterClass.ELF ? 6 : 1,
          exp: 200,
          gold: 100,
          behavior: 'passive' as const,
          respawnTime: 10,
          dropTable: [],
          instanceId: p.id, // Target player UID forms instanceId
          distance: 10,
          respawnTimer: 0,
          isPlayer: true,
          faction: p.faction,
          targetUid: p.id,
        };
      });

      setState(prev => {
        if (!prev.player) return prev;

        // Sync target details if we are locked in PvP
        let nextEnemy = prev.currentEnemy;
        let nextInCombat = prev.inCombat;
        let nextSelectedId = prev.selectedEnemyInstanceId;

        if (prev.inCombat && prev.currentEnemy) {
          const match = mappedEnemies.find(e => e.instanceId === prev.currentEnemy.instanceId);
          if (!match || match.hp <= 0) {
            // Target player was defeated or went offline
            nextEnemy = null;
            nextInCombat = false;
            nextSelectedId = null;
            if (prev.isAutoPlay) {
              const eligible = mappedEnemies.filter(e => e.hp > 0 && e.faction !== prev.player!.faction);
              if (eligible.length > 0) {
                nextEnemy = eligible[0];
                nextInCombat = true;
                nextSelectedId = eligible[0].instanceId;
              }
            }
          } else {
            nextEnemy = match;
          }
        }

        return {
          ...prev,
          worldPlayers: remotePlayers,
          worldEnemies: mappedEnemies,
          currentEnemy: nextEnemy,
          inCombat: nextInCombat,
          selectedEnemyInstanceId: nextSelectedId,
        };
      });
    });

    // 2. Listen to incoming attacks directed at ME
    const unsubscribeAttacks = listenToIncomingAttacks(myId, (attack) => {
      setState(prev => {
        if (!prev.player || !prev.player.isInWorld) return prev;

        const nextHp = Math.max(0, prev.player.hp - attack.damage);
        const nextLogs = [`[受到攻擊] 玩家 ${attack.attackerName} 對你造成了 ${attack.damage} 點傷害！`, ...prev.combatLogs].slice(0, 50);

        let nextPlayer = {
          ...prev.player,
          hp: nextHp,
          lastAttackerName: attack.attackerName,
        };

        let nextInCombat = prev.inCombat;
        let nextEnemy = prev.currentEnemy;
        let nextSelectedId = prev.selectedEnemyInstanceId;

        // Auto retaliation if autoplay is on
        if (!prev.inCombat && prev.isAutoPlay) {
          const attackerMatch = prev.worldEnemies.find(e => e.id === attack.attackerUid && e.hp > 0);
          if (attackerMatch && attackerMatch.faction !== prev.player.faction) {
            nextEnemy = attackerMatch;
            nextInCombat = true;
            nextSelectedId = attackerMatch.instanceId;
            nextLogs.unshift(`[反擊] 自動鎖定反擊對象：${attackerMatch.name}`);
          }
        }

        if (nextHp <= 0) {
          const nextDeaths = (prev.player.pvpDeaths || 0) + 1;
          nextLogs.unshift(`[PVP] 你被玩家 ${attack.attackerName} 擊敗了... 回到了旅館。`);
          
          return {
            ...prev,
            player: {
              ...prev.player,
              hp: Math.floor(prev.player.maxHp * 0.5),
              isInWorld: false,
              pvpDeaths: nextDeaths,
            },
            currentMap: null,
            currentSubMap: null,
            subMapEnemies: [],
            inCombat: false,
            currentEnemy: null,
            selectedEnemyInstanceId: null,
            combatLogs: nextLogs,
          };
        }

        return {
          ...prev,
          player: nextPlayer,
          combatLogs: nextLogs,
          inCombat: nextInCombat,
          currentEnemy: nextEnemy,
          selectedEnemyInstanceId: nextSelectedId,
        };
      });
    });

    // 3. Periodic player heartbeat stats sync (runs every 1500ms)
    const heartbeatTimer = setInterval(() => {
      const activePlayer = playerRef.current;
      if (activePlayer && activePlayer.isInWorld) {
        const syncId = activePlayer.uid || activePlayer.id || user.id;
        // Ensure we sync matching ID and preserve original character name
        const playerToSync = { 
          ...activePlayer, 
          id: syncId,
          charName: activePlayer.id
        };
        syncHeartbeat(playerToSync, () => {});
      }
    }, 1500);

    return () => {
      console.log("PVP system deactivated.");
      unsubscribePlayers();
      unsubscribeAttacks();
      clearInterval(heartbeatTimer);
    };
  }, [state.player?.isInWorld, user]);

  // Save to localStorage whenever player data changes
  useEffect(() => {
    if (state.player) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.player));
    }
  }, [state.player]);

  const addLog = useCallback((log: string) => {
    setState(prev => {
      const newLogs = [log, ...prev.combatLogs].slice(0, 50);
      return {
        ...prev,
        combatLogs: newLogs,
      };
    });
  }, []);

  const createCharacter = (id: string, charClass: CharacterClass, stats: Stats, faction: Faction) => {
    const baseStats = CLASS_DATA[charClass].baseStats;
    const initialSkills = charClass === CharacterClass.MAGE ? ['meditation', 'fireball'] : [];
    
    const initialInventory: ItemInstance[] = ['hp_potion_s', 'hp_potion_s', 'mp_potion_s'].map(itemId => ({
      id: itemId,
      instanceId: Math.random().toString(36).substr(2, 9),
      enhancement: 0,
      quantity: 1,
    }));

    // Stack initial inventory (only for non-equipment)
    const stackedInventory: ItemInstance[] = [];
    initialInventory.forEach(instance => {
      const item = ITEM_DATA.find(i => i.id === instance.id);
      const isEquipment = item?.type === 'weapon' || item?.type === 'armor' || item?.type === 'accessory';
      const existing = isEquipment ? null : stackedInventory.find(i => i.id === instance.id && i.enhancement === instance.enhancement);
      if (existing) {
        existing.quantity += instance.quantity;
      } else {
        stackedInventory.push(instance);
      }
    });

    const quickSkills: (string | null)[] = Array(8).fill(null);
    initialSkills.forEach((skillId, i) => {
      if (i < 8) quickSkills[i] = skillId;
    });

    const tempPlayer: Player = {
      id,
      uid: '', // Will be updated after getting user
      class: charClass,
      faction,
      level: 1,
      exp: 0,
      nextLevelExp: 100,
      hp: 1,
      maxHp: 1,
      mp: 1,
      maxMp: 1,
      stats: { ...baseStats, ...stats },
      meleeAtk: 1 + stats.str * 1.5,
      rangedAtk: 1 + stats.dex * 1.5,
      magicAtk: 1 + stats.int * 2,
      physDef: 1 + stats.con * 1.5,
      magicDef: 1 + stats.int * 1,
      evasion: stats.dex * 0.5,
      gold: 100,
      inventory: stackedInventory,
      skills: initialSkills,
      equipment: {},
      quickItems: Array(8).fill(null),
      quickSkills,
      attackSpeed: 0.5,
      autoPotionHpThreshold: 30,
      autoPotionMpThreshold: 20,
      autoSkills: [],
      pvpKills: 0,
      pvpDeaths: 0,
    };

    const derived = calculateDerivedStats(tempPlayer, []);
    tempPlayer.hp = derived.maxHp;
    tempPlayer.maxHp = derived.maxHp;
    tempPlayer.mp = derived.maxMp;
    tempPlayer.maxMp = derived.maxMp;
    tempPlayer.meleeAtk = derived.meleeAtk;
    tempPlayer.rangedAtk = derived.rangedAtk;
    tempPlayer.magicAtk = derived.magicAtk;
    tempPlayer.physDef = derived.physDef;
    tempPlayer.magicDef = derived.magicDef;
    tempPlayer.evasion = derived.evasion;

    const player = tempPlayer;
    setState(prev => ({ ...prev, player }));
    addLog(`歡迎來到這個世界，${id}！你選擇了${faction}陣營與${charClass}職業。`);

    // Save to localStorage
    if (user) {
      const playerWithUid = { ...player, uid: user.id };
      setState(prev => ({ ...prev, player: playerWithUid }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playerWithUid));
    }
  };

  const selectMap = (mapId: string, subMapId: string) => {
    const map = MAP_DATA.find(m => m.id === mapId);
    const subMap = map?.subMaps.find(s => s.id === subMapId);
    if (map && subMap) {
      // If re-entering the SAME submap, don't refresh enemies immediately
      if (state.currentSubMap?.id === subMapId) {
        addLog(`重新回到了 ${subMap.name}`);
        return;
      }

      const initialEnemies: SubMapEnemy[] = [];
      subMap.enemies.forEach((enemyId, index) => {
        const base = ENEMY_DATA[enemyId];
        // Bosses and MiniBosses don't spawn immediately
        if (base.type === 'boss' || base.type === 'miniboss') {
          return;
        } else {
          const count = Math.floor(Math.random() * 3) + 2;
          for (let i = 0; i < count; i++) {
            initialEnemies.push({
              ...base,
              instanceId: `${enemyId}-${index}-${i}-${Date.now()}`,
              hp: base.maxHp,
              mp: base.maxMp,
              distance: Math.floor(Math.random() * 15) + 5,
              respawnTimer: 0,
            });
          }
        }
      });

      setState(prev => ({
        ...prev,
        currentMap: map,
        currentSubMap: subMap,
        subMapEnemies: initialEnemies,
        inCombat: false,
        currentEnemy: null,
        selectedEnemyInstanceId: null,
        isAutoAttacking: false,
        isAutoPlay: false, // Default to manual mode when entering adventure map
        timeInMap: 0,
      }));
      addLog(`進入了 ${map.name} - ${subMap.name}`);
    } else {
      setState(prev => ({
        ...prev,
        currentMap: null,
        currentSubMap: null,
        subMapEnemies: [],
        inCombat: false,
        currentEnemy: null,
        selectedEnemyInstanceId: null,
        isAutoAttacking: false,
        player: prev.player ? { ...prev.player, isInWorld: false } : null
      }));
    }
  };

  const setSelectedEnemy = (instanceId: string | null) => {
    setState(prev => {
      const enemy = instanceId 
        ? (prev.subMapEnemies.find(e => e.instanceId === instanceId) || prev.worldEnemies.find(e => e.instanceId === instanceId))
        : null;
      
      const shouldStartCombat = enemy && prev.isAutoPlay;
      const nextInCombat = enemy ? (prev.inCombat || shouldStartCombat) : false;
      const nextIsAutoAttacking = enemy ? (prev.isAutoAttacking || shouldStartCombat) : false;

      return {
        ...prev,
        selectedEnemyInstanceId: instanceId,
        currentEnemy: enemy || null,
        inCombat: nextInCombat,
        isAutoAttacking: nextIsAutoAttacking,
      };
    });
  };

  const startCombat = (instanceId?: string) => {
    const targetId = instanceId || state.selectedEnemyInstanceId;
    if (!targetId) return;

    const enemy = state.subMapEnemies.find(e => e.instanceId === targetId) || state.worldEnemies.find(e => e.instanceId === targetId);
    if (enemy && enemy.respawnTimer === 0) {
      setState(prev => ({
        ...prev,
        inCombat: true,
        currentEnemy: enemy,
        selectedEnemyInstanceId: targetId,
        isAutoAttacking: true,
      }));
      addLog(`開始與 ${enemy.name} 戰鬥！`);
    }
  };

  const cancelCombat = () => {
    setState(prev => ({
      ...prev,
      inCombat: false,
      currentEnemy: null,
      selectedEnemyInstanceId: null,
      isAutoAttacking: false,
    }));
    addLog('脫離了戰鬥。');
  };

  const useSkill = (skillId: string) => {
    const skill = SKILL_DATA.find(s => s.id === skillId);
    const { player, currentEnemy, cooldowns } = state;

    if (!player || !skill) return;
    if (player.mp < skill.mpCost) {
      addLog('MP 不足！');
      return;
    }
    if (cooldowns[skillId] > 0) {
      addLog('技能冷卻中！');
      return;
    }

    // Range check for active skills
    if (skill.type === 'active' && currentEnemy) {
      const weaponInstanceId = player.equipment.weapon;
      let weaponRange = 1;
      if (weaponInstanceId) {
        const instance = player.inventory.find(i => i.instanceId === weaponInstanceId);
        if (instance) {
          const item = ITEM_DATA.find(i => i.id === instance.id);
          if (item) {
            if (item.range) weaponRange = item.range;
            if (item.name.includes('弓') || item.id.includes('bow')) {
              weaponRange = 6;
            }
          }
        } else {
          const item = ITEM_DATA.find(i => i.id === weaponInstanceId);
          if (item) {
            if (item.range) weaponRange = item.range;
            if (item.name.includes('弓') || item.id.includes('bow')) {
              weaponRange = 6;
            }
          }
        }
      }
      
      const effectiveRange = skill.range || weaponRange;
      
      const isWorldMap = player?.isInWorld;
      if (!isWorldMap && currentEnemy.distance > effectiveRange) {
        addLog(`距離太遠！ ${skill.name} 無法觸及敵人。 (距離: ${currentEnemy.distance.toFixed(1)}m)`);
        return;
      }

      playSound('skill');
      const result = skill.effect(player, currentEnemy);
      // Use floating damage
      const damage = calculateDamage(result.damage + currentEnemy.def, currentEnemy.def);
      const newEnemyHp = Math.floor(Math.max(0, currentEnemy.hp - damage));
      
      if (isWorldMap) {
        addLog(`使用了 ${skill.name}，對 ${currentEnemy.name} 造成了 ${damage} 點傷害！`);
      } else {
        addLog(`使用了 ${skill.name}，對 ${currentEnemy.name} 造成了 ${damage} 點傷害！ (距離: ${currentEnemy.distance.toFixed(1)}m)`);
      }
      
      // PvP Sync: Real-time remote PvP sync
      if (isWorldMap) {
        sendAttack(currentEnemy!.id, player.uid || player.id || 'unknown', player.id || '冒險者', damage);
      }

      setState(prev => {
        if (prev.player && prev.player.mp !== Math.floor(prev.player.mp - skill.mpCost)) {
          // No HP change here usually for active skills on enemy
        }
        return {
          ...prev,
          player: { ...prev.player!, mp: Math.floor(prev.player!.mp - skill.mpCost) },
          currentEnemy: { ...prev.currentEnemy!, hp: newEnemyHp },
          subMapEnemies: prev.subMapEnemies.map(e => e.instanceId === currentEnemy.instanceId ? { ...e, hp: newEnemyHp } : e),
          cooldowns: { ...prev.cooldowns, [skillId]: skill.cooldown },
        };
      });
    } else if (skill.type === 'buff') {
      playSound('skill');
      setState(prev => {
        const existingBuffIndex = prev.activeBuffs.findIndex(b => b.id === skillId);
        let newBuffs = [...prev.activeBuffs];
        if (existingBuffIndex !== -1) {
          newBuffs[existingBuffIndex] = { ...newBuffs[existingBuffIndex], remaining: skill.duration || 0 };
        } else {
          newBuffs.push({ id: skillId, remaining: skill.duration || 0 });
        }
        return {
          ...prev,
          player: { ...prev.player!, mp: Math.floor(prev.player!.mp - skill.mpCost) },
          activeBuffs: newBuffs,
          cooldowns: { ...prev.cooldowns, [skillId]: skill.cooldown },
        };
      });
      addLog(`使用了 ${skill.name}，獲得了強化效果！`);
    }
  };

  const getItemNameWithEnhancement = (item: Item, instance: ItemInstance) => {
    return `${instance.enhancement > 0 ? `+${instance.enhancement} ` : ''}${item.name}`;
  };

  const useItem = (instanceId: string) => {
    if (!state.player) return;
    const itemIndex = state.player.inventory.findIndex(i => i.instanceId === instanceId);
    if (itemIndex === -1) return;

    const instance = state.player.inventory[itemIndex];
    const item = ITEM_DATA.find(i => i.id === instance.id);
    if (!item) return;

    if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
      // Check if already equipped
      let slot: keyof Player['equipment'] | null = null;
      if (item.type === 'weapon') slot = 'weapon';
      else if (item.type === 'armor') slot = item.armorSlot as keyof Player['equipment'];
      else if (item.type === 'accessory') slot = 'accessory';

      if (slot && state.player.equipment[slot] === instanceId) {
        unequipItem(slot!);
      } else {
        equipItem(instanceId);
      }
      return;
    }

    setState(prev => {
      if (!prev.player) return prev;
      const currentItemIndex = prev.player.inventory.findIndex(i => i.instanceId === instanceId);
      if (currentItemIndex === -1) return prev;

      const currentInstance = prev.player.inventory[currentItemIndex];
      const currentItem = ITEM_DATA.find(i => i.id === currentInstance.id);
      if (!currentItem) return prev;

      const newInventory = [...prev.player.inventory];
      const newSkills = [...prev.player.skills];
      const newLogs = [...prev.combatLogs];
      
      if (currentItem.type === 'skillBook' && currentItem.skillId) {
        const skillData = SKILL_DATA.find(s => s.id === currentItem.skillId);
        if (skillData && skillData.requiredClass && skillData.requiredClass !== prev.player.class) {
          newLogs.unshift(`你的職業無法學習此技能。`);
          return { ...prev, combatLogs: newLogs.slice(0, 50) };
        }
        if (prev.player.skills.includes(currentItem.skillId)) {
          newLogs.unshift(`你已經學會了這個技能。`);
          return { ...prev, combatLogs: newLogs.slice(0, 50) };
        }
        newSkills.push(currentItem.skillId);
        newLogs.unshift(`使用了 ${currentItem.name}，學會了技能：${skillData?.name}！`);
        
        if (currentInstance.quantity > 1) {
          newInventory[currentItemIndex] = { ...currentInstance, quantity: currentInstance.quantity - 1 };
        } else {
          newInventory.splice(currentItemIndex, 1);
        }
        return {
          ...prev,
          player: { ...prev.player, inventory: newInventory, skills: newSkills },
          combatLogs: newLogs.slice(0, 50)
        };
      } else if (currentItem.type === 'potion') {
        const newPlayer = { ...prev.player, inventory: newInventory, skills: newSkills };
        if (currentItem.id.includes('hp')) {
          newPlayer.hp = Math.floor(Math.min(newPlayer.maxHp, newPlayer.hp + 50));
          newLogs.unshift(`使用了 ${currentItem.name}，回復了 50 點 HP。`);
          lastSyncedHpRef.current = newPlayer.hp;
          
          // Broadcast heal if in world map
          if (prev.player?.isInWorld) {
            const worldChannel = (window as any).worldChannel;
            if (worldChannel) {
              worldChannel.send({
                type: 'broadcast',
                event: 'pvp_heal',
                payload: {
                  playerId: user.id,
                  playerName: prev.player.id,
                  newHp: newPlayer.hp
                }
              });
            }
          }
        } else if (currentItem.id.includes('mp')) {
          newPlayer.mp = Math.floor(Math.min(newPlayer.maxMp, newPlayer.mp + 30));
          newLogs.unshift(`使用了 ${currentItem.name}，回復了 30 點 MP。`);
        } else if (currentItem.id === 'haste_potion') {
          newLogs.unshift(`使用了 ${currentItem.name}，攻擊速度提升了！`);
          const existingBuffIndex = prev.activeBuffs.findIndex(b => b.id === 'haste_potion');
          let newBuffs = [...prev.activeBuffs];
          if (existingBuffIndex !== -1) {
            newBuffs[existingBuffIndex] = { ...newBuffs[existingBuffIndex], remaining: 30 };
          } else {
            newBuffs.push({ id: 'haste_potion', remaining: 30 });
          }

          if (currentInstance.quantity > 1) {
            newInventory[currentItemIndex] = { ...currentInstance, quantity: currentInstance.quantity - 1 };
          } else {
            newInventory.splice(currentItemIndex, 1);
          }

          const derived = calculateDerivedStats(newPlayer, newBuffs);
          newPlayer.meleeAtk = derived.meleeAtk;
          newPlayer.rangedAtk = derived.rangedAtk;
          newPlayer.magicAtk = derived.magicAtk;
          newPlayer.physDef = derived.physDef;
          newPlayer.magicDef = derived.magicDef;
          newPlayer.maxHp = derived.maxHp;
          newPlayer.maxMp = derived.maxMp;
          newPlayer.attackSpeed = derived.attackSpeed;
          newPlayer.evasion = derived.evasion;

          return {
            ...prev,
            player: newPlayer,
            combatLogs: newLogs.slice(0, 50),
            activeBuffs: newBuffs
          };
        }
        
        if (currentInstance.quantity > 1) {
          newInventory[currentItemIndex] = { ...currentInstance, quantity: currentInstance.quantity - 1 };
        } else {
          newInventory.splice(currentItemIndex, 1);
        }
        
        return {
          ...prev,
          player: newPlayer,
          combatLogs: newLogs.slice(0, 50)
        };
      } else {
        const newPlayer = { ...prev.player, inventory: newInventory, skills: newSkills };
        newLogs.unshift(`使用了 ${currentItem.name}，但什麼也沒發生。`);
        if (currentInstance.quantity > 1) {
          newInventory[currentItemIndex] = { ...currentInstance, quantity: currentInstance.quantity - 1 };
        } else {
          newInventory.splice(currentItemIndex, 1);
        }
        return {
          ...prev,
          player: newPlayer,
          combatLogs: newLogs.slice(0, 50),
        };
      }
    });
  };

  const equipItem = (instanceId: string) => {
    if (!state.player) return;
    
    // Find item to get its type/slot
    const instance = state.player.inventory.find(i => i.instanceId === instanceId);
    if (!instance) return;
    const item = ITEM_DATA.find(i => i.id === instance.id);
    if (!item) return;

    let slot: keyof Player['equipment'] | null = null;
    if (item.type === 'weapon') slot = 'weapon';
    else if (item.type === 'armor') slot = item.armorSlot as keyof Player['equipment'];
    else if (item.type === 'accessory') slot = 'accessory';

    if (!slot) return;
    if (state.player.equipment[slot] === instanceId) return; // Already equipped, prevent duplicate calls

    let shieldUnequipped = false;
    let weaponUnequipped = false;
    setState(prev => {
      if (!prev.player) return prev;
      const index = prev.player.inventory.findIndex(i => i.instanceId === instanceId);
      if (index === -1) return prev;
      const currentInstance = prev.player.inventory[index];
      const currentItem = ITEM_DATA.find(i => i.id === currentInstance.id);
      if (!currentItem) return prev;

      const newPlayer = { ...prev.player, equipment: { ...prev.player.equipment } };
      const newInventory = [...newPlayer.inventory];
      
      let equipInstanceId = instanceId;
      // If it's a stack, we split one off to equip it
      if (currentInstance.quantity > 1) {
        newInventory[index] = { ...currentInstance, quantity: currentInstance.quantity - 1 };
        equipInstanceId = Math.random().toString(36).substr(2, 9);
        newInventory.push({ ...currentInstance, instanceId: equipInstanceId, quantity: 1 });
      }

      // Handle 2H weapon and shield conflict
      if (slot === 'weapon' && currentItem.hands === 2) {
        if (newPlayer.equipment.shield) {
          newPlayer.equipment.shield = undefined;
          shieldUnequipped = true;
        }
      } else if (slot === 'shield') {
        const currentWeaponId = newPlayer.equipment.weapon;
        if (currentWeaponId) {
          const currentWeaponInstance = newPlayer.inventory.find(i => i.instanceId === currentWeaponId);
          if (currentWeaponInstance) {
            const weaponItem = ITEM_DATA.find(i => i.id === currentWeaponInstance.id);
            if (weaponItem && weaponItem.hands === 2) {
              newPlayer.equipment.weapon = undefined;
              weaponUnequipped = true;
            }
          }
        }
      }

      newPlayer.equipment[slot!] = equipInstanceId;
      newPlayer.inventory = newInventory;

      const derived = calculateDerivedStats(newPlayer, prev.activeBuffs);
      newPlayer.meleeAtk = derived.meleeAtk;
      newPlayer.rangedAtk = derived.rangedAtk;
      newPlayer.magicAtk = derived.magicAtk;
      newPlayer.physDef = derived.physDef;
      newPlayer.magicDef = derived.magicDef;
      newPlayer.maxHp = derived.maxHp;
      newPlayer.maxMp = derived.maxMp;
      newPlayer.attackSpeed = derived.attackSpeed;
      newPlayer.evasion = derived.evasion;

      return { ...prev, player: newPlayer };
    });

    if (shieldUnequipped) addLog('裝備雙手武器，自動卸下盾牌。');
    if (weaponUnequipped) addLog('裝備盾牌，自動卸下雙手武器。');

    addLog(`裝備了 ${getItemNameWithEnhancement(item, instance)}。`);
  };

  const unequipItem = (slot: keyof Player['equipment']) => {
    if (!state.player || !state.player.equipment[slot]) return;

    const instanceId = state.player.equipment[slot]!;
    const instance = state.player.inventory.find(i => i.instanceId === instanceId);
    const item = instance ? ITEM_DATA.find(i => i.id === instance.id) : null;
    const itemName = item ? getItemNameWithEnhancement(item, instance!) : '裝備';

    setState(prev => {
      if (!prev.player || !prev.player.equipment[slot]) return prev;
      const newPlayer = { ...prev.player, equipment: { ...prev.player.equipment } };
      newPlayer.equipment[slot] = undefined;

      const derived = calculateDerivedStats(newPlayer, prev.activeBuffs);
      newPlayer.meleeAtk = derived.meleeAtk;
      newPlayer.rangedAtk = derived.rangedAtk;
      newPlayer.magicAtk = derived.magicAtk;
      newPlayer.physDef = derived.physDef;
      newPlayer.magicDef = derived.magicDef;
      newPlayer.maxHp = derived.maxHp;
      newPlayer.maxMp = derived.maxMp;
      newPlayer.attackSpeed = derived.attackSpeed;
      newPlayer.evasion = derived.evasion;

      return { ...prev, player: newPlayer };
    });
    
    addLog(`卸下了 ${itemName}。`);
  };

  const enhanceItem = (scrollInstanceId: string, targetInstanceId: string) => {
    if (!state.player) return undefined;
    
    const newInventory = [...state.player.inventory];
    const scrollIndex = newInventory.findIndex(i => i.instanceId === scrollInstanceId);
    const targetIndex = newInventory.findIndex(i => i.instanceId === targetInstanceId);
    
    if (scrollIndex === -1 || targetIndex === -1) return undefined;
    
    const scrollInstance = newInventory[scrollIndex];
    const targetInstance = newInventory[targetIndex];
    
    const scrollItem = ITEM_DATA.find(i => i.id === scrollInstance.id);
    const targetItem = ITEM_DATA.find(i => i.id === targetInstance.id);
    
    if (!scrollItem || !targetItem || !scrollItem.isScroll) return undefined;
    let logMsg = '';
    let result: { success: boolean; destroyed: boolean; message: string } | undefined = undefined;
    
    if (scrollItem.scrollType === 'weapon' && targetItem.type !== 'weapon') {
      logMsg = '此卷軸只能用於武器！';
      result = { success: false, destroyed: false, message: logMsg };
      setState(prev => {
        if (!prev.player) return prev;
        return { ...prev, combatLogs: [logMsg, ...prev.combatLogs].slice(0, 50) };
      });
      return result;
    }
    if (scrollItem.scrollType === 'armor' && targetItem.type !== 'armor') {
      logMsg = '此卷軸只能用於防具！';
      result = { success: false, destroyed: false, message: logMsg };
      setState(prev => {
        if (!prev.player) return prev;
        return { ...prev, combatLogs: [logMsg, ...prev.combatLogs].slice(0, 50) };
      });
      return result;
    }
    
    if (targetInstance.enhancement >= 10) {
      logMsg = '該裝備已達到最高強化等級！';
      result = { success: false, destroyed: false, message: logMsg };
      setState(prev => {
        if (!prev.player) return prev;
        return { ...prev, combatLogs: [logMsg, ...prev.combatLogs].slice(0, 50) };
      });
      return result;
    }

    // Consume scroll
    if (scrollInstance.quantity > 1) {
      newInventory[scrollIndex] = { ...scrollInstance, quantity: scrollInstance.quantity - 1 };
    } else {
      newInventory.splice(scrollIndex, 1);
    }
    
    const { success, destroyed } = calculateEnhancement(targetInstance);
    
    let finalInventory = newInventory;
    if (success) {
      const newEnhancement = targetInstance.enhancement + 1;
      finalInventory = finalInventory.map(i => 
        i.instanceId === targetInstanceId ? { ...i, enhancement: newEnhancement } : i
      );
      logMsg = `★ 強化成功 ★ ${getItemNameWithEnhancement(targetItem, { ...targetInstance, enhancement: newEnhancement })}。`;
      result = { success: true, destroyed: false, message: logMsg };
    } else {
      if (destroyed) {
        finalInventory = finalInventory.filter(i => i.instanceId !== targetInstanceId);
        logMsg = `強化失敗！ ${getItemNameWithEnhancement(targetItem, targetInstance)} ，裝備竟然消失了！`;
        result = { success: false, destroyed: true, message: logMsg };
      } else {
        logMsg = `強化失敗... ${getItemNameWithEnhancement(targetItem, targetInstance)} 沒有任何改變。`;
        result = { success: false, destroyed: false, message: logMsg };
      }
    }

    const finalLogMsg = logMsg;
    const finalResult = result;
    const finalInventoryState = finalInventory;

    setState(prev => {
      if (!prev.player) return prev;
      
      const newPlayer = { ...prev.player, inventory: finalInventoryState };
      
      // Check if equipped item was destroyed
      const newEquipment = { ...newPlayer.equipment };
      let equipmentChanged = false;
      Object.keys(newEquipment).forEach(slot => {
        if (newEquipment[slot as keyof Player['equipment']] === targetInstanceId && !finalInventoryState.find(i => i.instanceId === targetInstanceId)) {
          newEquipment[slot as keyof Player['equipment']] = undefined;
          equipmentChanged = true;
        }
      });
      if (equipmentChanged) newPlayer.equipment = newEquipment;

      const derived = calculateDerivedStats(newPlayer, prev.activeBuffs);
      newPlayer.meleeAtk = derived.meleeAtk;
      newPlayer.rangedAtk = derived.rangedAtk;
      newPlayer.magicAtk = derived.magicAtk;
      newPlayer.physDef = derived.physDef;
      newPlayer.magicDef = derived.magicDef;
      newPlayer.maxHp = derived.maxHp;
      newPlayer.maxMp = derived.maxMp;
      newPlayer.attackSpeed = derived.attackSpeed;
      newPlayer.evasion = derived.evasion;

      // Local logging only, no Supabase required
      if (prev.player?.isInWorld && finalLogMsg) {
        // Handled locally in the combatLogs array
      }

      // Add to combat logs synchronously in the same state update
      const updatedCombatLogs = finalLogMsg 
        ? [finalLogMsg, ...prev.combatLogs].slice(0, 50) 
        : prev.combatLogs;

      return { 
        ...prev, 
        player: newPlayer,
        combatLogs: updatedCombatLogs
      };
    });

    return finalResult;
  };

  const setQuickItem = (slot: number, itemId: string | null) => {
    setState(prev => {
      if (!prev.player) return prev;
      const newQuickItems = [...prev.player.quickItems];
      newQuickItems[slot] = itemId;
      return {
        ...prev,
        player: { ...prev.player, quickItems: newQuickItems }
      };
    });
  };

  const setQuickSkill = (slot: number, skillId: string | null) => {
    setState(prev => {
      if (!prev.player) return prev;
      const newQuickSkills = [...prev.player.quickSkills];
      newQuickSkills[slot] = skillId;
      return {
        ...prev,
        player: { ...prev.player, quickSkills: newQuickSkills }
      };
    });
  };

  const useQuickItem = (slot: number) => {
    const itemId = state.player?.quickItems[slot];
    if (!itemId) return;
    
    const instance = state.player?.inventory.find(i => i.id === itemId);
    if (instance) {
      useItem(instance.instanceId);
    } else {
      addLog('道具已用完！');
    }
  };

  const learnSkill = (skillId: string) => {
    setState(prev => {
      if (!prev.player || prev.player.skills.includes(skillId)) return prev;
      
      const newSkills = [...prev.player.skills, skillId];
      const newQuickSkills = [...prev.player.quickSkills];
      const emptySlot = newQuickSkills.indexOf(null);
      if (emptySlot !== -1) {
        newQuickSkills[emptySlot] = skillId;
      }

      return {
        ...prev,
        player: {
          ...prev.player,
          skills: newSkills,
          quickSkills: newQuickSkills
        }
      };
    });
    const skill = SKILL_DATA.find(s => s.id === skillId);
    if (skill) addLog(`學會了新技能：${skill.name}！`);
  };

  const deleteCharacter = async () => {
    try {
      addLog('正在刪除角色...');
      
      localStorage.removeItem(STORAGE_KEY);
      
      // Reset state and ensure we trigger re-render
      setState({
        player: null,
        currentMap: null,
        currentSubMap: null,
        subMapEnemies: [],
        inCombat: false,
        currentEnemy: null,
        selectedEnemyInstanceId: null,
        combatLogs: ['角色已刪除。'],
        isAutoAttacking: false,
        activeBuffs: [],
        cooldowns: {},
        attackProgress: 0,
        timeInMap: 0,
        isWorldBossActive: false,
        worldBoss: null,
        worldPlayers: [],
        worldEnemies: [],
      });
      
      addLog('角色已成功刪除。');
    } catch (err) {
      console.error('Unexpected error during deletion:', err);
      // Even if cloud delete fails, we should clear local data
      localStorage.removeItem(STORAGE_KEY);
      setState(prev => ({ ...prev, player: null }));
      addLog('發生錯誤，但已清除本地資料。');
    }
  };

  const toggleAutoAttack = () => {
    setState(prev => ({ ...prev, isAutoAttacking: !prev.isAutoAttacking }));
  };

  const toggleAutoPlay = () => {
    setState(prev => {
      const nextPlay = !prev.isAutoPlay;
      return { 
        ...prev, 
        isAutoPlay: nextPlay,
        isAutoAttacking: nextPlay ? true : prev.isAutoAttacking
      };
    });
  };

  const restAtInn = () => {
    if (!state.player) return;
    const cost = state.player.level * 10;
    if (state.player.gold < cost) {
      addLog('金幣不足，無法在旅館休息。');
      return;
    }
    setState(prev => ({
      ...prev,
      player: prev.player ? {
        ...prev.player,
        hp: Math.floor(prev.player.maxHp),
        mp: Math.floor(prev.player.maxMp),
        gold: prev.player.gold - cost,
      } : null,
    }));
    addLog(`🛏️ 在旅館開了間舒適套房休息，體力與魔力完全恢復了！（花費 ${cost} 金幣）`);
  };

  const buyItem = (itemId: string) => {
    const item = ITEM_DATA.find(i => i.id === itemId);
    if (!item || !state.player) return;
    if (state.player.gold < item.price) {
      addLog('金幣不足！');
      return;
    }
    
    setState(prev => {
      if (!prev.player) return prev;
      const newInventory = [...prev.player.inventory];
      const isEquipment = item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory';
      const existingIndex = isEquipment ? -1 : newInventory.findIndex(i => 
        i.id === itemId && 
        i.enhancement === 0 && 
        !Object.values(prev.player!.equipment).includes(i.instanceId)
      );
      
      if (existingIndex !== -1) {
        newInventory[existingIndex] = { ...newInventory[existingIndex], quantity: (newInventory[existingIndex].quantity || 1) + 1 };
      } else {
        newInventory.push({ id: itemId, instanceId: Math.random().toString(36).substr(2, 9), enhancement: 0, quantity: 1 });
      }

      return {
        ...prev,
        player: {
          ...prev.player,
          gold: prev.player.gold - item.price,
          inventory: newInventory,
        },
      };
    });
    addLog(`購買了 ${item.name}。`);
  };

  const sellItem = (instanceId: string) => {
    if (!state.player) return;
    
    // Check if equipped
    const isEquipped = Object.values(state.player.equipment).some(id => id === instanceId);
    if (isEquipped) {
      addLog('無法賣出裝備中的道具！');
      return;
    }

    const index = state.player.inventory.findIndex(i => i.instanceId === instanceId);
    if (index === -1) return;
    const instance = state.player.inventory[index];
    const item = ITEM_DATA.find(i => i.id === instance.id);
    if (!item) return;
    
    const sellPrice = Math.floor(item.price * 0.5);
    const newInventory = [...state.player.inventory];
    if (instance.quantity > 1) {
      newInventory[index] = { ...instance, quantity: instance.quantity - 1 };
    } else {
      newInventory.splice(index, 1);
    }

    setState(prev => ({
      ...prev,
      player: {
        ...prev.player!,
        gold: prev.player!.gold + sellPrice,
        inventory: newInventory,
      },
    }));
    addLog(`賣出了 ${getItemNameWithEnhancement(item, instance)}，獲得了 ${sellPrice} 金幣。`);
  };

  const updateSettings = (settings: Partial<Player>) => {
    setState(prev => {
      if (!prev.player) return prev;
      return {
        ...prev,
        player: { ...prev.player, ...settings }
      };
    });
  };

  // Game Loop for Combat, Cooldowns, Respawn, and Movement
  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => {
        if (!prev.player) return prev;

        const TICK = 0.1;
        let newPlayer = { ...prev.player, inventory: [...prev.player.inventory] };
        let newLogs = [...prev.combatLogs];
        let newInCombat = prev.inCombat;
        let newAttackProgress = prev.attackProgress;

        // Cooldowns
        let newCooldowns = { ...prev.cooldowns };
        Object.keys(newCooldowns).forEach(key => {
          if (newCooldowns[key] > 0) newCooldowns[key] = Math.max(0, newCooldowns[key] - TICK);
        });

        // Buffs
        let newBuffs = prev.activeBuffs
          .map(b => ({ ...b, remaining: b.remaining - TICK }))
          .filter(b => b.remaining > 0);

        const derived = calculateDerivedStats(newPlayer, newBuffs);
        newPlayer.meleeAtk = derived.meleeAtk;
        newPlayer.rangedAtk = derived.rangedAtk;
        newPlayer.magicAtk = derived.magicAtk;
        newPlayer.physDef = derived.physDef;
        newPlayer.magicDef = derived.magicDef;
        newPlayer.maxHp = derived.maxHp;
        newPlayer.maxMp = derived.maxMp;
        newPlayer.attackSpeed = derived.attackSpeed;
        newPlayer.evasion = derived.evasion;

        // Time in map
        let newTimeInMap = prev.timeInMap + TICK;

        // Revamped Natural HP & MP Recovery Rates (10s Passive Tick Rate - Lineage Formula)
        const isRestingAtInn = newPlayer.activeTab === 'inn';
        
        const multiplier = isRestingAtInn ? 2 : 1;
        
        // Accumulate time or tick-based every 10 seconds (100 ticks since tick is 0.1s)
        const isRecoveryTick = Math.round(newTimeInMap * 10) % 100 === 0;

         if (isRecoveryTick) {
          const { hpRegen, mpRegen } = calculateLineageRegen(newPlayer);
          const finalHpRegen = hpRegen * multiplier;
          const finalMpRegen = mpRegen * multiplier;
          
          if (newPlayer.hp > 0 || isRestingAtInn) {
            const nextHp = (newPlayer.hp || 0) + (finalHpRegen || 0);
            const nextMp = (newPlayer.mp || 0) + (finalMpRegen || 0);
            newPlayer.hp = Math.min(newPlayer.maxHp || 100, isNaN(nextHp) ? 100 : parseFloat(nextHp.toFixed(2)));
            newPlayer.mp = Math.min(newPlayer.maxMp || 30, isNaN(nextMp) ? 30 : parseFloat(nextMp.toFixed(2)));
          }
        }

        // Respawn and Movement
        let newSubMapEnemies = prev.subMapEnemies.map(e => {
          let newE = { ...e };
          if (newE.respawnTimer > 0) {
            newE.respawnTimer = Math.max(0, newE.respawnTimer - TICK);
            if (newE.respawnTimer === 0) {
              newE.hp = newE.maxHp;
              newE.distance = Math.floor(Math.random() * 10) + 5;
            }
          } else if (!prev.inCombat || (prev.currentEnemy && prev.currentEnemy.instanceId !== e.instanceId)) {
            // Random movement if not in combat with this specific enemy
            if (Math.random() < 0.02) { // Adjusted for 100ms tick
              newE.distance = parseFloat(Math.max(1, Math.min(20, newE.distance + (Math.random() > 0.5 ? 1 : -1))).toFixed(1));
            }
            // Active enemies move towards player if close (within 10m)
            if (newE.behavior === 'active' && newE.distance > 1 && newE.distance <= 10) {
              if (Math.random() < 0.1) {
                newE.distance = parseFloat(Math.max(1, newE.distance - 0.2).toFixed(1)); // Approach by 0.2m instead of 1m
              }
            }
          }
          return newE;
        });

        // Boss Spawning Logic
        if (prev.currentSubMap) {
          const possibleBosses = prev.currentSubMap.enemies.filter(id => ENEMY_DATA[id].type === 'boss' || ENEMY_DATA[id].type === 'miniboss');
          possibleBosses.forEach(bossId => {
            const isAlreadySpawned = newSubMapEnemies.some(e => e.id === bossId && e.respawnTimer === 0);
            if (!isAlreadySpawned) {
              const base = ENEMY_DATA[bossId];
              // Spawn chance increases with time
              const spawnChance = 0.0005 + (newTimeInMap * 0.00005);
              if (Math.random() < spawnChance) {
                newSubMapEnemies.push({
                  ...base,
                  instanceId: `${bossId}-${Date.now()}`,
                  hp: base.maxHp,
                  mp: base.maxMp,
                  distance: 15,
                  respawnTimer: 0,
                });
                newLogs.unshift(`強大的氣息出現了！${base.name} 出現在地圖中！`);
              }
            }
          });
        }
        // Combat Logic
        let newWorldEnemies = [...prev.worldEnemies];
        let newEnemy = prev.currentEnemy;
        let combatResult;
        if (newPlayer.isInWorld) {
          combatResult = processWorldCombat(
            newPlayer,
            newWorldEnemies,
            newEnemy,
            newInCombat,
            newAttackProgress,
            newCooldowns,
            newBuffs,
            newLogs,
            TICK,
            prev.isAutoAttacking,
            calculateDerivedStats,
            playSound,
            prev
          );
        } else {
          combatResult = processAdventureCombat(
            newPlayer,
            newSubMapEnemies,
            newEnemy,
            newInCombat,
            newAttackProgress,
            newCooldowns,
            newBuffs,
            newLogs,
            TICK,
            prev.isAutoAttacking,
            calculateDerivedStats,
            playSound,
            prev
          );
        }

        if (combatResult.shouldReturn) {
          return combatResult.returnState;
        }

        newPlayer = combatResult.newPlayer;
        newSubMapEnemies = (combatResult as any).newSubMapEnemies || newSubMapEnemies;
        newWorldEnemies = (combatResult as any).newWorldEnemies || newWorldEnemies;
        newEnemy = combatResult.newEnemy;
        newLogs = combatResult.newLogs;
        newInCombat = combatResult.newInCombat;
        newAttackProgress = combatResult.newAttackProgress;
        newCooldowns = combatResult.newCooldowns;
        newBuffs = combatResult.newBuffs;

        if (newPlayer.hp !== prev.player.hp) {
          // Only update the sync ref if it was a local change we want to track
          // But actually, the game loop should NOT update lastSyncedHpRef.
          // lastSyncedHpRef should only be updated when we successfully sync to/from DB.
          // So we remove this line.
        }

        // MP Regen from Meditation
        const meditationBuff = newBuffs.find(b => b.id === 'meditation');
        if (meditationBuff) {
          newPlayer.mp = Math.floor(Math.min(newPlayer.maxMp, newPlayer.mp + (10 * TICK))); // 10 MP per second
        }

        // Auto Potion (Moved outside of combat check to work anytime)
        if (newPlayer.hp < (newPlayer.maxHp * newPlayer.autoPotionHpThreshold / 100)) {
          const potionIndex = newPlayer.inventory.findIndex(i => i.id === 'hp_potion_s');
          if (potionIndex !== -1) {
            const potion = newPlayer.inventory[potionIndex];
            newPlayer.hp = Math.floor(Math.min(newPlayer.maxHp, newPlayer.hp + 50));
            if (potion.quantity > 1) {
              newPlayer.inventory[potionIndex] = { ...potion, quantity: potion.quantity - 1 };
            } else {
              newPlayer.inventory.splice(potionIndex, 1);
            }
            newLogs.unshift('自動使用了小紅水！');
          }
        }

        if (newPlayer.mp < (newPlayer.maxMp * newPlayer.autoPotionMpThreshold / 100)) {
          const potionIndex = newPlayer.inventory.findIndex(i => i.id === 'mp_potion_s');
          if (potionIndex !== -1) {
            const potion = newPlayer.inventory[potionIndex];
            newPlayer.mp = Math.floor(Math.min(newPlayer.maxMp, newPlayer.mp + 30));
            if (potion.quantity > 1) {
              newPlayer.inventory[potionIndex] = { ...potion, quantity: potion.quantity - 1 };
            } else {
              newPlayer.inventory.splice(potionIndex, 1);
            }
            newLogs.unshift('自動使用了小藍水！');
          }
        }

        return {
          ...prev,
          player: newPlayer,
          currentEnemy: newEnemy,
          subMapEnemies: newSubMapEnemies,
          worldEnemies: newWorldEnemies,
          inCombat: newInCombat,
          cooldowns: newCooldowns,
          activeBuffs: newBuffs,
          attackProgress: newAttackProgress,
          combatLogs: newLogs.slice(0, 50),
          timeInMap: newTimeInMap,
        };
      });
    }, 100); // 100ms tick

    return () => clearInterval(timer);
  }, []);

  const playSound = (type: 'attack' | 'hit' | 'skill') => {
    // In a real app, we'd use actual audio files.
    // For now, we'll just log it or use a simple synth if possible.
    // console.log(`Playing sound: ${type}`);
  };

  return (
    <GameContext.Provider value={{ 
      ...state, 
      createCharacter, 
      selectMap, 
      startCombat, 
      cancelCombat, 
      setSelectedEnemy,
      useSkill, 
      useItem,
      equipItem,
      unequipItem,
      enhanceItem,
      setQuickItem,
      useQuickItem,
      toggleAutoAttack, 
      toggleAutoPlay,
      restAtInn, 
      buyItem, 
      sellItem, 
      updateSettings,
      addLog,
      learnSkill,
      setQuickSkill,
      deleteCharacter
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
};
