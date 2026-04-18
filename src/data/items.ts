import { Item } from '../types';

export const ITEM_DATA: Item[] = [
  // Weapons
  { id: 'iron_sword', name: '鐵劍', description: '普通的鐵劍。', type: 'weapon', hands: 1, price: 1, stats: { atk: 6 }, range: 1 },
  { id: 'long_bow', name: '長弓', description: '適合遠程攻擊。', type: 'weapon', hands: 2, price: 1, stats: { atk: 4, dex: 2 }, range: 6 },
  { id: 'apprentice_staff', name: '學徒法杖', description: '注入了微弱魔力。', type: 'weapon', hands: 2, price: 1, stats: { atk: 1, int: 2 }, range: 1 },
  
  // Armor
  { id: 'leather_cap', name: '皮帽', description: '輕便的頭部護具。', type: 'armor', armorSlot: 'head', price: 1, stats: { def: 2 } },
  { id: 'leather_armor', name: '皮甲', description: '輕便的身體護具。', type: 'armor', armorSlot: 'body', price: 1, stats: { def: 5, hp: 20 } },
  { id: 'leather_gloves', name: '皮手套', description: '輕便的手部護具。', type: 'armor', armorSlot: 'gloves', price: 1, stats: { def: 1 } },
  { id: 'old_cloak', name: '舊披風', description: '有些破舊的披風。', type: 'armor', armorSlot: 'cloak', price: 1, stats: { def: 1, mp: 10 } },
  { id: 'wooden_shield', name: '木盾', description: '簡單的木製盾牌。', type: 'armor', armorSlot: 'shield', price: 1, stats: { def: 3 } },
  { id: 'chain_mail', name: '鎖子甲', description: '提供不錯的防禦。', type: 'armor', armorSlot: 'body', price: 1, stats: { def: 15, hp: 50 } },
  
  // Accessories
  { id: 'ring_of_strength', name: '力量戒指', description: '增加力量的戒指。', type: 'accessory', price: 1, stats: { str: 2 } },
  { id: 'necklace_of_life', name: '生命項鍊', description: '增加生命的項鍊。', type: 'accessory', price: 1, stats: { hp: 30 } },

  // Potions
  { id: 'hp_potion_s', name: '小紅水', description: '回復 50 點 HP。', type: 'potion', price: 1, stats: { hp: 50 } },
  { id: 'mp_potion_s', name: '小藍水', description: '回復 30 點 MP。', type: 'potion', price: 1, stats: { mp: 30 } },
  { id: 'haste_potion', name: '速度藥水', description: '短時間內大幅提升攻擊速度。', type: 'potion', price: 1 },
  
  // Scrolls
  { id: 'weapon_scroll', name: '武器強化卷軸', description: '有機率強化武器攻擊力。', type: 'item', price: 1, isScroll: true, scrollType: 'weapon' },
  { id: 'armor_scroll', name: '防具強化卷軸', description: '有機率強化防具防禦力。', type: 'item', price: 1, isScroll: true, scrollType: 'armor' },
  
  // Items
  { id: 'return_scroll', name: '回城卷軸', description: '瞬間回到旅館。', type: 'item', price: 50 },
  
  // Skill Books
  { id: 'skill_book_meditation', name: '技能書：冥想', description: '學習冥想技能。', type: 'skillBook', price: 1, skillId: 'meditation' },
  { id: 'skill_book_shield_bash', name: '技能書：盾擊', description: '學習盾擊技能。', type: 'skillBook', price: 1, skillId: 'shield_bash' },
  { id: 'skill_book_double_shot', name: '技能書：二連射', description: '學習二連射技能。', type: 'skillBook', price: 1, skillId: 'double_shot' },
  { id: 'skill_book_fireball', name: '技能書：火球術', description: '學習火球術技能。', type: 'skillBook', price: 1, skillId: 'fireball' },
];
