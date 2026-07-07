export type WardrobeState = {
  outfitId: string;
  hatId: string;
  shoesId: string;
  wingsId: string;
};

export type GameState = {
  wardrobe: WardrobeState;
  collectedIds: string[];
  talkedNpcIds: string[];
  outfitHistory: string[];
  achievements: string[];
};

export const defaultState: GameState = {
  wardrobe: {
    outfitId: 'pink',
    hatId: 'none-hat',
    shoesId: 'none-shoes',
    wingsId: 'none-wings'
  },
  collectedIds: [],
  talkedNpcIds: [],
  outfitHistory: ['pink'],
  achievements: []
};
