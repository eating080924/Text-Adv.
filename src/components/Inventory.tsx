import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ITEM_DATA } from '../data/items';
import { Package, Zap, Shield, Sword, Sparkles, MousePointer2, Hammer, Coins, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ItemInstance } from '../types';

export const Inventory: React.FC = () => {
  const { player, useItem, enhanceItem, setQuickItem } = useGame();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedScroll, setSelectedScroll] = useState<string | null>(null);
  const [enhancementResult, setEnhancementResult] = useState<{
    success: boolean;
    destroyed: boolean;
    itemName: string;
    oldEnhancement: number;
    newEnhancement: number;
    message: string;
  } | null>(null);

  if (!player) return null;

  const inventory = player.inventory;
  
  // Auto-select first item if current selection is invalid or null
  const currentSelectedItem = inventory.find(i => i.instanceId === selectedInstanceId) || inventory[0] || null;
  const inspectedItemData = currentSelectedItem ? ITEM_DATA.find(it => it.id === currentSelectedItem.id) : null;

  const scrollInstance = selectedScroll ? inventory.find(i => i.instanceId === selectedScroll) : null;
  const scrollItem = scrollInstance ? ITEM_DATA.find(i => i.id === scrollInstance.id) : null;
  const isValidTarget = scrollItem && inspectedItemData && (
    (scrollItem.scrollType === 'weapon' && inspectedItemData.type === 'weapon') ||
    (scrollItem.scrollType === 'armor' && inspectedItemData.type === 'armor')
  );

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

  const handleSingleClick = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
  };

  const handleExecuteAction = (instanceId: string) => {
    const instance = inventory.find(i => i.instanceId === instanceId);
    if (!instance) return;
    const item = ITEM_DATA.find(i => i.id === instance.id);
    if (!item) return;

    // Direct enhancement execution
    if (selectedScroll) {
      const scrollInstance = inventory.find(i => i.instanceId === selectedScroll);
      const scrollItem = scrollInstance ? ITEM_DATA.find(i => i.id === scrollInstance.id) : null;
      
      if (scrollItem && scrollItem.isScroll) {
        if ((scrollItem.scrollType === 'weapon' && item.type === 'weapon') || 
            (scrollItem.scrollType === 'armor' && item.type === 'armor')) {
          
          const oldEnhancement = instance.enhancement;
          const itemName = item.name;
          
          const res = enhanceItem(selectedScroll, instanceId);
          if (res) {
            setEnhancementResult({
              success: res.success,
              destroyed: res.destroyed,
              itemName,
              oldEnhancement,
              newEnhancement: res.success ? oldEnhancement + 1 : oldEnhancement,
              message: res.message
            });
            // Reset selection if destroyed
            if (res.destroyed) {
              setSelectedInstanceId(null);
            }
          }
          setSelectedScroll(null);
          return;
        }
      }
      setSelectedScroll(null);
      return;
    }

    // Normal usage/equipment actions
    if (item.isScroll) {
      setSelectedScroll(instanceId);
    } else {
      useItem(instanceId);
    }
  };

  const handleDoubleClick = (instanceId: string) => {
    handleExecuteAction(instanceId);
  };

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-6 select-none h-full bg-slate-950">
      {/* Top Title Bar */}
      <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Package className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">冒險者背包 ({inventory.length}/50)</h2>
            <p className="text-[10px] text-slate-500">檢視並操作您的武器、防具、恢復藥水及強化卷軸。</p>
          </div>
        </div>
        
        {selectedScroll && (
          <motion.div 
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black text-amber-400"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            已啟動強化模式！雙擊目標裝備進行強化
            <button 
              onClick={() => setSelectedScroll(null)} 
              className="ml-2 hover:bg-slate-800 px-1.5 py-0.5 rounded text-white bg-slate-900/50"
            >
              取消
            </button>
          </motion.div>
        )}
      </div>

      {/* Two-Column split layout for item list on left, detail view on right */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Grid of Items (Span 3) */}
        <div className="col-span-1 md:col-span-3 bg-slate-900/25 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto max-h-[500px]">
          {inventory.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-2">
              {inventory.map((instance) => {
                const item = ITEM_DATA.find(i => i.id === instance.id);
                if (!item) return null;

                const isInspected = currentSelectedItem?.instanceId === instance.instanceId;
                const isScrollTargetSelected = selectedScroll === instance.instanceId;
                const equipped = isEquipped(instance.instanceId);

                return (
                  <motion.div
                    key={instance.instanceId}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSingleClick(instance.instanceId)}
                    onDoubleClick={() => handleDoubleClick(instance.instanceId)}
                    className={`relative aspect-square rounded-xl border p-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isScrollTargetSelected
                        ? 'bg-amber-500/20 border-amber-500 shadow-xl shadow-amber-950/20'
                        : isInspected
                          ? 'bg-blue-600/25 border-blue-500 shadow-lg shadow-blue-950/20'
                          : equipped
                            ? 'bg-emerald-950/20 border-emerald-500/50 shadow-inner'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/90'
                    }`}
                  >
                    {/* Item Icon */}
                    <div className="mb-1">
                      {item.type === 'weapon' && <Sword className={`w-6 h-6 ${equipped ? 'text-emerald-400' : 'text-slate-400'}`} />}
                      {item.type === 'armor' && <Shield className={`w-6 h-6 ${equipped ? 'text-emerald-400' : 'text-slate-400'}`} />}
                      {item.type === 'potion' && <Zap className="w-6 h-6 text-amber-500" />}
                      {item.isScroll && <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />}
                      {item.type === 'skillBook' && <Package className="w-6 h-6 text-purple-400" />}
                    </div>

                    {/* Name string */}
                    <span className="text-[9px] font-bold text-center truncate w-full px-0.5 text-slate-200">
                      {instance.enhancement > 0 ? `+${instance.enhancement} ` : ''}{item.name}
                    </span>

                    {/* Equipped Badge overlay */}
                    {equipped && (
                      <span className="absolute top-1 left-1 bg-emerald-600 text-[6px] font-black uppercase text-white px-1 leading-normal rounded">
                        E
                      </span>
                    )}

                    {/* Quantity stacking indicator */}
                    {instance.quantity > 1 && (
                      <span className="absolute bottom-1 right-1 bg-slate-950/80 px-1 py-0.2 rounded font-mono text-[8px] text-slate-300 border border-slate-800">
                        x{instance.quantity}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 space-y-2 text-center">
              <Package className="w-10 h-10 text-slate-800" />
              <p className="text-slate-600 text-xs italic">您的冒險背包目前空空如也...</p>
            </div>
          )}
        </div>

        {/* Right Column: Elaborate Item Info Panel (Span 2) */}
        <div className="col-span-1 md:col-span-2 bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <AnimatePresence mode="wait">
            {currentSelectedItem && inspectedItemData ? (
              <motion.div
                key={currentSelectedItem.instanceId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4 flex-1 flex flex-col justify-between"
              >
                {/* Header Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-extrabold text-blue-400 text-base leading-tight">
                        {currentSelectedItem.enhancement > 0 ? `+${currentSelectedItem.enhancement} ` : ''}
                        {inspectedItemData.name}
                      </h3>
                      <span className="text-[8px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-black text-slate-400 uppercase tracking-widest inline-block mt-1">
                        {inspectedItemData.type === 'potion' ? '消耗藥水' : inspectedItemData.type === 'weapon' ? '單手武器' : inspectedItemData.type === 'armor' ? '全身防具' : inspectedItemData.isScroll ? '強化卷軸' : '技能書'}
                      </span>
                    </div>
                    {inspectedItemData.price > 0 && (
                      <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-xl text-[11px] font-black text-yellow-500 font-mono">
                        <Coins className="w-3.5 h-3.5" />
                        {inspectedItemData.price}
                      </div>
                    )}
                  </div>

                  {/* Body description */}
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                    {inspectedItemData.description}
                  </p>

                  {/* Attributes Bonus Area */}
                  {(() => {
                    const bonus = getEnhancementBonus(inspectedItemData, currentSelectedItem.enhancement);
                    if (!inspectedItemData.stats && !bonus) return null;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest pl-0.5">強化/基本屬性加成</p>
                        <div className="flex flex-wrap gap-1.5">
                          {inspectedItemData.stats && Object.entries(inspectedItemData.stats).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-blue-300 font-bold uppercase">
                              {k === 'atk' ? '攻擊力' : k === 'def' ? '防禦力' : k === 'hp' ? '生命' : k === 'mp' ? '護盾/魔化' : k}: {v as number}
                            </span>
                          ))}
                          {bonus && (
                            <span className="text-[10px] bg-blue-950/50 border border-blue-500/30 px-2.5 py-1 rounded-lg text-blue-400 font-bold">
                              加權: {bonus}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Shortcuts Config Section if Potion */}
                  {inspectedItemData.type === 'potion' && (
                    <div className="space-y-1.5 bg-slate-950/30 border border-slate-900 p-3 rounded-xl">
                      <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-500" /> 設定此消耗品至快捷欄位 (1-8)
                      </p>
                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(slot => {
                          const isSlotted = player.quickItems[slot] === inspectedItemData.id;
                          return (
                            <button
                              key={slot}
                              onClick={() => {
                                setQuickItem(slot, isSlotted ? null : inspectedItemData.id);
                              }}
                              className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                                isSlotted 
                                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-950'
                                  : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              F{slot + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Action Button */}
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => handleExecuteAction(currentSelectedItem.instanceId)}
                    className={`w-full py-3 px-4 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${
                      selectedScroll
                        ? isValidTarget
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 ring-2 ring-amber-400/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-500/20'
                    }`}
                    disabled={selectedScroll && !isValidTarget}
                  >
                    {selectedScroll ? (
                      isValidTarget ? (
                        <>
                          <Hammer className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                          ★ 立即進行裝備強化 ★
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" />
                          不符合此卷軸強化類型 ({scrollItem?.scrollType === 'weapon' ? '限武器' : '限防具'})
                        </>
                      )
                    ) : (
                      <>
                        <MousePointer2 className="w-3.5 h-3.5 animate-pulse" />
                        {inspectedItemData.isScroll ? '啟動強化卷軸 (點擊選擇目標)' : isEquipped(currentSelectedItem.instanceId) ? '卸下此裝備' : '穿戴/使用此道具'}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-1.5 text-slate-600">
                <Package className="w-7 h-7" />
                <p className="text-xs italic">請選擇背包中的道具以檢視詳細內容</p>
              </div>
            )}
          </AnimatePresence>

          {/* Guidelines info */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900/60">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">操作指南</h3>
            <ul className="text-[9px] text-slate-400 space-y-1">
              <li className="flex items-center gap-1.5"><span className="text-blue-500">•</span> 點選道具：查看詳細資訊</li>
              <li className="flex items-center gap-1.5"><span className="text-blue-500">•</span> 點下方面板按鈕：直接裝備、使用或進行裝備強化 (雙擊道具亦同)</li>
              <li className="flex items-center gap-1.5"><span className="text-blue-500">•</span> 藥水可在右側面板快速綁定到快捷按鍵 [F1 ~ F8]</li>
            </ul>
          </div>
        </div>
      </div>



      {/* Enhancement Outcome Information Modal */}
      <AnimatePresence>
        {enhancementResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Outcome Background Ambient Pulse */}
              <div className={`absolute -inset-10 opacity-[0.06] bg-gradient-to-br ${
                enhancementResult.success 
                  ? 'from-emerald-500 to-teal-500' 
                  : enhancementResult.destroyed 
                    ? 'from-red-600 to-rose-700' 
                    : 'from-orange-500 to-yellow-600'
              } rounded-full blur-2xl`} />

              <div className="relative space-y-6">
                {enhancementResult.success ? (
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                    <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
                  </div>
                ) : enhancementResult.destroyed ? (
                  <div className="w-20 h-20 bg-red-600/15 border border-red-500/30 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-red-500/10">
                    <X className="w-10 h-10 text-red-500" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-slate-850 border border-slate-750 rounded-full flex items-center justify-center mx-auto shadow-xl">
                    <Hammer className="w-10 h-10 text-slate-400" />
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className={`text-lg font-black uppercase tracking-wider ${
                    enhancementResult.success 
                      ? 'text-emerald-400' 
                      : enhancementResult.destroyed 
                        ? 'text-red-500 animate-pulse' 
                        : 'text-amber-500'
                  }`}>
                    {enhancementResult.success 
                      ? '★ 強化成功 ★' 
                      : enhancementResult.destroyed 
                        ? '☠ 強化失敗！裝備因能量暴壓而碎毀 ☠' 
                        : '強化失敗'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold bg-slate-950/50 p-3 rounded-xl border border-slate-850">
                    {enhancementResult.message}
                  </p>
                </div>

                {!enhancementResult.destroyed && (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex items-center justify-around text-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest select-none">強化前</span>
                      <span className="text-xs font-bold text-slate-300 mt-1">
                        {enhancementResult.oldEnhancement > 0 ? `+${enhancementResult.oldEnhancement} ` : ''}{enhancementResult.itemName}
                      </span>
                    </div>
                    <div className="text-slate-600 font-black">➔</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-widest select-none">強化後</span>
                      <span className={`text-xs font-black mt-1 ${enhancementResult.success ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {enhancementResult.newEnhancement > 0 ? `+${enhancementResult.newEnhancement} ` : ''}{enhancementResult.itemName}
                      </span>
                    </div>
                  </div>
                )}

                {enhancementResult.destroyed && (
                  <div className="bg-red-950/20 p-4.5 rounded-2xl border border-red-900/30 text-center space-y-1">
                    <p className="text-xs text-red-400 font-bold leading-normal">
                      很遺憾，強化所需的強大魔能失去了平衡，這件裝備已經在劇烈震盪中徹底碎化。
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setEnhancementResult(null)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all border border-slate-705"
                >
                  確認
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
