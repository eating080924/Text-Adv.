import React from 'react';
import { useGame } from '../context/GameContext';
import { SKILL_DATA } from '../data/skills';
import { ITEM_DATA } from '../data/items';
import { Sword, Zap, Clock, Book, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const Skills: React.FC = () => {
  const { player, useItem, setQuickSkill, cooldowns } = useGame();

  if (!player) return null;

  const learnedSkills = SKILL_DATA.filter(s => player.skills.includes(s.id));
  const inventorySkillBooks = player.inventory
    .map(instance => ({
      instance,
      item: ITEM_DATA.find(i => i.id === instance.id)
    }))
    .filter(x => x.item?.type === 'skillBook');

  return (
    <div className="space-y-8 p-4 md:p-6 bg-slate-950 select-none h-full overflow-y-auto">
      {/* Top Description panel */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/85">
        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <Book className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">冒險者魔法與技能簿</h2>
          <p className="text-[10px] text-slate-500 font-medium">在此學習新技能書，並可在技能卡片下方快速設定、更改或清除快捷欄段位。</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 pl-0.5">
          <Sword className="w-4 h-4 text-rose-500" /> 已學會技能列表
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learnedSkills.map((skill) => (
            <div 
              key={skill.id} 
              className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-slate-950/80 rounded-xl flex items-center justify-center relative border border-slate-850 shrink-0">
                  <Zap className={`w-6 h-6 ${skill.type === 'active' ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}`} />
                  {cooldowns[skill.id] > 0 && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center rounded-xl">
                      <span className="text-white font-mono font-black text-xs">{Math.ceil(cooldowns[skill.id])}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-sm text-slate-200">{skill.name}</h4>
                    <div className="flex gap-1.5 shrink-0">
                      <span className="text-[9px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded font-black flex items-center gap-1 border border-blue-900/40">
                        MP: {skill.mpCost}
                      </span>
                      <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-slate-855">
                        CD: {skill.cooldown}s
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{skill.description}</p>
                </div>
              </div>

              {/* Quick Binder Actions */}
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900 space-y-1.5">
                <span className="text-[8px] uppercase tracking-widest pl-0.5 font-bold text-slate-500 flex items-center gap-1">
                  🎯 綁定至快捷鍵位 (F1 - F8)
                </span>
                <div className="grid grid-cols-8 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(slot => {
                    const isSlotted = player.quickSkills[slot] === skill.id;
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          setQuickSkill(slot, isSlotted ? null : skill.id);
                        }}
                        className={`py-1 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                          isSlotted 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                            : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        F{slot + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {learnedSkills.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-slate-900/20 rounded-2xl border border-slate-900/60 text-slate-500 italic text-xs">
              尚未學會任何技能，快去打怪獲取、或者在商店購買技能書吧！
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-0.5 flex items-center gap-2">
          <Book className="w-4 h-4 text-amber-500" /> 背包中的技能書 (雙擊或點擊學習)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inventorySkillBooks.map(({ instance, item }) => (
            <div 
              key={`${instance.instanceId}`} 
              className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-850 shrink-0">
                  <Book className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-slate-200 truncate">
                    {item?.name} {instance.quantity > 1 ? `(x${instance.quantity})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{item?.description}</p>
                </div>
              </div>
              <button
                onClick={() => useItem(instance.instanceId)}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shrink-0"
              >
                研讀學習
              </button>
            </div>
          ))}

          {inventorySkillBooks.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-slate-900/20 rounded-2xl border border-slate-900/60 text-slate-500 italic text-xs">
              背包中沒有可研讀的技能書。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
