import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAP_DATA } from '../data/maps';
import { SKILL_DATA } from '../data/skills';
import { ITEM_DATA } from '../data/items';
import { motion } from 'motion/react';
import { Skull, Swords, Zap, Shield, X, MapPin } from 'lucide-react';

export const AdventureMap: React.FC = () => {
  const { 
    currentMap, 
    currentSubMap, 
    selectMap, 
    subMapEnemies, 
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

  const [tempMapId, setTempMapId] = useState(currentMap?.id || '');
  const [tempSubMapId, setTempSubMapId] = useState(currentSubMap?.id || '');

  const handleEnterMap = () => {
    if (tempMapId && tempSubMapId) {
      selectMap(tempMapId, tempSubMapId);
    }
  };

  if (!currentSubMap) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center gap-8 bg-slate-900/20">
        <div className="text-center space-y-2">
          <MapPin className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">選擇冒險地圖</h2>
          <p className="text-slate-500 text-sm">準備好開始你的旅程了嗎？</p>
        </div>

        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">主地圖</label>
            <select 
              value={tempMapId} 
              onChange={(e) => {
                setTempMapId(e.target.value);
                const firstSub = MAP_DATA.find(m => m.id === e.target.value)?.subMaps[0].id || '';
                setTempSubMapId(firstSub);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">選擇主地圖</option>
              {MAP_DATA.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">區域</label>
            <select 
              value={tempSubMapId} 
              onChange={(e) => setTempSubMapId(e.target.value)}
              disabled={!tempMapId}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
            >
              <option value="">選擇區域</option>
              {MAP_DATA.find(m => m.id === tempMapId)?.subMaps.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleEnterMap}
            disabled={!tempMapId || !tempSubMapId}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            進入地圖
          </button>
        </div>
      </div>
    );
  }

  const selectedEnemy = subMapEnemies.find(e => e.instanceId === selectedEnemyInstanceId);
  const learnedSkills = player ? SKILL_DATA.filter(s => player.skills.includes(s.id)) : [];
  const activeSkills = learnedSkills.filter(s => s.type === 'active');
  const buffSkills = learnedSkills.filter(s => s.type === 'buff');

  const sortedEnemies = [...subMapEnemies]
    .filter(e => e.respawnTimer === 0)
    .sort((a, b) => {
      if (currentEnemy && a.instanceId === currentEnemy.instanceId) return -1;
      if (currentEnemy && b.instanceId === currentEnemy.instanceId) return 1;
      if (a.behavior === 'active' && b.behavior !== 'active') return -1;
      if (b.behavior === 'active' && a.behavior !== 'active') return 1;
      return a.distance - b.distance;
    });

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Top: Enemy List */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-slate-800">
        <div className="p-3 bg-slate-900/50 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">附近敵人 ({currentSubMap.name})</span>
          </div>
          <button 
            onClick={() => selectMap('', '')}
            className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> 離開地圖
          </button>
        </div>
 
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedEnemies.map((enemy) => (
            <div 
              key={enemy.instanceId}
              onClick={() => setSelectedEnemy(enemy.instanceId === selectedEnemyInstanceId ? null : enemy.instanceId)}
              className={`group relative bg-slate-900 border rounded-xl p-3 transition-all cursor-pointer ${
                enemy.instanceId === selectedEnemyInstanceId 
                  ? 'border-blue-500 bg-blue-900/10 shadow-lg shadow-blue-900/10' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${enemy.instanceId === selectedEnemyInstanceId ? 'text-blue-400' : 'text-slate-200'}`}>
                      {enemy.name}
                    </span>
                    {enemy.type === 'boss' && <span className="text-[8px] bg-red-600 px-1 rounded text-white font-bold">BOSS</span>}
                    {enemy.type === 'miniboss' && <span className="text-[8px] bg-purple-600 px-1 rounded text-white font-bold">MINI</span>}
                    {enemy.behavior === 'active' && <span className="text-[8px] bg-orange-600 px-1 rounded text-white">主動</span>}
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
                
                {enemy.respawnTimer > 0 && (
                  <div className="text-[10px] text-slate-500 font-mono ml-4">
                    {enemy.respawnTimer}s
                  </div>
                )}
                
                {enemy.instanceId === selectedEnemyInstanceId && enemy.respawnTimer === 0 && (
                  <div className="ml-4 text-blue-500">
                    <Shield className="w-4 h-4 fill-current" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Combat Controls */}
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
