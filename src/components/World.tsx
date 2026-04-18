import React from 'react';
import { useGame } from '../context/GameContext';
import { SKILL_DATA } from '../data/skills';
import { ITEM_DATA } from '../data/items';
import { motion } from 'motion/react';
import { Skull, Swords, Zap, Shield, X, Users, Trophy } from 'lucide-react';

export const World: React.FC = () => {
  const { 
    worldEnemies,
    worldPlayers,
    worldBoss,
    startCombat, 
    inCombat, 
    currentEnemy,
    selectedEnemyInstanceId, 
    setSelectedEnemy,
    player,
    isAutoAttacking,
    toggleAutoAttack,
    useSkill,
    cooldowns,
    attackProgress,
    useQuickItem,
    activeBuffs
  } = useGame();

  if (!player) return null;

  const selectedEnemy = worldEnemies.find(e => e.instanceId === selectedEnemyInstanceId);
  
  const factionCounts = {
    Alfa: worldPlayers.filter(p => p.faction === 'Alfa' && p.isInWorld).length,
    Beta: worldPlayers.filter(p => p.faction === 'Beta' && p.isInWorld).length,
    Core: worldPlayers.filter(p => p.faction === 'Core' && p.isInWorld).length,
  };

  const sortedEnemies = [...worldEnemies]
    .filter(e => e.respawnTimer === 0)
    .sort((a, b) => {
      if (currentEnemy && a.instanceId === currentEnemy.instanceId) return -1;
      if (currentEnemy && b.instanceId === currentEnemy.instanceId) return 1;
      if (a.type === 'boss' && b.type !== 'boss') return -1;
      if (b.type === 'boss' && a.type !== 'boss') return 1;
      return a.distance - b.distance;
    });

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Top: World Info & Stats */}
      <div className="bg-slate-900 p-3 border-b border-slate-800 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <div>
            <p className="text-[8px] text-slate-500 uppercase font-bold">個人戰績</p>
            <p className="text-xs font-bold text-slate-300">擊殺: <span className="text-red-400">{player.pvpKills || 0}</span> / 死亡: <span className="text-slate-500">{player.pvpDeaths || 0}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <Users className="w-4 h-4 text-blue-500" />
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="text-blue-400">A:{factionCounts.Alfa}</span>
            <span className="text-green-400">B:{factionCounts.Beta}</span>
            <span className="text-white">C:{factionCounts.Core}</span>
          </div>
        </div>
      </div>

      {/* Middle: Enemy List (World Boss + Players) */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-slate-800">
        <div className="p-3 bg-slate-900/50 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">世界區域 (多人連線)</span>
          </div>
          {worldBoss && worldBoss.status !== 'active' && (
            <span className="text-[8px] text-slate-500 font-bold uppercase">
              BOSS 重生中: {new Date(worldBoss.nextSpawnTime).toLocaleTimeString()}
            </span>
          )}
        </div>
 
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedEnemies.map((enemy) => (
            <div 
              key={enemy.instanceId}
              onClick={() => {
                if (enemy.faction === player.faction) return; // Cannot target same faction
                setSelectedEnemy(enemy.instanceId === selectedEnemyInstanceId ? null : enemy.instanceId);
              }}
              className={`group relative bg-slate-900 border rounded-xl p-3 transition-all cursor-pointer ${
                enemy.instanceId === selectedEnemyInstanceId 
                  ? 'border-blue-500 bg-blue-900/10 shadow-lg shadow-blue-900/10' 
                  : 'border-slate-800 hover:border-slate-700'
              } ${enemy.faction === player.faction ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${enemy.instanceId === selectedEnemyInstanceId ? 'text-blue-400' : 'text-slate-200'}`}>
                      {enemy.name}
                    </span>
                    {enemy.type === 'boss' && <span className="text-[8px] bg-red-600 px-1 rounded text-white font-bold">WORLD BOSS</span>}
                    {enemy.isPlayer && (
                      <span className={`text-[8px] px-1 rounded text-white font-bold ${
                        enemy.faction === 'Alfa' ? 'bg-blue-600' : enemy.faction === 'Beta' ? 'bg-green-600' : 'bg-slate-500'
                      }`}>
                        PLAYER
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500" 
                        style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">距離: {enemy.distance}m</span>
                  </div>
                </div>
                
                {enemy.instanceId === selectedEnemyInstanceId && (
                  <div className="ml-4 text-blue-500">
                    <Shield className="w-4 h-4 fill-current" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {sortedEnemies.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-800 mx-auto" />
              <p className="text-slate-600 text-xs italic">目前附近沒有其他玩家或領主...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Combat Controls (Same as AdventureMap) */}
      <div className="h-64 bg-slate-900 p-4 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">戰鬥指令</span>
          </div>
          {selectedEnemy && (
            <div className="text-[10px] text-blue-400 font-bold flex items-center gap-2">
              鎖定中: {selectedEnemy.name} ({selectedEnemy.hp}/{selectedEnemy.maxHp})
              <button onClick={() => setSelectedEnemy(null)} className="text-slate-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4">
          {/* Main Actions */}
          <div className="col-span-4 flex flex-col gap-2">
            <button
              onClick={() => startCombat()}
              disabled={!selectedEnemy || inCombat}
              className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-xl font-bold transition-all relative overflow-hidden ${
                inCombat 
                  ? 'bg-red-600 text-white' 
                  : selectedEnemy 
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {inCombat && (
                <motion.div 
                  className="absolute bottom-0 left-0 h-1 bg-white/50"
                  initial={{ width: 0 }}
                  animate={{ width: `${attackProgress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              )}
              <Swords className="w-6 h-6" />
              <span className="text-xs">{inCombat ? '戰鬥中' : '普通攻擊'}</span>
            </button>
            {inCombat && (
              <button
                onClick={toggleAutoAttack}
                className={`py-2 rounded-lg text-[10px] font-bold transition-colors ${
                  isAutoAttacking ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isAutoAttacking ? '自動攻擊 ON' : '自動攻擊 OFF'}
              </button>
            )}
          </div>

          {/* Skills & Items Grid */}
          <div className="col-span-8 flex flex-col gap-2">
            {/* Buffs Display */}
            {activeBuffs.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {activeBuffs.map(buff => (
                  <div key={buff.id} className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] text-blue-400 flex items-center gap-1">
                    <Shield className="w-2 h-2" />
                    <span>{buff.id === 'haste_potion' ? '加速' : (buff.id === 'wind_walk' ? '風之疾走' : buff.id)}</span>
                    <span className="font-mono">{Math.ceil(buff.remaining)}s</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Skills */}
            <div className="grid grid-cols-4 gap-2">
              {player.quickSkills.map((skillId, i) => {
                const skill = skillId ? SKILL_DATA.find(s => s.id === skillId) : null;
                if (!skill) return (
                  <div key={i} className="aspect-square bg-slate-900/50 border border-slate-800 border-dashed rounded-lg flex items-center justify-center">
                    <span className="text-[8px] text-slate-700 italic">未設定</span>
                  </div>
                );
                
                const activeBuff = activeBuffs.find(b => b.id === skill.id);
                const isBuff = skill.type === 'buff';
                
                return (
                  <button
                    key={i}
                    onClick={() => useSkill(skill.id)}
                    disabled={(isBuff ? false : !inCombat) || (player?.mp || 0) < skill.mpCost || cooldowns[skill.id] > 0}
                    className="relative aspect-square bg-slate-800 rounded-lg border border-slate-700 flex flex-col items-center justify-center gap-1 hover:bg-slate-700 disabled:opacity-30 transition-all group overflow-hidden"
                  >
                    {isBuff ? (
                      <Shield className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <Zap className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[8px] text-center px-1 truncate w-full">{skill.name}</span>
                    {activeBuff && (
                      <div className="absolute top-0 right-0 bg-blue-500 text-[8px] px-1 rounded-bl rounded-tr font-mono z-10">
                        {Math.ceil(activeBuff.remaining)}s
                      </div>
                    )}
                    {cooldowns[skill.id] > 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold text-[10px]">{Math.ceil(cooldowns[skill.id])}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Items */}
            <div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-2">
              {player?.quickItems.map((itemId, i) => {
                const item = itemId ? ITEM_DATA.find(it => it.id === itemId) : null;
                const count = player?.inventory
                  .filter(it => it.id === itemId)
                  .reduce((sum, it) => sum + it.quantity, 0) || 0;
                
                return (
                  <button
                    key={i}
                    onClick={() => useQuickItem(i)}
                    disabled={!itemId || count === 0}
                    className="relative aspect-square bg-slate-900 border border-slate-800 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-slate-600 transition-all group"
                  >
                    <span className="absolute top-0 left-0 text-[8px] text-slate-600 p-1 font-mono">{i + 1}</span>
                    {item ? (
                      <>
                        <span className="text-[8px] text-center px-1 truncate w-full text-blue-400">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-500">{count}</span>
                      </>
                    ) : (
                      <span className="text-[8px] text-slate-700 italic">未設定</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
