import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CharacterClass, Faction, Stats, Enemy, Item, Skill, MainMap, SubMap, ItemInstance, Player, GameState, DerivedStats } from '../types';
import { CLASS_DATA } from '../data/classes';
import { MAP_DATA } from '../data/maps';
import { ENEMY_DATA } from '../data/enemies';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';
import { WORLD_BOSS_DATA } from '../data/worldBoss';
import { supabase } from '../supabase';
import { calculateDamage, calculateEnemyDamage, calculateDerivedStats } from '../utils/combatUtils';
import { handleExperienceGain } from '../logic/levelingLogic';
import { processAdventureCombat } from '../logic/adventureCombatLogic';
import { processWorldCombat } from '../logic/worldCombatLogic';

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
  enhanceItem: (scrollInstanceId: string, targetInstanceId: string) => void;
  setQuickItem: (slot: number, itemId: string | null) => void;
  setQuickSkill: (slot: number, skillId: string | null) => void;
  useQuickItem: (slot: number) => void;
  toggleAutoAttack: () => void;
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

  // Supabase Auth & Initial Player Fetch
  useEffect(() => {
    const initAuth = async () => {
      try {
        let currentUser = null;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          currentUser = session.user;
        } else {
          const { data: { user: newUser }, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          currentUser = newUser;
        }
        
        if (currentUser) {
          setUser(currentUser);
          // Fetch latest player data from Supabase to overwrite stale localStorage
          const { data: dbPlayer } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          
          if (dbPlayer) {
            console.log('Initial Player Data Fetched from DB:', dbPlayer);
            setState(prev => {
              const mappedPlayer: Player = {
                ...(prev.player || {}),
                ...dbPlayer,
                id: dbPlayer.name || prev.player?.id || '未知角色', // db.name is the character name
                uid: dbPlayer.id, // db.id is the UUID
                stats: typeof dbPlayer.stats === 'string' ? JSON.parse(dbPlayer.stats) : dbPlayer.stats,
                inventory: typeof dbPlayer.inventory === 'string' ? JSON.parse(dbPlayer.inventory) : dbPlayer.inventory,
                equipment: typeof dbPlayer.equipment === 'string' ? JSON.parse(dbPlayer.equipment) : dbPlayer.equipment,
              } as Player;

              lastSyncedHpRef.current = mappedPlayer.hp;
              return {
                ...prev,
                player: mappedPlayer
              };
            });
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
      }
    };

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        // Re-sign in anonymously if signed out
        supabase.auth.signInAnonymously();
      }
    });

    initAuth();

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  // Supabase User Sync (Real-time)
  useEffect(() => {
    if (!user || !state.player?.isInWorld) return;

    const channelId = `user-sync-${user.id}`;
    const userChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setState(prev => ({ ...prev, player: null }));
            return;
          }

          const data = payload.new as any;
          if (!data) return;
          
          setState(prev => {
            if (!prev.player) return prev;

            const remotePlayerHp = data.hp;
            const remoteLastAttackerName = data.lastAttackerName;
            
            const hpChanged = remotePlayerHp !== prev.player.hp;
            const isExternalDamage = remotePlayerHp < prev.player.hp && remotePlayerHp < (lastSyncedHpRef.current ?? Infinity);

            if (hpChanged) {
              console.log('User Sync HP Update:', { remoteHp: remotePlayerHp, isExternalDamage });
              
              let nextState = { 
                ...prev, 
                player: { 
                  ...prev.player, 
                  hp: remotePlayerHp,
                  lastAttackerName: remoteLastAttackerName || prev.player.lastAttackerName
                } 
              };

              // Auto-retaliate if external damage and not in combat
              if (isExternalDamage && !prev.inCombat && remoteLastAttackerName) {
                const attacker = prev.worldPlayers.find(p => p.id === remoteLastAttackerName || p.name === remoteLastAttackerName);
                if (attacker) {
                  const otherPlayerDerived = calculateDerivedStats(attacker, []);
                  let otherPlayerAtk = otherPlayerDerived.meleeAtk;
                  if (attacker.class === CharacterClass.ELF) otherPlayerAtk = otherPlayerDerived.rangedAtk;
                  if (attacker.class === CharacterClass.MAGE) otherPlayerAtk = otherPlayerDerived.magicAtk;

                  const attackerEnemy = {
                    id: attacker.id,
                    name: attacker.name || `玩家 (${attacker.faction})`,
                    type: 'normal' as const,
                    hp: attacker.hp,
                    maxHp: attacker.maxHp,
                    mp: attacker.mp,
                    maxMp: attacker.maxMp,
                    atk: otherPlayerAtk,
                    def: otherPlayerDerived.physDef,
                    range: 1,
                    exp: 100,
                    gold: 50,
                    behavior: 'passive' as const,
                    respawnTime: 10,
                    dropTable: [],
                    instanceId: `player-${attacker.id}`,
                    distance: 1, 
                    respawnTimer: 0,
                    isPlayer: true,
                    faction: attacker.faction,
                    targetUid: attacker.id,
                  };

                  nextState = {
                    ...nextState,
                    inCombat: true,
                    currentEnemy: attackerEnemy,
                    selectedEnemyInstanceId: attackerEnemy.instanceId,
                    isAutoAttacking: true
                  };
                }
              }
              
              lastSyncedHpRef.current = remotePlayerHp;
              return nextState;
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        console.log(`User Sync Channel Status for ${user.id}:`, status);
      });

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user, state.player?.isInWorld]);

  // Handle offline/leave
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user) {
        // Broadcast leave for immediate visibility update for others
        const worldChannel = (window as any).worldChannel;
        if (worldChannel) {
          worldChannel.send({
            type: 'broadcast',
            event: 'player_leave',
            payload: { playerId: user.id }
          });
        }
        await supabase.from('users').update({ 
          isInWorld: false, 
          lastUpdate: new Date().toISOString() 
        }).eq('id', user.id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  // Listen for World Logs - ONLY when in world
  useEffect(() => {
    if (!state.player?.isInWorld) return;

    const logsChannel = supabase
      .channel('world-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'world_logs'
        },
        (payload) => {
          const logData = payload.new as any;
          setState(prev => {
            if (prev.combatLogs.includes(logData.text)) return prev;
            return {
              ...prev,
              combatLogs: [logData.text, ...prev.combatLogs].slice(0, 50)
            };
          });
        }
      )
      .subscribe();

    // Initial logs fetch
    supabase.from('world_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setState(prev => {
            const newLogs = data.map(l => l.text).filter(t => !prev.combatLogs.includes(t));
            return {
              ...prev,
              combatLogs: [...newLogs, ...prev.combatLogs].slice(0, 50)
            };
          });
        }
      });

    return () => {
      supabase.removeChannel(logsChannel);
    };
  }, [state.player?.isInWorld]);

  // Supabase World Sync
  useEffect(() => {
    if (!state.player?.isInWorld || !user) return;

    const fetchInitialWorldData = async () => {
      const { data: bossData } = await supabase.from('world_boss').select('*').eq('id', 'boss').single();
      const { data: allPlayers } = await supabase.from('users').select('*').eq('deleted', false);
      
      setState(prev => {
        const players = allPlayers || [];
        const boss = bossData || prev.worldBoss;
        
        const playerEnemies = players
          .filter(p => p.id !== user.id && p.isInWorld)
          .map(p => {
            const otherPlayerDerived = calculateDerivedStats(p as Player, []);
            let otherPlayerAtk = otherPlayerDerived.meleeAtk;
            if (p.class === CharacterClass.ELF) otherPlayerAtk = otherPlayerDerived.rangedAtk;
            if (p.class === CharacterClass.MAGE) otherPlayerAtk = otherPlayerDerived.magicAtk;

            return {
              id: p.id,
              name: p.name || `玩家 (${p.faction})`,
              type: 'normal',
              hp: p.hp,
              maxHp: p.maxHp,
              mp: p.mp,
              maxMp: p.maxMp,
              atk: otherPlayerAtk,
              def: otherPlayerDerived.physDef,
              range: 1,
              exp: 100,
              gold: 50,
              behavior: 'passive',
              respawnTime: 10,
              dropTable: [],
              instanceId: `player-${p.id}`,
              distance: 15,
              respawnTimer: 0,
              isPlayer: true,
              faction: p.faction,
              targetUid: p.id,
            };
          });

        const bossEnemy = boss ? {
          ...WORLD_BOSS_DATA,
          hp: boss.hp,
          maxHp: boss.maxHp,
          instanceId: 'world_boss',
          distance: 15,
          respawnTimer: boss.status === 'active' ? 0 : 1,
        } : null;

        return {
          ...prev,
          worldBoss: boss,
          worldPlayers: players,
          worldEnemies: bossEnemy ? [bossEnemy, ...playerEnemies] : playerEnemies
        };
      });
    };

    fetchInitialWorldData();

    // ✅ World Boss Realtime
    const bossChannel = supabase
      .channel(`world-boss-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'world_boss',
          filter: 'id=eq.boss'
        },
        (payload) => {
          const bossData = payload.new as any;

          setState(prev => {
            const localBoss = prev.currentEnemy?.instanceId === 'world_boss' ? prev.currentEnemy : null;
            const bossHp = (localBoss && localBoss.hp < bossData.hp && (bossData.hp - localBoss.hp < 100)) ? localBoss.hp : bossData.hp;

            const bossEnemy = {
              ...WORLD_BOSS_DATA,
              hp: bossHp,
              maxHp: bossData.maxHp,
              instanceId: 'world_boss',
              distance: prev.currentEnemy?.instanceId === 'world_boss' ? prev.currentEnemy.distance : 15,
              respawnTimer: bossData.status === 'active' ? 0 : 1,
            };

            const playerEnemies = prev.worldPlayers
              .filter(p => p.id !== user.id && !p.deleted && p.isInWorld)
              .map(p => {
                const otherPlayerDerived = calculateDerivedStats(p as Player, []);
                let otherPlayerAtk = otherPlayerDerived.meleeAtk;
                if (p.class === CharacterClass.ELF) otherPlayerAtk = otherPlayerDerived.rangedAtk;
                if (p.class === CharacterClass.MAGE) otherPlayerAtk = otherPlayerDerived.magicAtk;

              const localEnemy = prev.currentEnemy?.instanceId === `player-${p.id}` ? prev.currentEnemy : null;
              // If database HP is significantly higher than local HP, it's likely a heal, so accept it.
              // We use 20 as a threshold (potions heal 50).
              const currentHp = (localEnemy && localEnemy.hp < p.hp && (p.hp - localEnemy.hp < 20)) 
                ? localEnemy.hp 
                : p.hp;

              return {
                id: p.id,
                name: p.name || `玩家 (${p.faction})`,
                type: 'normal',
                hp: currentHp,
                maxHp: p.maxHp,
                  mp: p.mp,
                  maxMp: p.maxMp,
                  atk: otherPlayerAtk,
                  def: otherPlayerDerived.physDef,
                  range: 1,
                  exp: 100,
                  gold: 50,
                  behavior: 'passive',
                  respawnTime: 10,
                  dropTable: [],
                  instanceId: `player-${p.id}`,
                  distance: prev.currentEnemy?.instanceId === `player-${p.id}` ? prev.currentEnemy.distance : 15,
                  respawnTimer: 0,
                  isPlayer: true,
                  faction: p.faction,
                  targetUid: p.id,
                };
              });

            return {
              ...prev,
              worldBoss: bossData,
              worldEnemies: [bossEnemy, ...playerEnemies]
            };
          });
        }
      )
      .subscribe();

    // ✅ Players Realtime & Broadcasts (Shared channel for broadcasts)
    const playersChannel = supabase
      .channel('world-map-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          const newData = payload.new as any;
          console.log('Players Channel Payload Received:', payload.eventType, newData?.id);
          
          setState(prev => {
            let updatedPlayers = [...prev.worldPlayers];
            const oldData = payload.old as any;

            if (payload.eventType === 'INSERT') {
              if (!updatedPlayers.find(p => p.id === newData.id)) {
                updatedPlayers.push({ ...newData, lastSeen: Date.now() });
              }
            } else if (payload.eventType === 'UPDATE') {
              const index = updatedPlayers.findIndex(p => p.id === newData.id);
              if (index !== -1) {
                // Merge new data into existing player object
                updatedPlayers[index] = { 
                  ...updatedPlayers[index], 
                  ...newData,
                  lastSeen: Date.now() 
                };
              } else if (newData.isInWorld) {
                // If not in list but now in world, add them
                updatedPlayers.push({ ...newData, lastSeen: Date.now() });
              }
            } else if (payload.eventType === 'DELETE') {
              updatedPlayers = updatedPlayers.filter(p => p.id !== oldData.id);
            }

            // Filter for players currently in world
            // Be robust: check isInWorld explicitly, and also filter out stale players
            const now = Date.now();
            
            // Periodic cleanup of the main worldPlayers state to prevent memory bloat
            const cleanedWorldPlayers = updatedPlayers.filter(p => 
              p.lastSeen ? (now - p.lastSeen < 120000) : true // 2 min hard timeout for state
            );

            const inWorldPlayers = cleanedWorldPlayers.filter(p => 
              p.id !== user.id && 
              p.isInWorld === true && 
              !p.deleted &&
              (p.lastSeen ? (now - p.lastSeen < 60000) : true) // 60s timeout for visibility
            );

            const playerEnemies = inWorldPlayers.map(p => {
              const otherPlayerDerived = calculateDerivedStats(p as Player, []);
              let otherPlayerAtk = otherPlayerDerived.meleeAtk;
              if (p.class === CharacterClass.ELF) otherPlayerAtk = otherPlayerDerived.rangedAtk;
              if (p.class === CharacterClass.MAGE) otherPlayerAtk = otherPlayerDerived.magicAtk;

              const localEnemy = prev.currentEnemy?.instanceId === `player-${p.id}` ? prev.currentEnemy : null;
              // If database HP is significantly higher than local HP, it's likely a heal, so accept it.
              const currentHp = (localEnemy && localEnemy.hp < p.hp && (p.hp - localEnemy.hp < 20)) 
                ? localEnemy.hp 
                : p.hp;

              return {
                id: p.id,
                name: p.name || `玩家 (${p.faction})`,
                type: 'normal' as const,
                hp: currentHp,
                maxHp: p.maxHp,
                mp: p.mp,
                maxMp: p.maxMp,
                atk: otherPlayerAtk,
                def: otherPlayerDerived.physDef,
                range: 1,
                exp: 100,
                gold: 50,
                behavior: 'passive' as const,
                respawnTime: 10,
                dropTable: [],
                instanceId: `player-${p.id}`,
                distance: prev.currentEnemy?.instanceId === `player-${p.id}` ? prev.currentEnemy.distance : 15,
                respawnTimer: 0,
                isPlayer: true,
                faction: p.faction,
                targetUid: p.id,
              };
            });

            const bossData = prev.worldBoss;
            const localBoss = prev.currentEnemy?.instanceId === 'world_boss' ? prev.currentEnemy : null;
            const bossHp = (bossData && localBoss && localBoss.hp < bossData.hp && (bossData.hp - localBoss.hp < 100)) ? localBoss.hp : (bossData?.hp || 0);

            const bossEnemy = bossData
              ? {
                  ...WORLD_BOSS_DATA,
                  hp: bossHp,
                  maxHp: bossData.maxHp,
                  instanceId: 'world_boss',
                  distance: prev.currentEnemy?.instanceId === 'world_boss' ? prev.currentEnemy.distance : 15,
                  respawnTimer: bossData.status === 'active' ? 0 : 1,
                }
              : null;

            return {
              ...prev,
              worldPlayers: cleanedWorldPlayers,
              worldEnemies: bossEnemy ? [bossEnemy, ...playerEnemies] : playerEnemies
            };
          });
        }
      )
      .on(
        'broadcast',
        { event: 'pvp_damage' },
        (payload) => {
          const { victimId, attackerName, damage, newHp } = payload.payload;
          if (victimId === user.id) {
            const timestamp = new Date().toLocaleTimeString();
            const pvpLog = `[${timestamp}] 你受到了來自 ${attackerName} 的 ${damage} 點傷害！ (廣播)`;
            console.log('PvP Broadcast Received:', pvpLog);
            
            setState(prev => {
              if (!prev.player) return prev;
              // Use local HP minus damage to ensure heals are preserved.
              // The attacker's newHp might be based on stale data.
              const updatedHp = Math.max(0, prev.player.hp - (damage || 0));
              
              // Also update the sync ref to prevent the next sync from overwriting this damage
              lastSyncedHpRef.current = updatedHp;
              
              return {
                ...prev,
                player: { ...prev.player, hp: updatedHp },
                combatLogs: [pvpLog, ...prev.combatLogs].slice(0, 50)
              };
            });
          } else {
            // If we are attacking this person, update our local enemy state immediately
            setState(prev => {
              if (prev.currentEnemy?.targetUid === victimId) {
                return {
                  ...prev,
                  currentEnemy: {
                    ...prev.currentEnemy,
                    hp: Math.max(0, newHp !== undefined ? newHp : prev.currentEnemy.hp - damage)
                  }
                };
              }
              return prev;
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'pvp_heal' },
        (payload) => {
          const { playerId, playerName, newHp } = payload.payload;
          if (playerId !== user.id) {
            console.log('PvP Heal Broadcast Received:', playerName, newHp);
            setState(prev => {
              // Update worldPlayers
              const updatedWorldPlayers = prev.worldPlayers.map(p => 
                p.id === playerId ? { ...p, hp: newHp } : p
              );

              // Update currentEnemy if it's the one who healed
              let updatedCurrentEnemy = prev.currentEnemy;
              if (prev.currentEnemy?.targetUid === playerId) {
                updatedCurrentEnemy = {
                  ...prev.currentEnemy,
                  hp: newHp
                };
              }

              return {
                ...prev,
                worldPlayers: updatedWorldPlayers,
                currentEnemy: updatedCurrentEnemy
              };
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'pvp_death' },
        (payload) => {
          const { playerId, playerName, attackerName } = payload.payload;
          if (playerId !== user.id) {
            console.log('PvP Death Broadcast Received:', playerName, 'killed by', attackerName);
            
            const isAttacker = attackerName === state.player?.id;
            const timestamp = new Date().toLocaleTimeString();
            const logMsg = isAttacker 
              ? `[${timestamp}] 你擊敗了玩家 ${playerName}！ (廣播)`
              : `[${timestamp}] 玩家 ${playerName} 被 ${attackerName} 擊敗了。`;

            setState(prev => {
              // Update worldPlayers: remove them or set HP to 0
              const updatedWorldPlayers = prev.worldPlayers.filter(p => p.id !== playerId);

              // If we were attacking them, stop and show log
              let updatedEnemy = prev.currentEnemy;
              let updatedInCombat = prev.inCombat;
              let updatedAutoAttacking = prev.isAutoAttacking;
              let updatedLogs = [...prev.combatLogs];

              if (prev.currentEnemy?.targetUid === playerId) {
                updatedEnemy = null;
                updatedInCombat = false;
                updatedAutoAttacking = false;
                updatedLogs = [logMsg, ...prev.combatLogs].slice(0, 50);
              }

              // Also update pvpKills if we are the attacker
              const updatedPlayer = isAttacker && prev.player 
                ? { ...prev.player, pvpKills: (prev.player.pvpKills || 0) + 1 }
                : prev.player;

              return {
                ...prev,
                player: updatedPlayer,
                worldPlayers: updatedWorldPlayers,
                currentEnemy: updatedEnemy,
                inCombat: updatedInCombat,
                isAutoAttacking: updatedAutoAttacking,
                combatLogs: updatedLogs
              };
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'player_leave' },
        (payload) => {
          const { playerId } = payload.payload;
          console.log('Player Leave Broadcast Received:', playerId);
          setState(prev => ({
            ...prev,
            worldPlayers: prev.worldPlayers.filter(p => p.id !== playerId)
          }));
        }
      )
      .subscribe((status) => {
        console.log(`World Sync Channel Status for ${user.id}:`, status);
        if (status === 'SUBSCRIBED') {
          // Store channel in ref for broadcasting
          (window as any).worldChannel = playersChannel;
        }
      });

    return () => {
      supabase.removeChannel(bossChannel);
      supabase.removeChannel(playersChannel);
      (window as any).worldChannel = null;
    };
  }, [state.player?.isInWorld, user?.id]);

  // Sync player to Supabase - ONLY when in world (or just left)
  useEffect(() => {
    const syncPlayer = async () => {
      if (!state.player || !user) return;
      
      const now = Date.now();
      const isCriticalChange = state.player.hp <= 0 || state.player.isInWorld !== lastInWorldRef.current;
      
      // If player just left the world, broadcast it for immediate visibility update
      if (lastInWorldRef.current === true && state.player.isInWorld === false) {
        const worldChannel = (window as any).worldChannel;
        if (worldChannel) {
          worldChannel.send({
            type: 'broadcast',
            event: 'player_leave',
            payload: { playerId: user.id }
          });
        }
      }
      
      if (isCriticalChange) {
        console.log('Critical Sync Triggered:', { 
          hp: state.player.hp, 
          isInWorld: state.player.isInWorld, 
          prevInWorld: lastInWorldRef.current 
        });
      }

      // Debounce non-critical syncs (max once per 2 seconds)
      if (!isCriticalChange && now - lastSyncedAtRef.current < 2000) {
        return;
      }

      // Only sync if currently in world OR if we just left the world
      if (!state.player.isInWorld && !lastInWorldRef.current) return;
      
      const prevInWorld = lastInWorldRef.current;
      lastInWorldRef.current = state.player.isInWorld;
      
      const currentHp = state.player.hp;
      const prevSyncedHp = lastSyncedHpRef.current;

      // 🛡️ HP Sync Protection:
      // If in world map and HP decreased, don't sync HP in this debounced loop.
      // This prevents local state from overwriting PvP damage before the listener can process it.
      // We only sync HP if it increased (healing/regen) or if we are not in the world map (adventure combat).
      const isHealing = currentHp > (prevSyncedHp ?? 0);
      const shouldSyncHp = !state.player.isInWorld || isHealing;

      // Sync player to Supabase using the exact schema provided by the user
      const syncData: any = { 
        id: user.id, 
        name: state.player.id, // Use character ID as name in database
        class: state.player.class,
        faction: state.player.faction,
        level: state.player.level,
        exp: state.player.exp,
        nextLevelExp: state.player.nextLevelExp,
        hp: currentHp,
        maxHp: state.player.maxHp,
        mp: state.player.mp,
        maxMp: state.player.maxMp,
        gold: state.player.gold,
        pvpKills: state.player.pvpKills,
        pvpDeaths: state.player.pvpDeaths,
        isInWorld: state.player.isInWorld,
        inventory: state.player.inventory,
        equipment: state.player.equipment,
        stats: state.player.stats,
        skills: state.player.skills,
        quickItems: state.player.quickItems,
        quickSkills: state.player.quickSkills,
        autoSkills: state.player.autoSkills,
        lastAttackerName: state.player.lastAttackerName || null,
        deleted: state.player.deleted || false,
        lastUpdate: new Date().toISOString()
      };

      if (!shouldSyncHp) {
        console.log('Skipping HP sync to prevent overwriting damage:', { currentHp, prevSyncedHp });
        delete syncData.hp;
      }

      // If we are in the world, use a conditional update to avoid overwriting PvP damage.
      if (prevSyncedHp !== null && state.player.isInWorld && prevInWorld) {
        const { data, error } = await supabase
          .from('users')
          .update(syncData)
          .eq('id', user.id)
          .eq('hp', prevSyncedHp)
          .select();

        if (error) {
          if (error.code === 'PGRST116') {
            await supabase.from('users').upsert(syncData);
          } else {
            console.error('Conditional sync failed:', error);
          }
        } else if (!data || data.length === 0) {
          console.log('HP in DB has changed (PvP damage?), skipping sync to avoid overwrite.');
          lastSyncedAtRef.current = 0; 
          return;
        }
      } else {
        await supabase.from('users').upsert(syncData);
      }

      // Only update the sync ref if we actually synced the HP
      if (shouldSyncHp) {
        lastSyncedHpRef.current = currentHp;
      }
      lastSyncedAtRef.current = now;
    };
    syncPlayer();
  }, [state.player, user]);

  // Save to localStorage whenever player data changes
  useEffect(() => {
    if (state.player) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.player));
    }
  }, [state.player]);

  const addLog = useCallback((log: string) => {
    setState(prev => {
      const newLogs = [log, ...prev.combatLogs].slice(0, 50);
      
      // If in world, sync log to Supabase
      if (prev.player?.isInWorld) {
        supabase.from('world_logs').insert({
          text: log,
          faction: prev.player.faction,
        });
      }

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

    const quickSkills: (string | null)[] = [null, null, null, null];
    initialSkills.forEach((skillId, i) => {
      if (i < 4) quickSkills[i] = skillId;
    });

    const player: Player = {
      id,
      uid: '', // Will be updated after getting user
      class: charClass,
      faction,
      level: 1,
      exp: 0,
      nextLevelExp: 100,
      hp: 30 + stats.con * 1,
      maxHp: 30 + stats.con * 1,
      mp: 10 + stats.int * 1,
      maxMp: 10 + stats.int * 1,
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
      quickItems: [null, null, null, null],
      quickSkills,
      attackSpeed: 0.5,
      autoPotionHpThreshold: 30,
      autoPotionMpThreshold: 20,
      autoSkills: [],
      pvpKills: 0,
      pvpDeaths: 0,
    };
    setState(prev => ({ ...prev, player }));
    addLog(`歡迎來到這個世界，${id}！你選擇了${faction}陣營與${charClass}職業。`);

    // Save to Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const playerWithUid = { ...player, uid: user.id };
        setState(prev => ({ ...prev, player: playerWithUid }));
        // Create character in Supabase using the exact schema provided by the user
        supabase.from('users').upsert({ 
          id: user.id, 
          name: player.id,
          class: player.class,
          faction: player.faction,
          level: player.level,
          exp: player.exp,
          nextLevelExp: player.nextLevelExp,
          hp: player.hp,
          maxHp: player.maxHp,
          mp: player.mp,
          maxMp: player.maxMp,
          gold: player.gold,
          pvpKills: 0,
          pvpDeaths: 0,
          isInWorld: player.isInWorld,
          inventory: player.inventory,
          equipment: player.equipment,
          stats: player.stats,
          skills: player.skills,
          quickItems: player.quickItems,
          quickSkills: player.quickSkills,
          autoSkills: player.autoSkills,
          deleted: false,
          lastUpdate: new Date().toISOString()
        });
      }
    });
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
      
      return {
        ...prev,
        selectedEnemyInstanceId: instanceId,
        currentEnemy: enemy || null,
        inCombat: false,
        isAutoAttacking: false,
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
          if (item && item.range) weaponRange = item.range;
        }
      }
      
      const effectiveRange = skill.range || weaponRange;
      
      if (currentEnemy.distance > effectiveRange) {
        addLog(`距離太遠！ ${skill.name} 無法觸及敵人。 (距離: ${currentEnemy.distance}m)`);
        return;
      }

      playSound('skill');
      const result = skill.effect(player, currentEnemy);
      // Use floating damage
      const damage = calculateDamage(result.damage + currentEnemy.def, currentEnemy.def);
      const newEnemyHp = Math.floor(Math.max(0, currentEnemy.hp - damage));
      addLog(`使用了 ${skill.name}，對 ${currentEnemy.name} 造成了 ${damage} 點傷害！ (距離: ${currentEnemy.distance}m)`);
      
      // PvP Sync: Update other player's HP in Supabase
      if (currentEnemy.instanceId.startsWith('player-') && currentEnemy.targetUid) {
        supabase.from('users').update({ 
          hp: newEnemyHp, 
          lastAttackerName: player.id 
        }).eq('id', currentEnemy.targetUid);
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
    let logMsg = '';
    setState(prev => {
      if (!prev.player) return prev;
      const newInventory = [...prev.player.inventory];
      const scrollIndex = newInventory.findIndex(i => i.instanceId === scrollInstanceId);
      const targetIndex = newInventory.findIndex(i => i.instanceId === targetInstanceId);
      
      if (scrollIndex === -1 || targetIndex === -1) return prev;
      
      const scrollInstance = newInventory[scrollIndex];
      const targetInstance = newInventory[targetIndex];
      
      const scrollItem = ITEM_DATA.find(i => i.id === scrollInstance.id);
      const targetItem = ITEM_DATA.find(i => i.id === targetInstance.id);
      
      if (!scrollItem || !targetItem || !scrollItem.isScroll) return prev;
      if (scrollItem.scrollType === 'weapon' && targetItem.type !== 'weapon') {
        logMsg = '此卷軸只能用於武器！';
        return prev;
      }
      if (scrollItem.scrollType === 'armor' && targetItem.type !== 'armor') {
        logMsg = '此卷軸只能用於防具！';
        return prev;
      }
      
      if (targetInstance.enhancement >= 10) {
        logMsg = '該裝備已達到最高強化等級！';
        return prev;
      }

      // Consume scroll
      if (scrollInstance.quantity > 1) {
        newInventory[scrollIndex] = { ...scrollInstance, quantity: scrollInstance.quantity - 1 };
      } else {
        newInventory.splice(scrollIndex, 1);
      }
      
      const successChance = 1.0 - (targetInstance.enhancement * 0.1);
      const success = Math.random() < successChance;
      
      let finalInventory = newInventory;
      if (success) {
        const newEnhancement = targetInstance.enhancement + 1;
        finalInventory = finalInventory.map(i => 
          i.instanceId === targetInstanceId ? { ...i, enhancement: newEnhancement } : i
        );
        logMsg = `強化成功！${getItemNameWithEnhancement(targetItem, { ...targetInstance, enhancement: newEnhancement })}。`;
      } else {
        // Destruction chance on failure
        const destructionChance = targetInstance.enhancement * 0.05; // e.g. +5 has 25% destruction chance on failure
        if (Math.random() < destructionChance) {
          finalInventory = finalInventory.filter(i => i.instanceId !== targetInstanceId);
          logMsg = `強化失敗... ${getItemNameWithEnhancement(targetItem, targetInstance)} 竟然消失了！`;
        } else {
          logMsg = `強化失敗... ${getItemNameWithEnhancement(targetItem, targetInstance)} 的強化等級沒有改變。`;
        }
      }

      const newPlayer = { ...prev.player, inventory: finalInventory };
      
      // Check if equipped item was destroyed
      const newEquipment = { ...newPlayer.equipment };
      let equipmentChanged = false;
      Object.keys(newEquipment).forEach(slot => {
        if (newEquipment[slot as keyof Player['equipment']] === targetInstanceId && !finalInventory.find(i => i.instanceId === targetInstanceId)) {
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

      return { ...prev, player: newPlayer };
    });
    if (logMsg) addLog(logMsg);
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
      if (user) {
        addLog('正在從雲端刪除角色...');
        // Soft delete from Supabase
        await supabase
          .from('users')
          .update({ deleted: true })
          .eq('id', user.id);
      }
      
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

  const restAtInn = () => {
    if (!state.player) return;
    const cost = state.player.level * 10;
    if (state.player.gold < cost) {
      addLog('金幣不足，無法在旅館休息。');
      return;
    }
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player!,
        hp: Math.floor(prev.player!.maxHp),
        mp: Math.floor(prev.player!.maxMp),
        gold: prev.player!.gold - cost,
      },
    }));
    addLog(`在旅館休息了一晚，體力與魔力完全恢復了。（花費 ${cost} 金幣）`);
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
              newE.distance = Math.max(1, Math.min(20, newE.distance + (Math.random() > 0.5 ? 1 : -1)));
            }
            // Active enemies move towards player if close (within 10m)
            if (newE.behavior === 'active' && newE.distance > 1 && newE.distance <= 10) {
              if (Math.random() < 0.1) newE.distance -= 1; // Adjusted for 100ms tick
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
