import { Enemy } from '../types';

export const ENEMY_DATA: Record<string, Omit<Enemy, 'hp' | 'mp'>> = {
  slime: { id: 'slime', name: '史萊姆', type: 'normal', maxHp: 50, maxMp: 10, atk: 5, def: 2, range: 1, exp: 10, gold: 5, behavior: 'passive', respawnTime: 10, dropTable: [{ itemId: 'hp_potion_s', chance: 0.3 }] },
  goblin: { id: 'goblin', name: '哥布林', type: 'normal', maxHp: 80, maxMp: 20, atk: 12, def: 5, range: 1, exp: 25, gold: 10, behavior: 'active', respawnTime: 15, dropTable: [{ itemId: 'iron_sword', chance: 0.05 }, { itemId: 'leather_armor', chance: 0.05 }] },
  wolf: { id: 'wolf', name: '灰狼', type: 'normal', maxHp: 120, maxMp: 0, atk: 18, def: 8, range: 1, exp: 40, gold: 15, behavior: 'active', respawnTime: 20, dropTable: [{ itemId: 'hp_potion_s', chance: 0.1 }] },
  goblin_shaman: { id: 'goblin_shaman', name: '哥布林薩滿', type: 'miniboss', maxHp: 300, maxMp: 100, atk: 25, def: 10, range: 5, exp: 150, gold: 100, behavior: 'active', respawnTime: 60, dropTable: [{ itemId: 'apprentice_staff', chance: 0.2 }, { itemId: 'skill_book_meditation', chance: 0.1 }] },
  forest_guardian: { id: 'forest_guardian', name: '森林守護者', type: 'boss', maxHp: 1000, maxMp: 200, atk: 45, def: 30, range: 2, exp: 1000, gold: 500, behavior: 'active', respawnTime: 300, dropTable: [{ itemId: 'chain_mail', chance: 0.5 }] },
  
  bat: { id: 'bat', name: '蝙蝠', type: 'normal', maxHp: 40, maxMp: 0, atk: 8, def: 3, range: 1, exp: 15, gold: 8, behavior: 'active', respawnTime: 10, dropTable: [{ itemId: 'mp_potion_s', chance: 0.2 }] },
  spider: { id: 'spider', name: '毒蜘蛛', type: 'normal', maxHp: 90, maxMp: 30, atk: 15, def: 6, range: 1, exp: 30, gold: 18, behavior: 'active', respawnTime: 15, dropTable: [{ itemId: 'hp_potion_s', chance: 0.15 }] },
  skeleton: { id: 'skeleton', name: '骷髏兵', type: 'normal', maxHp: 150, maxMp: 0, atk: 22, def: 15, range: 1, exp: 55, gold: 30, behavior: 'passive', respawnTime: 20, dropTable: [{ itemId: 'iron_sword', chance: 0.1 }] },
  wraith: { id: 'wraith', name: '幽靈', type: 'miniboss', maxHp: 400, maxMp: 150, atk: 35, def: 20, range: 3, exp: 250, gold: 150, behavior: 'active', respawnTime: 60, dropTable: [{ itemId: 'mp_potion_s', chance: 0.3 }] },
  lich: { id: 'lich', name: '巫妖', type: 'boss', maxHp: 1500, maxMp: 500, atk: 60, def: 40, range: 6, exp: 2000, gold: 1000, behavior: 'active', respawnTime: 300, dropTable: [{ itemId: 'apprentice_staff', chance: 0.5 }] },

  fire_slime: { id: 'fire_slime', name: '熔岩史萊姆', type: 'normal', maxHp: 100, maxMp: 20, atk: 15, def: 10, range: 1, exp: 40, gold: 25, behavior: 'passive', respawnTime: 10, dropTable: [{ itemId: 'hp_potion_s', chance: 0.2 }] },
  lizard: { id: 'lizard', name: '火蜥蜴', type: 'normal', maxHp: 200, maxMp: 40, atk: 28, def: 18, range: 1, exp: 80, gold: 50, behavior: 'active', respawnTime: 15, dropTable: [{ itemId: 'leather_armor', chance: 0.1 }] },
  fire_elemental: { id: 'fire_elemental', name: '火元素', type: 'normal', maxHp: 350, maxMp: 200, atk: 45, def: 25, range: 4, exp: 150, gold: 100, behavior: 'active', respawnTime: 20, dropTable: [{ itemId: 'mp_potion_s', chance: 0.25 }] },
  magma_golem: { id: 'magma_golem', name: '熔岩巨像', type: 'miniboss', maxHp: 800, maxMp: 0, atk: 70, def: 60, range: 2, exp: 600, gold: 400, behavior: 'active', respawnTime: 60, dropTable: [{ itemId: 'chain_mail', chance: 0.2 }] },
  fire_dragon: { id: 'fire_dragon', name: '烈焰巨龍', type: 'boss', maxHp: 5000, maxMp: 1000, atk: 120, def: 100, range: 8, exp: 10000, gold: 5000, behavior: 'active', respawnTime: 300, dropTable: [{ itemId: 'chain_mail', chance: 1.0 }] },
};
