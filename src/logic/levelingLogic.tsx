import { Player, CharacterClass } from '../types';

export interface LevelUpResult {
  player: Player;
  leveledUp: boolean;
  newSkills: string[];
}

/**
 * Handles experience gain and level up logic.
 */
export const handleExperienceGain = (player: Player, expGained: number): LevelUpResult => {
  let newPlayer = { ...player };
  let leveledUp = false;
  const newSkills: string[] = [];

  newPlayer.exp += expGained;

  while (newPlayer.exp >= newPlayer.nextLevelExp) {
    leveledUp = true;
    newPlayer.exp -= newPlayer.nextLevelExp;
    newPlayer.level += 1;
    newPlayer.nextLevelExp = Math.floor(newPlayer.nextLevelExp * 1.5);

    // Increase base stats
    newPlayer.stats.str += 2;
    newPlayer.stats.dex += 2;
    newPlayer.stats.int += 2;
    newPlayer.stats.con += 2;

    // Class specific bonuses
    if (newPlayer.class === CharacterClass.KNIGHT) {
      newPlayer.stats.str += 2;
      newPlayer.stats.con += 2;
    } else if (newPlayer.class === CharacterClass.ELF) {
      newPlayer.stats.dex += 3;
      newPlayer.stats.int += 1;
    } else if (newPlayer.class === CharacterClass.MAGE) {
      newPlayer.stats.int += 4;
    }

    // Fully heal on level up
    newPlayer.hp = newPlayer.maxHp;
    newPlayer.mp = newPlayer.maxMp;
  }

  return { player: newPlayer, leveledUp, newSkills };
};
