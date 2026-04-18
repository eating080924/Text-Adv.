import { CharacterClass, Stats } from '../types';

export const CLASS_DATA: Record<CharacterClass, { description: string; baseStats: Stats; growth: Stats }> = {
  [CharacterClass.KNIGHT]: {
    description: '擁有強大的防禦力與近戰攻擊力。',
    baseStats: { str: 10, dex: 5, int: 3, con: 12 },
    growth: { str: 2, dex: 1, int: 0.5, con: 2.5 },
  },
  [CharacterClass.ELF]: {
    description: '擅長遠程攻擊與敏捷行動。',
    baseStats: { str: 5, dex: 12, int: 6, con: 7 },
    growth: { str: 1, dex: 2.5, int: 1, con: 1.5 },
  },
  [CharacterClass.MAGE]: {
    description: '精通強大的魔法攻擊，但體質較弱。',
    baseStats: { str: 3, dex: 6, int: 12, con: 5 },
    growth: { str: 0.5, dex: 1, int: 3, con: 1 },
  },
};
