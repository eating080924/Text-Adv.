import React from 'react';
import { useGame } from '../context/GameContext';
import { Home, Coffee, Sparkles, Heart, Zap, Coins } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateLineageRegen } from '../utils/combatUtils';

export const Inn: React.FC = () => {
  const { player, restAtInn } = useGame();

  if (!player) return null;

  const cost = player.level * 10;
  const canAfford = player.gold >= cost;

  // Natural regeneration formula (Lineage Online-style)
  const { hpRegen, mpRegen } = calculateLineageRegen(player);
  
  // Rate at inn is 2x, ticking every 10 seconds
  const currentHpRegenCount = hpRegen * 2;
  const currentMpRegenCount = mpRegen * 2;

  const hpPercentage = (player.maxHp && !isNaN(player.hp) && !isNaN(player.maxHp)) ? Math.round((player.hp / player.maxHp) * 100) : 0;
  const mpPercentage = (player.maxMp && !isNaN(player.mp) && !isNaN(player.maxMp)) ? Math.round((player.mp / player.maxMp) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-8 px-4 max-w-md mx-auto select-none">
      {/* Upper Cozy Status Icon */}
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden"
        >
          <Home className="w-12 h-12 text-sky-400" />
        </motion.div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
          冒險者旅館 <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
        </h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          歡迎來到溫馨的旅店！在此處歇息可享有 <span className="text-sky-400 font-bold">2倍</span> 旅館被動生命值與魔力值恢復速度（每 10 秒觸發一次）。
        </p>
      </div>

      {/* Live Stat Bar Display */}
      <div className="w-full bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 space-y-4">
        <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">當前角色狀態</h3>
        
        {/* HP Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 font-bold text-red-400">
              <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />生命值 HP
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-300">
              {Math.floor(player.hp)} / {player.maxHp} <span className="text-slate-500">({hpPercentage}%)</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${hpPercentage}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-red-600 to-rose-500"
            />
          </div>
        </div>

        {/* MP Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 font-bold text-blue-400">
              <Zap className="w-3.5 h-3.5 fill-current" />魔力值 MP
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-300">
              {Math.floor(player.mp)} / {player.maxMp} <span className="text-slate-500">({mpPercentage}%)</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${mpPercentage}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Inn Resting Rate Display */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 font-bold mb-0.5">被動生命恢復</p>
          <p className="font-mono text-sm font-black text-rose-450">
            +{Math.floor(currentHpRegenCount)} <span className="text-[9px] text-slate-500">/ 10秒</span>
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 font-bold mb-0.5">被動魔力恢復</p>
          <p className="font-mono text-sm font-black text-blue-450">
            +{Math.floor(currentMpRegenCount)} <span className="text-[9px] text-slate-500">/ 10秒</span>
          </p>
        </div>
      </div>

      <p className="text-[10px] text-slate-650 font-bold text-center bg-slate-900/20 py-2.5 px-4 rounded-xl border border-slate-850 w-full animate-pulse">
        🛌 歇息中... 只要停留在「旅店」分頁，即可持續享有雙倍自然恢復速度。
      </p>

      <p className="text-[10px] text-slate-600 italic">
        "溫暖的爐火正噼啪作響，好好休息，儲備好體力再繼續探險吧。"
      </p>
    </div>
  );
};
