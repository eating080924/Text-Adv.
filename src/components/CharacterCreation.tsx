import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CharacterClass, Faction, Stats } from '../types';
import { CLASS_DATA } from '../data/classes';
import { motion, AnimatePresence } from 'motion/react';
import { Dice6, User, Shield, Target, Wand2, AlertCircle, Flag } from 'lucide-react';

export const CharacterCreation: React.FC = () => {
  const { createCharacter } = useGame();
  const [id, setId] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>(CharacterClass.KNIGHT);
  const [faction, setFaction] = useState<Faction>(Faction.ALFA);
  const [stats, setStats] = useState<Stats>({ str: 0, dex: 0, int: 0, con: 0 });
  const [isRolling, setIsRolling] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const rollStats = () => {
    setIsRolling(true);
    setTimeout(() => {
      setStats({
        str: Math.floor(Math.random() * 10) + 1,
        dex: Math.floor(Math.random() * 10) + 1,
        int: Math.floor(Math.random() * 10) + 1,
        con: Math.floor(Math.random() * 10) + 1,
      });
      setIsRolling(false);
    }, 500);
  };

  const handleCreate = () => {
    if (!id) {
      setErrorModal('請輸入角色 ID');
      return;
    }
    if (stats.str === 0) {
      setErrorModal('請先骰骰子隨機素質');
      return;
    }
    createCharacter(id, charClass, stats, faction);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 p-5 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 max-h-[95vh] flex flex-col overflow-hidden"
      >
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent shrink-0">
          創立你的英雄
        </h1>

        <div className="space-y-4 sm:space-y-6 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          {/* ID Input */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">角色 ID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="輸入你的名字..."
              />
            </div>
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">選擇職業</label>
            <div className="grid grid-cols-3 gap-3">
              {[CharacterClass.KNIGHT, CharacterClass.ELF, CharacterClass.MAGE].map((c) => (
                <button
                  key={c}
                  onClick={() => setCharClass(c)}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                    charClass === c 
                      ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/20' 
                      : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  {c === CharacterClass.KNIGHT && <Shield className="w-6 h-6 mb-1" />}
                  {c === CharacterClass.ELF && <Target className="w-6 h-6 mb-1" />}
                  {c === CharacterClass.MAGE && <Wand2 className="w-6 h-6 mb-1" />}
                  <span className="text-xs font-bold">{c}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">{CLASS_DATA[charClass].description}</p>
          </div>

          {/* Faction Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">選擇陣營 (創立後不可修改)</label>
            <div className="grid grid-cols-3 gap-3">
              {[Faction.ALFA, Faction.BETA, Faction.CORE].map((f) => (
                <button
                  key={f}
                  onClick={() => setFaction(f)}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                    faction === f 
                      ? (f === Faction.ALFA ? 'bg-blue-600 border-blue-400' : f === Faction.BETA ? 'bg-green-600 border-green-400' : 'bg-white border-slate-200 text-slate-900')
                      : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  <Flag className="w-5 h-5 mb-1" />
                  <span className="text-xs font-bold">{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats Rolling */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-slate-400">隨機素質</span>
              <button
                onClick={rollStats}
                disabled={isRolling}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded-full text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Dice6 className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                骰骰子
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">力量 (STR)</span>
                  <span className="font-mono text-blue-400 font-bold">{stats.str}</span>
                </div>
                <span className="text-[8px] text-slate-600">影響近戰傷害</span>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">敏捷 (DEX)</span>
                  <span className="font-mono text-green-400 font-bold">{stats.dex}</span>
                </div>
                <span className="text-[8px] text-slate-600">影響遠程傷害、迴避</span>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">智力 (INT)</span>
                  <span className="font-mono text-purple-400 font-bold">{stats.int}</span>
                </div>
                <span className="text-[8px] text-slate-600">影響MP、魔法傷害/防禦</span>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">體質 (CON)</span>
                  <span className="font-mono text-red-400 font-bold">{stats.con}</span>
                </div>
                <span className="text-[8px] text-slate-600">影響HP、物理防禦</span>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-xl font-bold text-lg shadow-xl shadow-blue-900/20 transition-all transform hover:scale-[1.02] active:scale-95"
          >
            開始冒險
          </button>
        </div>
      </motion.div>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setErrorModal(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xs w-full text-center space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold">提示</h3>
              <p className="text-sm text-slate-400">{errorModal}</p>
              <button 
                onClick={() => setErrorModal(null)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
              >
                我知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
