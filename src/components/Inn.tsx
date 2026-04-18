import React from 'react';
import { useGame } from '../context/GameContext';
import { Home, Coffee, Bed, Coins } from 'lucide-react';
import { motion } from 'motion/react';

export const Inn: React.FC = () => {
  const { player, restAtInn } = useGame();

  if (!player) return null;

  const cost = player.level * 10;

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-900/20"
      >
        <Home className="w-12 h-12 text-white" />
      </motion.div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">冒險者旅館</h2>
        <p className="text-slate-400 text-sm max-w-xs">
          在這裡休息一晚，可以完全恢復你的體力 (HP) 與魔力 (MP)。
        </p>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 w-full max-w-xs space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Coffee className="w-4 h-4" />
            <span className="text-sm">休息費用</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-bold">
            <Coins className="w-4 h-4" />
            {cost}
          </div>
        </div>

        <button
          onClick={restAtInn}
          className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
        >
          <Bed className="w-5 h-5" />
          立即休息
        </button>
      </div>

      <p className="text-[10px] text-slate-600 italic">
        "歡迎回來，辛苦了，勇者。"
      </p>
    </div>
  );
};
