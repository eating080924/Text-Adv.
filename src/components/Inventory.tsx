import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ITEM_DATA } from '../data/items';
import { Package, Zap, Shield, Sword, Sparkles, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ItemInstance } from '../types';

export const Inventory: React.FC = () => {
  const { player, useItem, enhanceItem, setQuickItem } = useGame();
  const [selectedScroll, setSelectedScroll] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ItemInstance | null>(null);

  if (!player) return null;

  const handleItemClick = (instanceId: string) => {
    const instance = player.inventory.find(i => i.instanceId === instanceId);
    if (!instance) return;
    const item = ITEM_DATA.find(i => i.id === instance.id);
    if (!item) return;

    if (selectedScroll) {
      if (instanceId === selectedScroll) {
        setSelectedScroll(null);
        return;
      }
      enhanceItem(selectedScroll, instanceId);
      setSelectedScroll(null);
    } else {
      if (item.isScroll) {
        setSelectedScroll(instanceId);
      } else {
        useItem(instanceId);
      }
    }
  };

  const isEquipped = (instanceId: string) => {
    return Object.values(player.equipment).some(id => id === instanceId);
  };

  const getEnhancementBonus = (item: any, enhancement: number) => {
    if (enhancement === 0) return null;
    const bonus = enhancement * 2;
    if (item.type === 'weapon') return `ATK +${bonus}`;
    if (item.type === 'armor') return `DEF +${bonus}`;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-500" />
          冒險者背包
        </h2>
        {selectedScroll && (
          <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500 px-3 py-1 rounded-full text-[10px] font-bold text-blue-400 animate-pulse">
            <Sparkles className="w-3 h-3" />
            請選擇要強化的裝備
            <button onClick={() => setSelectedScroll(null)} className="ml-2 text-white hover:text-red-400 font-bold">X</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {player.inventory.map((instance) => {
          const item = ITEM_DATA.find(i => i.id === instance.id);
          if (!item) return null;

          const isSelected = selectedScroll === instance.instanceId;
          const equipped = isEquipped(instance.instanceId);

          return (
            <motion.div
              key={instance.instanceId}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleItemClick(instance.instanceId)}
              onMouseEnter={() => setHoveredItem(instance)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`relative aspect-square rounded-xl border p-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/50' 
                  : equipped
                    ? 'bg-green-900/40 border-green-500/50 shadow-inner'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-slate-500">
                {item.type === 'weapon' && <Sword className={`w-5 h-5 ${equipped ? 'text-green-400' : ''}`} />}
                {item.type === 'armor' && <Shield className={`w-5 h-5 ${equipped ? 'text-green-400' : ''}`} />}
                {item.type === 'potion' && <Zap className="w-5 h-5 text-yellow-500" />}
                {item.isScroll && <Sparkles className="w-5 h-5 text-blue-400" />}
                {item.type === 'skillBook' && <Package className="w-5 h-5 text-purple-400" />}
              </div>
              
              <span className="text-[8px] font-bold text-center truncate w-full">
                {instance.enhancement > 0 ? `+${instance.enhancement} ` : ''}{item.name}
              </span>

              {equipped && (
                <div className="absolute top-0 right-0 bg-green-500 text-[6px] px-1 rounded-bl rounded-tr font-bold text-white">
                  裝備中
                </div>
              )}

              {instance.quantity > 1 && (
                <span className="absolute bottom-1 right-1 bg-slate-800 px-1 rounded text-[8px] font-mono text-slate-300">
                  x{instance.quantity}
                </span>
              )}

              {equipped && (
                <span className="absolute top-1 left-1 bg-green-500 text-white text-[6px] px-1 rounded font-bold uppercase">
                  已裝備
                </span>
              )}

              {/* Quick Item Selection Overlay */}
              {item.type === 'potion' && (
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  {[0, 1, 2, 3].map(slot => (
                    <button
                      key={slot}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickItem(slot, item.id);
                      }}
                      className={`w-3 h-3 rounded-full border border-slate-700 text-[6px] flex items-center justify-center font-bold ${
                        player.quickItems[slot] === item.id ? 'bg-blue-500 text-white border-blue-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {slot + 1}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
        {player.inventory.length === 0 && (
          <div className="col-span-4 py-12 text-center text-slate-600 text-xs italic">
            背包空空如也...
          </div>
        )}
      </div>

      {/* Item Info Panel */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl"
          >
            {(() => {
              const item = ITEM_DATA.find(i => i.id === hoveredItem.id);
              if (!item) return null;
              const bonus = getEnhancementBonus(item, hoveredItem.enhancement);
              
              return (
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-blue-400">
                        {hoveredItem.enhancement > 0 ? `+${hoveredItem.enhancement} ` : ''}{item.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">{item.type}</p>
                    </div>
                    {item.price > 0 && (
                      <div className="text-yellow-500 font-bold text-xs">價值: {item.price}</div>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                  
                  {(item.stats || bonus) && (
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                      {item.stats && Object.entries(item.stats).map(([key, val]) => (
                        <span key={key} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-blue-300 uppercase font-bold">
                          {key}: {val}
                        </span>
                      ))}
                      {bonus && (
                        <span className="text-[10px] bg-blue-900/30 border border-blue-500/30 px-2 py-0.5 rounded text-blue-400 uppercase font-bold">
                          強化: {bonus}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">操作說明</h3>
        <ul className="text-[10px] text-slate-400 space-y-1">
          <li className="flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> 點擊藥水/技能書：直接使用</li>
          <li className="flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> 點擊裝備：穿戴或卸下</li>
          <li className="flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> 點擊卷軸：進入強化模式，再點擊目標裝備</li>
          <li className="flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> 點擊藥水右上角數字：設定至戰鬥快捷欄</li>
        </ul>
      </div>
    </div>
  );
};
