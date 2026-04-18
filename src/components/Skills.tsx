import React from 'react';
import { useGame } from '../context/GameContext';
import { SKILL_DATA } from '../data/skills';
import { ITEM_DATA } from '../data/items';
import { Sword, Zap, Clock, Book } from 'lucide-react';

export const Skills: React.FC = () => {
  const { player, useItem, cooldowns } = useGame();

  if (!player) return null;

  const learnedSkills = SKILL_DATA.filter(s => player.skills.includes(s.id));
  const inventorySkillBooks = player.inventory
    .map(instance => ({
      instance,
      item: ITEM_DATA.find(i => i.id === instance.id)
    }))
    .filter(x => x.item?.type === 'skillBook');

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Sword className="w-4 h-4" /> 已學會技能
        </h3>
        <div className="grid gap-3">
          {learnedSkills.map((skill) => (
            <div key={skill.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center relative">
                <Zap className={`w-6 h-6 ${skill.type === 'active' ? 'text-blue-400' : 'text-green-400'}`} />
                {cooldowns[skill.id] > 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <span className="text-white font-bold text-xs">{Math.ceil(cooldowns[skill.id])}</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold">{skill.name}</h4>
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Zap className="w-2 h-2" /> {skill.mpCost}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Clock className="w-2 h-2" /> {skill.cooldown}s
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{skill.description}</p>
              </div>
            </div>
          ))}
          {learnedSkills.length === 0 && (
            <div className="text-center py-8 text-slate-600 italic text-sm">
              尚未學會任何技能
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Book className="w-4 h-4" /> 背包中的技能書
        </h3>
        <div className="grid gap-3">
          {inventorySkillBooks.map(({ instance, item }, index) => (
            <div key={`${instance.instanceId}`} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Book className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {item?.name} {instance.quantity > 1 ? `(x${instance.quantity})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500">{item?.description}</p>
                </div>
              </div>
              <button
                onClick={() => useItem(instance.instanceId)}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                學習
              </button>
            </div>
          ))}
          {inventorySkillBooks.length === 0 && (
            <div className="text-center py-8 text-slate-600 italic text-sm">
              背包中沒有技能書
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
