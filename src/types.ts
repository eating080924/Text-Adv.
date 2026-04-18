export enum CharacterClass {
  KNIGHT = '騎士',
  ELF = '妖精',
  MAGE = '法師',
}

export enum Faction {
  ALFA = 'Alfa',
  BETA = 'Beta',
  CORE = 'Core',
}

export interface Stats {
  str: number;
  dex: number;
  int: number;
  con: number;
}

export interface DerivedStats {
  meleeAtk: number;
  rangedAtk: number;
  magicAtk: number;
  physDef: number;
  magicDef: number;
  maxHp: number;
  maxMp: number;
  attackSpeed: number;
  evasion: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'active' | 'passive' | 'buff';
  category: 'common' | 'class';
  requiredClass?: CharacterClass;
  mpCost: number;
  cooldown: number;
  duration?: number; // for buffs
  range?: number;
  effect: (player: any, target?: any) => any;
  icon: string;
}

export type ItemType = 'weapon' | 'armor' | 'potion' | 'item' | 'skillBook' | 'accessory';
export type ArmorSlot = 'head' | 'body' | 'cloak' | 'gloves' | 'shield';
export type WeaponHands = 1 | 2;

export interface ItemInstance {
  id: string;
  instanceId: string;
  enhancement: number;
  quantity: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  armorSlot?: ArmorSlot;
  hands?: WeaponHands;
  price: number;
  stats?: Partial<Stats & { hp: number; mp: number; atk: number; def: number; mAtk?: number; pDef?: number; mDef?: number }>;
  range?: number;
  skillId?: string; // for skill books
  isScroll?: boolean;
  scrollType?: 'weapon' | 'armor';
}

export interface Drop {
  itemId: string;
  chance: number; // 0 to 1
}

export interface Enemy {
  id: string;
  name: string;
  type: 'normal' | 'miniboss' | 'boss';
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  range: number;
  exp: number;
  gold: number;
  behavior: 'active' | 'passive';
  respawnTime: number; // in seconds
  dropTable: Drop[];
}

export interface SubMapEnemy extends Enemy {
  instanceId: string;
  distance: number;
  respawnTimer: number;
  targetUid?: string;
  isPlayer?: boolean;
}

export interface SubMap {
  id: string;
  name: string;
  description: string;
  enemies: string[]; // enemy IDs
  hasMiniBoss?: boolean;
  hasBoss?: boolean;
}

export interface MainMap {
  id: string;
  name: string;
  subMaps: SubMap[];
}

export interface Player {
  id: string;
  uid?: string;
  deleted?: boolean;
  isInWorld?: boolean;
  class: CharacterClass;
  faction: Faction;
  level: number;
  exp: number;
  nextLevelExp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  meleeAtk: number;
  rangedAtk: number;
  magicAtk: number;
  physDef: number;
  magicDef: number;
  evasion: number;
  gold: number;
  inventory: ItemInstance[];
  skills: string[]; // skill IDs
  equipment: {
    weapon?: string;
    head?: string;
    body?: string;
    cloak?: string;
    gloves?: string;
    shield?: string;
    accessory?: string;
  };
  quickItems: (string | null)[]; // 4 slots
  quickSkills: (string | null)[]; // 4 slots
  attackSpeed: number;
  autoPotionHpThreshold: number;
  autoPotionMpThreshold: number;
  autoSkills: string[];
  pvpKills: number;
  pvpDeaths: number;
  lastAttackerName?: string;
}

export interface GameState {
  player: Player | null;
  currentMap: MainMap | null;
  currentSubMap: SubMap | null;
  subMapEnemies: any[]; // Use any for SubMapEnemy to avoid circular dependency or move it too
  inCombat: boolean;
  currentEnemy: any | null;
  selectedEnemyInstanceId: string | null;
  combatLogs: string[];
  isAutoAttacking: boolean;
  activeBuffs: { id: string; remaining: number }[];
  cooldowns: Record<string, number>;
  attackProgress: number;
  timeInMap: number;
  isWorldBossActive: boolean;
  worldBoss: any | null;
  worldPlayers: Player[];
  worldEnemies: any[];
}
