import React from 'react';
import { useGame } from '../context/GameContext';
import { Settings as SettingsIcon, Heart, Zap, Sword } from 'lucide-react';
import { SKILL_DATA } from '../data/skills';

export const Settings: React.FC = () => {
  const { player, updateSettings, setQuickSkill } = useGame();

  if (!player) return null;

  return (
    <div className="space-y-8 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-slate-400" />
        戰鬥設定
      </h2>

      {/* Quick Skills */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4" /> 快捷技能設定
        </h3>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            {player.quickSkills.map((skillId, i) => {
              const skill = skillId ? SKILL_DATA.find(s => s.id === skillId) : null;
              return (
                <div key={i} className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">快捷鍵 {i + 1}</label>
                  <select
                    value={skillId || ''}
                    onChange={(e) => setQuickSkill(i, e.target.value || null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">-- 未設定 --</option>
                    {player.skills.map(id => {
                      const s = SKILL_DATA.find(x => x.id === id);
                      return <option key={id} value={id}>{s?.name}</option>;
                    })}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 mt-4 italic">※ 設定後的技能將會顯示在戰鬥介面的快捷欄中。</p>
        </div>
      </div>

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

      {/* Auto Skills */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">自動技能</h3>
        <div className="grid grid-cols-2 gap-3">
          {player.skills.map(skillId => {
            const skill = SKILL_DATA.find(s => s.id === skillId);
            if (!skill) return null;
            const isAuto = player.autoSkills.includes(skillId);

            return (
              <button
                key={skillId}
                onClick={() => {
                  const newAuto = isAuto 
                    ? player.autoSkills.filter(id => id !== skillId)
                    : [...player.autoSkills, skillId];
                  updateSettings({ autoSkills: newAuto });
                }}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  isAuto ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAuto ? 'bg-blue-600' : 'bg-slate-800'}`}>
                  <Sword className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold">{skill.name}</p>
                  <p className="text-[10px] text-slate-500">{isAuto ? '已啟用' : '未啟用'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
