import { ProductCategory } from '../types/product';

export const CURRENT_CATEGORIES: ProductCategory[] = [
  'dry_fruits',
  'nuts',
  'seeds',
  'healthy_snacks',
  'trail_mixes',
  'gift_boxes',
];

export const EXPANSION_CATEGORIES: ProductCategory[] = [
  'functional_foods',
  'gourmet_foods',
  'imported_foods',
  'healthy_foods',
  'wellness_products',
  'fmcg_products',
  'kitchen_essentials',
  'corporate_gifting',
  'premium_daily_essentials',
];

export const ALL_CATEGORIES: ProductCategory[] = [
  ...CURRENT_CATEGORIES,
  ...EXPANSION_CATEGORIES,
];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  dry_fruits: 'Dry Fruits',
  nuts: 'Nuts',
  seeds: 'Seeds',
  healthy_snacks: 'Healthy Snacks',
  trail_mixes: 'Trail Mixes',
  gift_boxes: 'Gift Boxes',
  functional_foods: 'Functional Foods',
  gourmet_foods: 'Gourmet Foods',
  imported_foods: 'Imported Foods',
  healthy_foods: 'Healthy Foods',
  wellness_products: 'Wellness Products',
  fmcg_products: 'FMCG Products',
  kitchen_essentials: 'Kitchen Essentials',
  corporate_gifting: 'Corporate Gifting Products',
  premium_daily_essentials: 'Premium Daily Essentials',
};

export const MARGIN_TARGETS = {
  minGrossMargin: 40, // 40%
  minNetMargin: 20, // 20%
  targetRoi: 100, // 100%
  maxBreakEvenMonths: 6,
};

export const OPPORTUNITY_THRESHOLDS = {
  excellent: 80,
  good: 60,
  moderate: 40,
  avoid: 0,
};

export const GST_RATES: Record<string, number> = {
  dry_fruits: 5,
  nuts: 5,
  seeds: 5,
  healthy_snacks: 12,
  trail_mixes: 12,
  gift_boxes: 18,
  functional_foods: 18,
  gourmet_foods: 12,
  imported_foods: 18,
  healthy_foods: 12,
  wellness_products: 18,
  fmcg_products: 18,
  kitchen_essentials: 18,
  corporate_gifting: 18,
  premium_daily_essentials: 18,
};

export const MARKETPLACE_FEE_RATES: Record<string, number> = {
  amazon_india: 15,
  flipkart: 14,
  blinkit: 20,
  zepto: 20,
  instamart: 18,
  d2c_website: 5, // payment gateway only
};
