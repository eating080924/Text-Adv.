import { MainMap } from '../types';

export const MAP_DATA: MainMap[] = [
  {
    id: 'forest',
    name: '迷霧森林',
    subMaps: [
      { id: 'forest_1', name: '森林入口', description: '陽光穿透樹葉，空氣清新的地方。', enemies: ['slime', 'goblin'] },
      { id: 'forest_2', name: '幽暗小徑', description: '樹木變得密集，光線昏暗。', enemies: ['goblin', 'wolf'] },
      { id: 'forest_3', name: '古老祭壇', description: '散發著神秘氣息的石台。', enemies: ['wolf', 'goblin_shaman'], hasMiniBoss: true },
      { id: 'forest_4', name: '森林深處', description: '傳說中守護者居住的地方。', enemies: ['wolf', 'forest_guardian'], hasBoss: true },
    ],
  },
  {
    id: 'cave',
    name: '幽暗礦坑',
    subMaps: [
      { id: 'cave_1', name: '礦坑坑道', description: '潮濕且充滿土腥味。', enemies: ['bat', 'spider'] },
      { id: 'cave_2', name: '廢棄採掘場', description: '到處是散落的工具。', enemies: ['spider', 'skeleton'] },
      { id: 'cave_3', name: '幽靈迴廊', description: '迴盪著奇怪的聲音。', enemies: ['skeleton', 'wraith'], hasMiniBoss: true },
      { id: 'cave_4', name: '地底神殿', description: '被遺忘的古老文明遺跡。', enemies: ['wraith', 'lich'], hasBoss: true },
    ],
  },
  {
    id: 'volcano',
    name: '烈焰火山',
    subMaps: [
      { id: 'volcano_1', name: '火山腳下', description: '地面滾燙，空氣中充滿硫磺味。', enemies: ['fire_slime', 'lizard'] },
      { id: 'volcano_2', name: '熔岩路徑', description: '兩旁是流動的岩漿。', enemies: ['lizard', 'fire_elemental'] },
      { id: 'volcano_3', name: '火山口', description: '熱浪逼人，視線模糊。', enemies: ['fire_elemental', 'magma_golem'], hasMiniBoss: true },
      { id: 'volcano_4', name: '炎魔王座', description: '統治這片火山的王者所在地。', enemies: ['magma_golem', 'fire_dragon'], hasBoss: true },
    ],
  },
];
