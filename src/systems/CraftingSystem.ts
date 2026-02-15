/**
 * CraftingSystem - Recipe checking, item creation
 */
import { gameState } from '../state/GameState';
import { CRAFTING_RECIPES, getAvailableRecipes, CRAFT_CATEGORIES } from '../data/crafting';
import type { CraftingRecipe } from '../data/crafting';

export class CraftingSystem {
  /**
   * Get recipes available at current day
   */
  static getAvailableRecipes(): CraftingRecipe[] {
    return getAvailableRecipes(gameState.data.currentDay);
  }

  /**
   * Check if player can afford a recipe
   */
  static canCraft(recipeId: string): boolean {
    const recipe = CRAFTING_RECIPES[recipeId];
    if (!recipe) return false;
    if (recipe.unlockDay > gameState.data.currentDay) return false;

    for (const [resource, amount] of Object.entries(recipe.costs)) {
      const available = (gameState.data.resources as any)[resource] || 0;
      if (available < amount) return false;
    }
    return true;
  }

  /**
   * Craft an item
   */
  static craft(recipeId: string): boolean {
    if (!CraftingSystem.canCraft(recipeId)) return false;

    const recipe = CRAFTING_RECIPES[recipeId];

    // Spend resources
    for (const [resource, amount] of Object.entries(recipe.costs)) {
      gameState.addResource(resource as any, -amount);
    }

    // Create result
    if (recipe.result.type === 'resource') {
      gameState.addResource(recipe.result.id as any, recipe.result.amount);
    } else if (recipe.result.type === 'item' || recipe.result.type === 'building_kit') {
      gameState.addInventoryItem({
        id: recipe.result.id,
        name: recipe.name,
        nameCN: recipe.nameCN,
        type: recipe.result.type === 'building_kit' ? 'blueprint' : 'consumable',
      }, recipe.result.amount);
    }

    gameState.data.stats.itemsCrafted++;
    return true;
  }

  /**
   * Get categories
   */
  static getCategories() {
    return CRAFT_CATEGORIES;
  }

  /**
   * Get recipes for a category, filtered by day
   */
  static getRecipesForCategory(categoryId: string): CraftingRecipe[] {
    return CraftingSystem.getAvailableRecipes().filter(r => r.category === categoryId);
  }
}
