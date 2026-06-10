import { ItemInstance } from '../types';

/**
 * 取得強化成功機率 (0.0 ~ 1.0)
 * 預設公式：1.0 - (當前強化等級 * 0.1)
 * 例如： 
 * +0 -> 100%
 * +1 -> 90%
 * +2 -> 80%
 * +5 -> 50%
 * +9 -> 10%
 * 最低機率為 10% (0.1)
 */
export function getEnhancementSuccessChance(itemInstance: ItemInstance): number {
  const currentEnhancement = itemInstance.enhancement || 0;
  return Math.max(0.1, 1.0 - (currentEnhancement * 0.1));
}

/**
 * 取得強化失敗時，裝備消失/碎裂的機率 (0.0 ~ 1.0)
 * 預設公式：當前強化等級 * 0.02 (2%)
 * 例如：
 * +0 失敗 -> 0% 消失
 * +1 失敗 -> 2% 消失
 * +5 失敗 -> 10% 消失
 * +9 失敗 -> 18% 消失
 */
export function getEnhancementDestructionChance(itemInstance: ItemInstance): number {
  const currentEnhancement = itemInstance.enhancement || 0;
  return Math.max(0, currentEnhancement * 0.02);
}

/**
 * 執行強化機率計算
 * @returns 包含 success (是否成功) 與 destroyed (是否碎裂消失) 的結果
 */
export function calculateEnhancement(itemInstance: ItemInstance): { success: boolean; destroyed: boolean } {
  const successChance = getEnhancementSuccessChance(itemInstance);
  const isSuccess = Math.random() < successChance;

  if (isSuccess) {
    return { success: true, destroyed: false };
  }

  // 強化失敗時，計算是否消失
  const destructionChance = getEnhancementDestructionChance(itemInstance);
  const isDestroyed = Math.random() < destructionChance;

  return { success: false, destroyed: isDestroyed };
}
