import { Enemy } from '../types';

export const WORLD_BOSS_DATA: Enemy = {
  id: 'world_boss_dragon',
  name: '世界領主：遠古巨龍',
  hp: 5, // 1000000
  maxHp: 5,
  mp: 10000,
  maxMp: 10000,
  atk: 0, // 500
  def: 300,
  range: 5,
  exp: 50000,
  gold: 10000,
  type: 'boss',
  behavior: 'passive', // 被動攻擊
  respawnTime: 14400, // 4 hours
  dropTable: [
    { itemId: 'dragon_scale', chance: 1 },
    { itemId: 'dragon_heart', chance: 0.1 },
    { itemId: 'legendary_scroll', chance: 0.05 }
  ]
};
