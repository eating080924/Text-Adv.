import { CharacterClass, Skill } from '../types';

export const SKILL_DATA: Skill[] = [
  // Common
  {
    id: 'meditation',
    name: '冥想',
    description: '靜下心來，緩慢回復 MP。',
    type: 'buff',
    category: 'common',
    requiredClass: CharacterClass.MAGE,
    mpCost: 0,
    cooldown: 5,
    duration: 1,
    icon: 'Brain',
    effect: (player) => ({ ...player, mpRegen: 1 }),
  },
  
  // Knight
  {
    id: 'shield_bash',
    name: '盾擊',
    description: '用盾牌重擊敵人，造成傷害並擊退。',
    type: 'active',
    category: 'class',
    requiredClass: CharacterClass.KNIGHT,
    mpCost: 15,
    cooldown: 0,
    range: 1,
    icon: 'Shield',
    effect: (player, target) => {
      const damage = Math.floor(Math.max(1, (player.meleeAtk + player.stats.str * 1.5) - target.def));
      return { damage, effect: 'stun' };
    },
  },
  {
    id: 'warcry',
    name: '戰吼',
    description: '提升自己的攻擊力，持續一段時間。',
    type: 'buff',
    category: 'class',
    requiredClass: CharacterClass.KNIGHT,
    mpCost: 20,
    cooldown: 0,
    duration: 15,
    icon: 'Swords',
    effect: (player) => ({ ...player }),
  },
  
  // Elf
  {
    id: 'double_shot',
    name: '二連射',
    description: '快速射出兩支箭。',
    type: 'active',
    category: 'class',
    requiredClass: CharacterClass.ELF,
    mpCost: 20,
    cooldown: 0,
    range: 8,
    icon: 'Target',
    effect: (player, target) => {
      const damage = Math.floor(Math.max(1, (player.rangedAtk * 0.8 + player.stats.dex * 1.2) - target.def) * 2);
      return { damage };
    },
  },
  {
    id: 'wind_walk',
    name: '風之步',
    description: '提升移動速度與閃避率。',
    type: 'buff',
    category: 'class',
    requiredClass: CharacterClass.ELF,
    mpCost: 25,
    cooldown: 0,
    duration: 12,
    icon: 'Wind',
    effect: (player) => ({ ...player }),
  },
  
  // Mage
  {
    id: 'fireball',
    name: '火球術',
    description: '發射一顆巨大的火球。',
    type: 'active',
    category: 'class',
    requiredClass: CharacterClass.MAGE,
    mpCost: 8,
    cooldown: 0,
    range: 6,
    icon: 'Flame',
    effect: (player, target) => {
      const damage = Math.floor(Math.max(1, (player.magicAtk * 1.5 + player.stats.int * 2.5) - target.def));
      return { damage };
    },
  },
  {
    id: 'mana_shield',
    name: '魔力護盾',
    description: '用魔力抵擋傷害。',
    type: 'buff',
    category: 'class',
    requiredClass: CharacterClass.MAGE,
    mpCost: 40,
    cooldown: 0,
    duration: 20,
    icon: 'ShieldAlert',
    effect: (player) => ({ ...player, shield: 100 }),
  },
];
