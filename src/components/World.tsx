import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SKILL_DATA } from '../data/skills';
import { ITEM_DATA } from '../data/items';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Swords, Zap, Shield, X, Users, Trophy, Settings as SettingsIcon, Trash2, ArrowRight } from 'lucide-react';

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
    toggleAutoPlay,
    isAutoPlay,
    useSkill,
    cooldowns,
    attackProgress,
    useQuickItem,
    activeBuffs
  } = useGame();

  const [quickPage, setQuickPage] = useState<number>(0);

  if (!player) return null;

  const handleEnemySelection = (enemy: any) => {
    if (enemy.faction === player.faction) return; // Cannot target same faction
    
    // Snappy switching: Keep fight active, just translate lock-on target
    if (inCombat) {
      setSelectedEnemy(enemy.instanceId);
    } else {
      setSelectedEnemy(enemy.instanceId === selectedEnemyInstanceId ? null : enemy.instanceId);
    }
  };

  const selectedEnemy = worldEnemies.find(e => e.instanceId === selectedEnemyInstanceId);
  const learnedSkills = SKILL_DATA.filter(s => player.skills.includes(s.id));

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
      return 0;
    });

  return (
    <div className="h-full flex flex-col bg-slate-950 relative">
      {/* Top: World Info & Faction Stats */}
      <div className="bg-slate-900 border-b border-slate-800/80 grid grid-cols-2 gap-4 p-3 font-sans select-none">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-yellow-500 animate-pulse" />
          <div>
            <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">個人擊殺/戰敗</p>
            <p className="text-xs font-bold text-slate-200">
              擊殺: <span className="text-emerald-500">{player.pvpKills || 0}</span> / 死亡: <span className="text-rose-500">{player.pvpDeaths || 0}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end leading-none">
          <Users className="w-4 h-4 text-blue-500" />
          <div className="flex gap-2 text-[10px] font-black tracking-wider uppercase">
            <span className="text-blue-400 bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-900/10">Alfa:{factionCounts.Alfa}</span>
            <span className="text-green-400 bg-green-950/20 px-1.5 py-0.5 rounded border border-green-900/10">Beta:{factionCounts.Beta}</span>
            <span className="text-stone-300 bg-slate-950/20 px-1.5 py-0.5 rounded border border-slate-905/10">Core:{factionCounts.Core}</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Enemy List */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Nearby Active Targets Screen */}
        <div className="p-2 border-b border-slate-900 bg-slate-950 flex justify-between items-center px-4 self-stretch select-none">
          <div className="flex items-center gap-1.5">
            <Skull className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">世界區域目標 ({sortedEnemies.length})</span>
          </div>

        </div>

        {/* Scrollable Enemy Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 select-none">
          {sortedEnemies.map((enemy) => {
            const isSelected = enemy.instanceId === selectedEnemyInstanceId;
            const isCombatTarget = inCombat && currentEnemy && enemy.instanceId === currentEnemy.instanceId;
            const isSameFaction = enemy.isPlayer && enemy.faction === player.faction;

            return (
              <div 
                key={enemy.instanceId}
                onClick={() => !isSameFaction && handleEnemySelection(enemy)}
                className={`group relative bg-slate-900/60 border rounded-xl p-3 transition-all ${
                  isSameFaction 
                    ? 'opacity-40 grayscale cursor-not-allowed border-slate-950/20'
                    : isCombatTarget 
                      ? 'border-red-500/40 bg-red-950/10 shadow-lg shadow-red-950/10 cursor-pointer'
                      : isSelected 
                        ? 'border-blue-500/40 bg-blue-900/10 shadow-lg shadow-blue-900/10 cursor-pointer' 
                        : 'border-slate-800/80 hover:border-slate-700 cursor-pointer'
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-extrabold text-sm ${
                        isCombatTarget ? 'text-red-400' : isSelected ? 'text-blue-400' : 'text-slate-200'
                      }`}>
                        {enemy.name}
                      </span>
                      {enemy.type === 'boss' && <span className="text-[8px] bg-red-600 px-1.5 py-0.5 rounded text-white font-black leading-none uppercase">WORLD BOSS</span>}
                      {enemy.isPlayer && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded text-white font-black leading-none uppercase ${
                          enemy.faction === 'Alfa' ? 'bg-blue-600' : enemy.faction === 'Beta' ? 'bg-green-600' : 'bg-stone-500'
                        }`}>
                          {enemy.faction} 陣營
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${isCombatTarget ? 'bg-red-500' : 'bg-blue-500'}`} 
                          style={{ width: `${(enemy.maxHp && !isNaN(enemy.hp) && !isNaN(enemy.maxHp)) ? Math.min(100, Math.max(0, (enemy.hp / enemy.maxHp) * 100)) : 0}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold shrink-0">
                        HP: {isNaN(enemy.hp) ? 0 : Math.floor(enemy.hp)} / {enemy.maxHp || 0}
                      </span>
                    </div>
                  </div>

                  {!isSameFaction && (
                    <div className="shrink-0 pl-1.5">
                      {isCombatTarget ? (
                        <div className="bg-red-600/20 text-red-400 p-1.5 rounded-full border border-red-500/20 animate-pulse">
                          <Swords className="w-4 h-4" />
                        </div>
                      ) : isSelected ? (
                        <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-full border border-blue-500/20">
                          <Shield className="w-4 h-4 fill-current" />
                        </div>
                      ) : (
                        <div className="text-slate-600 group-hover:text-slate-450 transition-colors">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {sortedEnemies.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-800 mx-auto" />
              <p className="text-slate-600 text-xs italic">目前附近沒有其他玩家。</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Layout: Combat Action Panels & Hotkeys */}
      <div className="bg-slate-900 p-3 pb-3 px-4 flex flex-col gap-2.5 shadow-2xl rounded-t-2xl border-t border-slate-800/80 z-10">
        <div className="grid grid-cols-12 gap-3 items-stretch">
          {/* Left Block: Basic Action Gears (4 Columns) */}
          <div className="col-span-4 flex flex-col gap-2 justify-between">
            {/* Primary Manual Combat Trigger */}
            <button
              onClick={() => startCombat()}
              disabled={!selectedEnemy || inCombat}
              className={`flex-1 min-h-[4.2rem] flex flex-col items-center justify-center gap-1 rounded-xl font-bold transition-all relative overflow-hidden ${
                inCombat 
                  ? 'bg-red-900/20 border border-red-500/30 text-red-400 font-black animate-pulse' 
                  : selectedEnemy 
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 cursor-pointer active:scale-95' 
                    : 'bg-slate-950 border border-slate-850 text-slate-655 cursor-not-allowed'
              }`}
            >
              <Swords className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wide">
                {inCombat ? '自動攻擊中' : '普通攻擊'}
              </span>
            </button>

            {/* Manual & Auto Mode Toggle Switch */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                onClick={() => { if (!isAutoPlay) toggleAutoPlay(); }}
                className={`py-1.5 rounded-lg text-[9px] font-black tracking-wider text-center transition-all ${
                  isAutoPlay 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                自動
              </button>
              <button
                onClick={() => { if (isAutoPlay) toggleAutoPlay(); }}
                className={`py-1.5 rounded-lg text-[9px] font-black tracking-wider text-center transition-all ${
                  !isAutoPlay 
                    ? 'bg-orange-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                手動
              </button>
            </div>
          </div>

          {/* Right Block: Paginated Quick Skill & Quick Item Slots (8 Columns) */}
          <div className="col-span-8 flex flex-col gap-1.5 relative">
            
            {/* Page Segment Swapper */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 gap-1 w-full shrink-0">
              <button
                onClick={() => setQuickPage(0)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black tracking-wider text-center transition-all ${
                  quickPage === 0 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
                }`}
              >
                快捷槽 (1 - 4)
              </button>
              <button
                onClick={() => setQuickPage(1)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black tracking-wider text-center transition-all ${
                  quickPage === 1 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
                }`}
              >
                快捷槽 (5 - 8)
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {/* Top Row: Skills (4 Slots, upper row) */}
              <div className="space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-indigo-400" /> 技能 (F1-F4)
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wider">SKILLS</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, localIndex) => {
                    const actualIndex = quickPage * 4 + localIndex;
                    const skillId = player.quickSkills[actualIndex];
                    const skill = skillId ? SKILL_DATA.find(s => s.id === skillId) : null;
                    const isSkillOnCooldown = skill ? (cooldowns[skill.id] > 0) : false;

                    return (
                      <button
                        key={actualIndex}
                        onClick={() => {
                          if (skill) {
                            useSkill(skill.id);
                          }
                        }}
                        className={`relative h-14 md:h-16 rounded-xl flex flex-col items-center justify-center p-1.5 border transition-all ${
                          skill 
                            ? 'bg-slate-800 border-indigo-500/60 hover:bg-slate-750 hover:border-indigo-400 active:scale-95 shadow-lg shadow-indigo-950/40' 
                            : 'bg-slate-950 border-slate-850 border-dashed hover:border-slate-800'
                        }`}
                      >
                        <span className="absolute top-1 left-1 text-[7px] px-1 py-0.5 rounded bg-slate-950/85 text-slate-400 font-mono scale-90 leading-none">F{actualIndex + 1}</span>
                        
                        {skill ? (
                          <div className="flex flex-col items-center gap-0.5 pt-1">
                            {skill.type === 'buff' ? (
                              <Shield className="w-4 h-4 text-teal-400 shrink-0" />
                            ) : (
                              <Zap className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className="text-[10px] text-center font-bold text-slate-100 truncate w-full px-1">
                              {skill.name}
                            </span>

                            {isSkillOnCooldown && (
                              <div className="absolute inset-0 bg-slate-950/95 rounded-xl flex items-center justify-center animate-pulse">
                                <span className="text-white font-black text-xs font-mono">{Math.ceil(cooldowns[skill.id])}s</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-755 font-bold uppercase tracking-wider">空</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Row: Items (4 Slots, lower row) */}
              <div className="space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-emerald-400" /> 藥水 (F1-F4)
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wider">POTIONS</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, localIndex) => {
                    const actualIndex = quickPage * 4 + localIndex;
                    const itemId = player.quickItems[actualIndex];
                    const item = itemId ? ITEM_DATA.find(it => it.id === itemId) : null;
                    const count = player.inventory
                      .filter(it => it.id === itemId)
                      .reduce((sum, it) => sum + it.quantity, 0) || 0;

                    return (
                      <button
                        key={actualIndex}
                        onClick={() => {
                          if (item) {
                            useQuickItem(actualIndex);
                          }
                        }}
                        className={`relative h-14 md:h-16 rounded-xl flex flex-col items-center justify-center p-1.5 border transition-all ${
                          item 
                            ? 'bg-slate-800 border-emerald-500/60 hover:bg-slate-750 hover:border-emerald-400 active:scale-95 shadow-lg shadow-emerald-950/40' 
                            : 'bg-slate-950 border-slate-850 border-dashed hover:border-slate-800'
                        }`}
                      >
                        <span className="absolute top-1 left-1 text-[7px] px-1 py-0.5 rounded bg-slate-950/85 text-slate-400 font-mono scale-90 leading-none">F{actualIndex + 1}</span>
                        
                        {item ? (
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <span className={`text-[10px] text-center font-black truncate w-full px-0.5 ${
                              item.id === 'hp_potion_s' ? 'text-red-400' : item.id === 'mp_potion_s' ? 'text-blue-400' : 'text-amber-400'
                            }`}>
                              {item.name}
                            </span>
                            <span className="text-[9px] font-extrabold text-slate-400 font-mono bg-slate-955/60 px-1 py-0.5 rounded-md border border-slate-900 leading-none">
                              x{count}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-755 font-bold uppercase tracking-wider">空</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
