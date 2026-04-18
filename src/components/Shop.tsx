import React from 'react';
import { useGame } from '../context/GameContext';
import { ITEM_DATA } from '../data/items';
import { ShoppingCart, Coins, Package } from 'lucide-react';

export const Shop: React.FC = () => {
  const { player, buyItem, sellItem } = useGame();

  if (!player) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-yellow-500" />
          冒險者商店
        </h2>
        <div className="bg-slate-800 px-3 py-1 rounded-full flex items-center gap-2 text-yellow-400 font-bold">
          <Coins className="w-4 h-4" />
          {player.gold}
        </div>
      </div>

      <div className="grid gap-4">
        {ITEM_DATA.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <h3 className="font-bold">{item.name}</h3>
                <p className="text-xs text-slate-500">{item.description}</p>
                {item.stats && (
                  <div className="flex gap-2 mt-1">
                    {Object.entries(item.stats).map(([key, val]) => (
                      <span key={key} className="text-[10px] bg-slate-800 px-1 rounded text-blue-400 uppercase">
                        {key}+{val}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => buyItem(item.id)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Coins className="w-4 h-4" />
              {item.price}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">你的背包 (點擊賣出)</h3>
        <div className="grid grid-cols-4 gap-2">
          {player.inventory.map((instance, index) => {
            const item = ITEM_DATA.find(i => i.id === instance.id);
            if (!item) return null;
            return (
              <button
                key={`${instance.instanceId}`}
                onClick={() => sellItem(instance.instanceId)}
                className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex flex-col items-center hover:bg-red-900/20 hover:border-red-500/50 transition-all group"
              >
                <Package className="w-6 h-6 mb-1 text-slate-500 group-hover:text-red-500" />
                <span className="text-[8px] font-bold truncate w-full text-center">
                  {instance.enhancement > 0 ? `+${instance.enhancement} ` : ''}{item.name}
                  {instance.quantity > 1 ? ` (x${instance.quantity})` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
