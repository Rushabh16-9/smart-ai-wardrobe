// Shared TypeScript types for the Smart AI Wardrobe app

export interface WardrobeItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url?: string;
  type?: string;
  color?: string;
  pattern?: string;
  season?: string[];
  formality?: string;
  tags?: string[];
  source_url?: string;
  brand?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WearHistory {
  id: string;
  user_id: string;
  outfit_items: string[];
  occasion?: string;
  worn_at: string;
  notes?: string;
  ai_suggestion?: OutfitSuggestion;
  created_at: string;
}

export interface AICategorizationResult {
  type: string;
  color: string;
  pattern: string;
  season: string[];
  formality: string;
}

export interface OutfitItem {
  id: string;
  image_url: string;
  type: string;
  color: string;
  reason: string;
}

export interface BuyingSuggestion {
  type: string;
  color: string;
  description: string;
  reason: string;
}

export interface OutfitSuggestion {
  occasion: string;
  outfit_name: string;
  items: OutfitItem[];
  styling_tips: string[];
  buy_suggestion: BuyingSuggestion;
}

export type Formality = 'Casual' | 'Smart Casual' | 'Business Casual' | 'Semi-Formal' | 'Formal' | 'Black Tie';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'All Season';
export type Category =
  | 'T-Shirt'
  | 'Shirt'
  | 'Blouse'
  | 'Sweater'
  | 'Hoodie'
  | 'Jacket'
  | 'Coat'
  | 'Dress'
  | 'Skirt'
  | 'Trousers'
  | 'Jeans'
  | 'Shorts'
  | 'Suit'
  | 'Blazer'
  | 'Sneakers'
  | 'Boots'
  | 'Heels'
  | 'Loafers'
  | 'Sandals'
  | 'Accessory'
  | 'Bag'
  | 'Hat'
  | 'Scarf'
  | 'Belt'
  | 'Other';
