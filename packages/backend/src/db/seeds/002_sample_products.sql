-- =====================================================
-- Seed Data: Sample Products for Nature's Crates Categories
-- =====================================================

INSERT INTO products (name, category, subcategory, brand, description, selling_price, cost_price, source_marketplace, source_url, asin, rating, reviews_count, estimated_monthly_sales, growth_rate, competition_score, opportunity_score, confidence_score, freshness_score, source_reliability_score, is_white_label_candidate, tags) VALUES

-- Dry Fruits
('Premium California Almonds 1kg - Raw & Natural', 'dry_fruits', 'almonds', 'Happilo', 'Premium quality California almonds, raw and unprocessed', 899, 380, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE1', 'B0EXAMPLE1', 4.3, 12500, 2800, 15.5, 65, 72, 85, 95, 90, true, ARRAY['almonds', 'premium', 'california', 'raw']),

('Organic Cashew Nuts W240 500g', 'nuts', 'cashews', 'Nutraj', 'Premium W240 grade organic cashews from Kerala', 649, 280, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE2', 'B0EXAMPLE2', 4.4, 8900, 2200, 22.0, 58, 78, 82, 90, 88, true, ARRAY['cashews', 'organic', 'w240', 'kerala']),

('Mixed Dry Fruits Gift Box 1kg - Premium Collection', 'gift_boxes', 'mixed_dry_fruits', 'Solimo', 'Assorted premium dry fruits in gift packaging', 1299, 450, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE3', 'B0EXAMPLE3', 4.1, 5600, 1800, 35.0, 45, 85, 80, 88, 85, true, ARRAY['gift_box', 'premium', 'assorted', 'corporate']),

('Chia Seeds 500g - Raw & Unroasted', 'seeds', 'chia_seeds', 'True Elements', 'Premium raw chia seeds, rich in omega-3', 349, 120, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE4', 'B0EXAMPLE4', 4.2, 15000, 3500, 28.0, 55, 80, 88, 92, 90, true, ARRAY['chia_seeds', 'raw', 'omega3', 'superfood']),

('Trail Mix - Protein Power Pack 400g', 'trail_mixes', 'protein_mix', 'Yoga Bar', 'High protein trail mix with nuts, seeds, and berries', 499, 180, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE5', 'B0EXAMPLE5', 4.3, 7200, 2100, 45.0, 42, 82, 85, 90, 88, true, ARRAY['trail_mix', 'protein', 'healthy_snack', 'energy']),

('Roasted Makhana 200g - Peri Peri Flavour', 'healthy_snacks', 'makhana', 'Farmley', 'Crunchy roasted makhana in peri peri flavour', 199, 65, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE6', 'B0EXAMPLE6', 4.0, 22000, 5500, 55.0, 50, 88, 90, 95, 92, true, ARRAY['makhana', 'roasted', 'healthy_snack', 'low_calorie']),

('Premium Walnuts Without Shell 500g', 'dry_fruits', 'walnuts', 'Amazon Brand', 'Chilean walnuts, halves and pieces', 599, 250, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE7', 'B0EXAMPLE7', 4.2, 9800, 1900, 12.0, 62, 70, 83, 88, 90, true, ARRAY['walnuts', 'chilean', 'brain_food', 'omega3']),

('Pumpkin Seeds 400g - Raw & Premium', 'seeds', 'pumpkin_seeds', 'HealthKart', 'Raw pumpkin seeds rich in zinc and magnesium', 399, 140, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE8', 'B0EXAMPLE8', 4.1, 11000, 2800, 30.0, 48, 79, 86, 92, 88, true, ARRAY['pumpkin_seeds', 'raw', 'zinc', 'immunity']),

('Dates Medjool 500g - Premium Quality', 'dry_fruits', 'dates', 'Lion', 'Premium Medjool dates from Saudi Arabia', 799, 320, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE9', 'B0EXAMPLE9', 4.5, 6800, 1600, 18.0, 40, 76, 84, 90, 85, true, ARRAY['dates', 'medjool', 'premium', 'energy']),

('Protein Granola 500g - Chocolate & Almonds', 'functional_foods', 'granola', 'Nourish Organics', 'High protein granola with dark chocolate and almonds', 549, 190, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE10', 'B0EXAMPLE10', 4.4, 4500, 1200, 60.0, 38, 86, 82, 88, 85, true, ARRAY['granola', 'protein', 'functional_food', 'breakfast']),

-- Flipkart Products
('Premium Pistachios Roasted & Salted 500g', 'nuts', 'pistachios', 'Nutty Gritties', 'Roasted and lightly salted Iranian pistachios', 749, 320, 'flipkart', 'https://flipkart.com/product/EXAMPLE11', NULL, 4.3, 7500, 1800, 20.0, 52, 75, 80, 85, 82, true, ARRAY['pistachios', 'roasted', 'salted', 'iranian']),

('Organic Honey 500g - Raw & Unprocessed', 'wellness_products', 'honey', 'Dabur', 'Pure organic honey from Himalayan apiaries', 449, 150, 'flipkart', 'https://flipkart.com/product/EXAMPLE12', NULL, 4.2, 18000, 4200, 25.0, 70, 65, 85, 90, 88, false, ARRAY['honey', 'organic', 'raw', 'himalayan']),

('Quinoa 1kg - White Whole Grain', 'functional_foods', 'quinoa', 'India Gate', 'Premium white quinoa, high protein whole grain', 499, 180, 'flipkart', 'https://flipkart.com/product/EXAMPLE13', NULL, 4.1, 8500, 2000, 35.0, 45, 80, 82, 88, 85, true, ARRAY['quinoa', 'protein', 'gluten_free', 'superfood']),

('Dried Cranberries 400g - Sliced', 'dry_fruits', 'cranberries', 'Berries & Nuts', 'Whole sliced dried cranberries', 349, 120, 'flipkart', 'https://flipkart.com/product/EXAMPLE14', NULL, 4.0, 5200, 1300, 40.0, 35, 82, 78, 85, 80, true, ARRAY['cranberries', 'dried_fruit', 'antioxidant', 'snack']),

('Immunity Booster Mix 300g', 'wellness_products', 'immunity', 'Vedaka', 'Turmeric, ginger, ashwagandha wellness mix', 399, 110, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE15', 'B0EXAMPLE15', 4.0, 6000, 1500, 55.0, 40, 84, 80, 88, 85, true, ARRAY['immunity', 'turmeric', 'ashwagandha', 'wellness']),

-- Quick Commerce Products  
('Almonds 200g - Daily Essentials', 'dry_fruits', 'almonds', 'Happilo', 'Small pack almonds for quick commerce', 249, 95, 'blinkit', NULL, NULL, 4.2, 8000, 6000, 30.0, 60, 70, 75, 95, 80, true, ARRAY['almonds', 'daily', 'quick_commerce', 'small_pack']),

('Mixed Seeds 150g - Snack Pack', 'seeds', 'mixed_seeds', 'True Elements', 'Convenient seed mix snack pack', 149, 45, 'zepto', NULL, NULL, 4.1, 12000, 8000, 50.0, 45, 85, 78, 95, 78, true, ARRAY['seeds', 'snack', 'quick_commerce', 'healthy']),

-- Corporate Gifting
('Luxury Dry Fruit Gift Hamper 2kg', 'corporate_gifting', 'luxury_hamper', NULL, 'Premium luxury gift hamper with assorted dry fruits', 3499, 1200, 'd2c_website', NULL, NULL, 4.6, 200, 450, 80.0, 25, 90, 75, 80, 70, true, ARRAY['corporate', 'luxury', 'gift', 'hamper', 'premium']),

('Wellness Gift Box - Health Essentials', 'corporate_gifting', 'wellness_box', NULL, 'Corporate wellness gift with superfoods and nuts', 1999, 650, 'd2c_website', NULL, NULL, 4.5, 150, 300, 100.0, 20, 92, 72, 80, 68, true, ARRAY['corporate', 'wellness', 'gift', 'health']),

-- Premium Daily Essentials
('Organic Oats 1kg - Steel Cut', 'premium_daily_essentials', 'oats', 'Kelloggs', 'Premium organic steel cut oats', 349, 120, 'amazon_india', 'https://amazon.in/dp/B0EXAMPLE20', 'B0EXAMPLE20', 4.3, 25000, 5000, 15.0, 72, 62, 88, 92, 90, false, ARRAY['oats', 'organic', 'breakfast', 'daily']);
