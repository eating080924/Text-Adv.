import React from 'react';
import { useGame } from '../context/GameContext';
import { Settings as SettingsIcon, Heart, Zap } from 'lucide-react';

export const Settings: React.FC = () => {
  const { player, updateSettings } = useGame();

  if (!player) return null;

  return (
    <div className="space-y-8 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-slate-400" />
        戰鬥設定
      </h2>

      {/* Auto Potion */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">自動藥水</h3>
        
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-red-400">
                <Heart className="w-4 h-4" />
                <span className="text-sm font-bold">HP 門檻</span>
              </div>
              <span className="text-sm font-mono">{player.autoPotionHpThreshold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={player.autoPotionHpThreshold}
              onChange={(e) => updateSettings({ autoPotionHpThreshold: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-blue-400">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-bold">MP 門檻</span>
              </div>
              <span className="text-sm font-mono">{player.autoPotionMpThreshold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={player.autoPotionMpThreshold}
              onChange={(e) => updateSettings({ autoPotionMpThreshold: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
