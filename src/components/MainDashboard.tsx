import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Home, ShoppingBag, Settings, Sword, ScrollText, Heart, Zap, Coins, Shield, X, Package, Sparkles, Brain, Wind, Flame } from 'lucide-react';
import { AdventureMap } from './AdventureMap';
import { Shop } from './Shop';
import { Inn } from './Inn';
import { Settings as GameSettings } from './Settings';
import { Skills } from './Skills';
import { Inventory } from './Inventory';
import { World } from './World';
import { ITEM_DATA } from '../data/items';
import { SKILL_DATA } from '../data/skills';
import { ItemInstance, Player } from '../types';

export const MainDashboard: React.FC = () => {
  const { player, inCombat, combatLogs, currentSubMap, selectMap, activeBuffs, deleteCharacter, updateSettings } = useGame();
  
  const getBuffDisplay = (buffId: string) => {
    switch (buffId) {
      case 'meditation':
        return {
          name: '冥想',
          shortName: '冥想',
          bg: 'from-blue-950/80 to-indigo-950/80',
          border: 'border-blue-500/30',
          textColor: 'text-blue-400',
          icon: <Brain className="w-3 h-3 text-blue-400" />
        };
      case 'warcry':
        return {
          name: '戰吼',
          shortName: '戰吼',
          bg: 'from-rose-955/80 to-red-950/80',
          border: 'border-rose-500/30',
          textColor: 'text-rose-400',
          icon: <Flame className="w-3 h-3 text-rose-400" />
        };
      case 'wind_walk':
        return {
          name: '風之步',
          shortName: '風步',
          bg: 'from-teal-955/80 to-emerald-950/80',
          border: 'border-teal-500/30',
          textColor: 'text-teal-400',
          icon: <Wind className="w-3 h-3 text-teal-400" />
        };
      case 'mana_shield':
        return {
          name: '魔力護盾',
          shortName: '護盾',
          bg: 'from-indigo-955/80 to-violet-950/80',
          border: 'border-indigo-500/30',
          textColor: 'text-indigo-400',
          icon: <Shield className="w-3 h-3 text-indigo-400" />
        };
      case 'haste_potion':
        return {
          name: '速度藥水',
          shortName: '急速',
          bg: 'from-amber-955/80 to-yellow-950/80',
          border: 'border-amber-500/30',
          textColor: 'text-amber-400',
          icon: <Zap className="w-3 h-3 text-amber-400" />
        };
      default:
        return {
          name: buffId,
          shortName: buffId.substring(0, 2).toUpperCase(),
          bg: 'from-slate-950/80 to-slate-900/80',
          border: 'border-slate-800/50',
          textColor: 'text-slate-400',
          icon: <Sparkles className="w-3 h-3 text-slate-400" />
        };
    }
  };
  const [activeTab, setActiveTab] = useState<'adventure' | 'inn' | 'shop' | 'skills' | 'settings' | 'inventory' | 'world'>('adventure');
  const [showStats, setShowStats] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Switch to adventure tab if player is no longer in world (e.g. died)
  React.useEffect(() => {
    if (activeTab === 'world' && player && !player.isInWorld) {
      setActiveTab('adventure');
    }
  }, [player?.isInWorld, activeTab]);

  if (!player) return null;

  const hpMax = player.maxHp || 1;
  const hpVal = isNaN(player.hp) ? 0 : player.hp;
  const hpPct = Math.min(100, Math.max(0, (hpVal / hpMax) * 100));

  const mpMax = player.maxMp || 1;
  const mpVal = isNaN(player.mp) ? 0 : player.mp;
  const mpPct = Math.min(100, Math.max(0, (mpVal / mpMax) * 100));

  const expMax = player.nextLevelExp || 1;
  const expVal = isNaN(player.exp) ? 0 : player.exp;
  const expPct = Math.min(100, Math.max(0, (expVal / expMax) * 100));

  React.useEffect(() => {
    updateSettings({ activeTab });
  }, [activeTab]);

  const handleTabChange = (tab: any) => {
    if (tab === activeTab) return;

    // Reset submap automatically if they leave the adventure page during an active run
    if (currentSubMap && tab !== 'adventure') {
      selectMap('', '');
    }

    setActiveTab(tab);
    
    // Update isInWorld status
    if (player) {
      updateSettings({ isInWorld: tab === 'world' });
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col max-w-4xl mx-auto border-x border-slate-800">
      {/* Header / Player Stats */}
      <div className="bg-slate-900 p-3 px-4 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex justify-between items-center gap-4">
          {/* Left: Player Info + HP/MP/EXP Consolidated in the top-left area */}
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 bg-blue-600 rounded-full flex shrink-0 items-center justify-center font-bold text-lg border-2 border-blue-400 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowStats(true)}
            >
              {player.id[0].toUpperCase()}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowStats(true)}
              >
                <span className="font-extrabold text-sm text-slate-200">{player.id}</span>
                <span className="text-[10px] text-slate-400">Lv.{player.level}</span>
                <span className="text-[9px] text-slate-500 font-normal">({player.faction})</span>
              </div>
              
              {/* HP, MP, EXP Bars Stacked and Buff indicators on the right */}
              <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                {/* HP, MP, EXP Bars Stacked Compactly on the Left */}
                <div className="flex flex-col gap-1.5 w-52 sm:w-64">
                  {/* HP */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-red-400 font-extrabold shrink-0 w-6 font-mono text-[10px] tracking-wider text-right">HP</span>
                    <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700/50">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-red-600 to-red-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${hpPct}%` }}
                      />
                    </div>
                    <span className="text-slate-350 font-mono text-[10px] shrink-0 font-bold select-none w-14 text-right">{Math.floor(hpVal)}/{hpMax}</span>
                  </div>
                  {/* MP */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-blue-400 font-extrabold shrink-0 w-6 font-mono text-[10px] tracking-wider text-right">MP</span>
                    <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700/50">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${mpPct}%` }}
                      />
                    </div>
                    <span className="text-slate-350 font-mono text-[10px] shrink-0 font-bold select-none w-14 text-right">{Math.floor(mpVal)}/{mpMax}</span>
                  </div>
                  {/* EXP */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-emerald-400 font-extrabold shrink-0 w-6 font-mono text-[9px] tracking-wider text-right">EXP</span>
                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-755">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${expPct}%` }}
                      />
                    </div>
                    <span className="text-slate-400 font-mono text-[9px] shrink-0 font-bold select-none w-14 text-right">{expPct.toFixed(1)}%</span>
                  </div>
                </div>

                {/* BUFF & Potion Indicators on the Right */}
                <div className="flex flex-wrap gap-1 items-center min-h-[3rem]">
                  <AnimatePresence>
                    {activeBuffs && activeBuffs.length > 0 ? (
                      activeBuffs.map((buff) => {
                        const info = getBuffDisplay(buff.id);
                        return (
                          <motion.div
                            key={buff.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className={`flex items-center gap-1.5 bg-gradient-to-br ${info.bg} border ${info.border} rounded-lg px-2 py-1 shadow-md shadow-slate-950/40 text-slate-200 select-none`}
                            title={`${info.name} (剩餘 ${Math.ceil(buff.remaining)} 秒)`}
                          >
                            <span className="scale-105 shrink-0">{info.icon}</span>
                            <div className="flex flex-col leading-none">
                              <span className={`text-[9px] font-extrabold tracking-wide ${info.textColor}`}>{info.shortName}</span>
                              <span className={`text-[8px] font-mono font-black mt-0.5 ${buff.remaining <= 3 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
                                {Math.ceil(buff.remaining)}s
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <span className="text-[8px] text-slate-600 italic select-none">無增益狀態</span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Gold & Other quick stats info */}
          <div className="text-right flex flex-col items-end justify-center shrink-0">
            <div className="flex items-center gap-1 text-yellow-400 font-extrabold text-sm">
              <Coins className="w-4 h-4" />
              {player.gold} <span className="text-[10px] text-slate-500 font-normal">G</span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{player.class}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area - Split Layout for Adventure & World */}
      <div className="flex-1 overflow-hidden flex">
        {(activeTab === 'adventure' || activeTab === 'world') ? (
          <div className="flex w-full">
            {/* Left: Combat Logs */}
            <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/30">
              <div className="p-2 border-b border-slate-800 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                <span>戰鬥訊息</span>
                <span className="text-[8px] text-slate-600 font-mono font-normal">REALTIME MUD LOG</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[10px] scrollbar-thin bg-slate-950/80">
                {combatLogs.map((log, i) => {
                  const isLatest = i === 0;
                  let prefix = "[系統]";
                  let prefixColor = "text-slate-500";
                  let textColor = "text-slate-400";

                  if (log.includes("[自動]")) {
                    prefix = "[自動]";
                    prefixColor = "text-amber-500";
                    textColor = "text-slate-300";
                  } else if (log.includes("[反擊]")) {
                    prefix = "[反擊]";
                    prefixColor = "text-orange-500";
                    textColor = "text-orange-200";
                  } else if (log.includes("使用了")) {
                    prefix = "[技能]";
                    prefixColor = "text-indigo-400";
                    textColor = "text-violet-300";
                  } else if (log.includes("對你造成了") || log.includes("從旁偷襲")) {
                    prefix = "[受傷]";
                    prefixColor = "text-red-500";
                    textColor = "text-red-300";
                  } else if (log.includes("造成了") && log.includes("傷害")) {
                    prefix = "[戰鬥]";
                    prefixColor = "text-emerald-405";
                    textColor = "text-emerald-300";
                  } else if (log.includes("★ 強化成功 ★") || log.includes("強化成功")) {
                    prefix = "[強成]";
                    prefixColor = "text-yellow-400 font-extrabold animate-pulse";
                    textColor = "text-yellow-300 font-bold";
                  } else if (log.includes("強化失敗")) {
                    prefix = "[強敗]";
                    prefixColor = "text-red-500 font-bold";
                    textColor = "text-rose-300";
                  } else if (log.includes("獲得了") || log.includes("掉落了") || log.includes("金幣") || log.includes("賣出了")) {
                    prefix = "[獲得]";
                    prefixColor = "text-yellow-500";
                    textColor = "text-yellow-400";
                  } else if (log.includes("恭喜升級")) {
                    prefix = "[升級]";
                    prefixColor = "text-teal-400 font-extrabold animate-bounce";
                    textColor = "text-teal-300 font-black";
                  } else if (log.includes("被打敗了") || log.includes("死亡")) {
                    prefix = "[戰敗]";
                    prefixColor = "text-rose-600 font-bold";
                    textColor = "text-rose-400 font-bold";
                  } else if (log.includes("自然恢復")) {
                    prefix = "[恢復]";
                    prefixColor = "text-teal-500";
                    textColor = "text-teal-300";
                  }

                  const cleanLog = log.replace("[自動]", "").replace("[反擊]", "").trim();

                  return (
                    <div 
                      key={i} 
                      className={`flex items-start gap-1 py-0.5 px-1 rounded transition-all leading-relaxed ${
                        isLatest 
                          ? `${cleanLog.includes("對你造成了") ? 'bg-red-950/15' : 'bg-slate-900/40'} border-l-2 border-sky-400 pl-1.5 text-[11px] font-bold` 
                          : 'opacity-70'
                      }`}
                    >
                      <span className={`font-bold shrink-0 text-[10px] ${prefixColor}`}>
                        {prefix}
                      </span>
                      <span className={`flex-1 break-all ${isLatest ? 'text-slate-100' : textColor}`}>
                        {cleanLog}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Map/Combat UI */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {activeTab === 'adventure' ? <AdventureMap /> : <World />}
            </div>
          </div>
        ) : (
          <div className="w-full overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {activeTab === 'inn' && <Inn />}
                {activeTab === 'shop' && <Shop />}
                {activeTab === 'inventory' && <Inventory />}
                {activeTab === 'skills' && <Skills />}
                {activeTab === 'settings' && <GameSettings />}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 p-2 flex justify-around items-center z-20">
        <NavButton active={activeTab === 'adventure'} onClick={() => handleTabChange('adventure')} icon={<Map />} label="冒險" />
        <NavButton active={activeTab === 'world'} onClick={() => handleTabChange('world')} icon={<Sparkles />} label="世界" />
        <NavButton active={activeTab === 'inn'} onClick={() => handleTabChange('inn')} icon={<Home />} label="旅館" />
        <NavButton active={activeTab === 'shop'} onClick={() => handleTabChange('shop')} icon={<ShoppingBag />} label="商店" />
        <NavButton active={activeTab === 'inventory'} onClick={() => handleTabChange('inventory')} icon={<Package />} label="背包" />
        <NavButton active={activeTab === 'skills'} onClick={() => handleTabChange('skills')} icon={<Sword />} label="技能" />
        <NavButton active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} icon={<Settings />} label="設定" />
      </div>

      {/* Character Stats Modal */}
      <AnimatePresence>
        {showStats && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowStats(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl max-w-[95vw] sm:max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg border border-blue-400/50">
                    {player.id[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{player.id}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Lv.{player.level} {player.class}</p>
                  </div>
                </div>
                <button onClick={() => setShowStats(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-l-2 border-red-500 pl-2">攻擊能力</h4>
                  <div className="space-y-3">
                    <StatItem 
                      label="近戰傷害" 
                      value={player.meleeAtk} 
                      subValue={`(基礎: ${Math.floor(1 + player.stats.str * 1.5)})`}
                      color="text-red-400" 
                    />
                    <StatItem 
                      label="遠程傷害" 
                      value={player.rangedAtk} 
                      subValue={`(基礎: ${Math.floor(1 + player.stats.dex * 1.5)})`}
                      color="text-green-400" 
                    />
                    <StatItem 
                      label="魔法傷害" 
                      value={player.magicAtk} 
                      subValue={`(基礎: ${Math.floor(1 + player.stats.int * 2)})`}
                      color="text-purple-400" 
                    />
                    <StatItem label="攻擊速度" value={player.attackSpeed.toFixed(2)} color="text-yellow-400" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-l-2 border-blue-500 pl-2">防禦與輔助</h4>
                  <div className="space-y-3">
                    <StatItem 
                      label="物理防禦" 
                      value={player.physDef} 
                      subValue={`(基礎: ${Math.floor(1 + player.stats.con * 1.5)})`}
                      color="text-blue-400" 
                    />
                    <StatItem 
                      label="魔法防禦" 
                      value={player.magicDef} 
                      subValue={`(基礎: ${Math.floor(1 + player.stats.int * 1)})`}
                      color="text-indigo-400" 
                    />
                    <StatItem label="迴避力" value={player.evasion} color="text-cyan-400" />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-l-2 border-emerald-500 pl-2">基礎屬性</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatItem label="力量 (STR)" value={player.stats.str} color="text-orange-400" />
                    <StatItem label="敏捷 (DEX)" value={player.stats.dex} color="text-cyan-400" />
                    <StatItem label="智力 (INT)" value={player.stats.int} color="text-indigo-400" />
                    <StatItem label="體質 (CON)" value={player.stats.con} color="text-emerald-400" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-bold transition-all border border-red-900/50 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  刪除角色
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-red-900/50 p-8 rounded-3xl max-w-xs w-full text-center space-y-6 shadow-2xl shadow-red-900/20"
            >
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">確定要刪除角色嗎？</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                此動作無法復原。你將失去所有的等級、裝備以及金幣。
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    deleteCharacter();
                    setShowDeleteConfirm(false);
                    setShowStats(false);
                  }}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/40"
                >
                  確認刪除
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center p-2 rounded-xl transition-all ${active ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-300'}`}
  >
    {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6 mb-1' })}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const StatItem: React.FC<{ label: string; value: string | number; subValue?: string; color: string }> = ({ label, value, subValue, color }) => (
  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800/50 hover:bg-slate-800/60 transition-colors">
    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
      {subValue && <p className="text-[10px] text-slate-500/70 font-mono">{subValue}</p>}
    </div>
  </div>
);
