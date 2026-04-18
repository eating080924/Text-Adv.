import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Home, ShoppingBag, Settings, Sword, ScrollText, Heart, Zap, Coins, Shield, X, Package, Sparkles } from 'lucide-react';
import { AdventureMap } from './AdventureMap';
import { Shop } from './Shop';
import { Inn } from './Inn';
import { Settings as GameSettings } from './Settings';
import { Skills } from './Skills';
import { Inventory } from './Inventory';
import { World } from './World';
import { ITEM_DATA } from '../data/items';
import { ItemInstance, Player } from '../types';

export const MainDashboard: React.FC = () => {
  const { player, inCombat, combatLogs, currentSubMap, selectMap, activeBuffs, deleteCharacter, updateSettings } = useGame();
  const [activeTab, setActiveTab] = useState<'adventure' | 'inn' | 'shop' | 'skills' | 'settings' | 'inventory' | 'world'>('adventure');
  const [showConfirm, setShowConfirm] = useState<{ target: any } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Switch to adventure tab if player is no longer in world (e.g. died)
  React.useEffect(() => {
    if (activeTab === 'world' && player && !player.isInWorld) {
      setActiveTab('adventure');
    }
  }, [player?.isInWorld, activeTab]);

  if (!player) return null;

  const handleTabChange = (tab: any) => {
    const isMapActive = currentSubMap || activeTab === 'world';
    if (isMapActive && tab !== activeTab && (tab === 'inn' || tab === 'shop' || tab === 'adventure' || tab === 'world')) {
      setShowConfirm({ target: tab });
    } else {
      setActiveTab(tab);
      // Update isInWorld status
      if (player) {
        updateSettings({ isInWorld: tab === 'world' });
      }
    }
  };

  const confirmLeave = () => {
    if (showConfirm) {
      const targetTab = showConfirm.target;
      setActiveTab(targetTab);
      setShowConfirm(null);
      selectMap('', ''); 
      // Update isInWorld status
      if (player) {
        updateSettings({ isInWorld: targetTab === 'world' });
      }
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col max-w-4xl mx-auto border-x border-slate-800">
      {/* Header / Player Stats */}
      <div className="bg-slate-900 p-4 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowStats(true)}>
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl border-2 border-blue-400">
              {player.id[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-lg">
                {player.id} <span className={`text-xs font-normal opacity-70`}>({player.faction})</span>
              </h2>
              <p className="text-xs text-slate-400">Lv.{player.level} {player.class}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-yellow-400 font-bold">
              <Coins className="w-4 h-4" />
              {player.gold}
            </div>
            <p className="text-[10px] text-slate-500">EXP: {player.exp}/{player.nextLevelExp}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-red-400">
              <span>HP</span>
              <span>{player.hp} / {player.maxHp}</span>
            </div>
            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-red-400"
                initial={{ width: 0 }}
                animate={{ width: `${(player.hp / player.maxHp) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-blue-400">
              <span>MP</span>
              <span>{player.mp} / {player.maxMp}</span>
            </div>
            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400"
                initial={{ width: 0 }}
                animate={{ width: `${(player.mp / player.maxMp) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Split Layout for Adventure & World */}
      <div className="flex-1 overflow-hidden flex">
        {(activeTab === 'adventure' || activeTab === 'world') ? (
          <div className="flex w-full">
            {/* Left: Combat Logs */}
            <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/30">
              <div className="p-2 border-b border-slate-800 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                戰鬥訊息
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
                {combatLogs.map((log, i) => (
                  <div key={i} className={i === 0 ? 'text-white font-bold' : 'text-slate-500'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Map/Combat UI */}
            <div className="flex-1 overflow-y-auto relative">
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

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xs w-full text-center space-y-6">
            <h3 className="text-lg font-bold">是否要離開地圖?</h3>
            <p className="text-sm text-slate-400">離開地圖將會重置當前區域的敵人狀態。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-2 bg-slate-800 rounded-lg font-bold hover:bg-slate-700"
              >
                取消
              </button>
              <button 
                onClick={confirmLeave}
                className="flex-1 py-2 bg-blue-600 rounded-lg font-bold hover:bg-blue-500"
              >
                確認離開
              </button>
            </div>
          </div>
        </div>
      )}
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
