'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Trophy, TrendingUp, Building2, ShoppingBag, Repeat, Wallet } from 'lucide-react';
import { recommendationsApi } from '@/lib/api';
import { getScoreBgColor } from '@/lib/utils';

const CATEGORIES = [
  { value: 'top_products_to_launch', label: 'Top Products to Launch', icon: Trophy, color: 'text-yellow-600' },
  { value: 'top_white_label_opportunities', label: 'White-Label Opportunities', icon: TrendingUp, color: 'text-blue-600' },
  { value: 'top_d2c_products', label: 'D2C Products', icon: ShoppingBag, color: 'text-purple-600' },
  { value: 'top_corporate_gifting', label: 'Corporate Gifting', icon: Building2, color: 'text-green-600' },
  { value: 'top_blinkit_products', label: 'Blinkit Products', icon: ShoppingBag, color: 'text-orange-600' },
  { value: 'top_zepto_products', label: 'Zepto Products', icon: ShoppingBag, color: 'text-pink-600' },
  { value: 'top_repeat_purchase', label: 'High Repeat Purchase', icon: Repeat, color: 'text-indigo-600' },
  { value: 'top_low_investment', label: 'Low Investment', icon: Wallet, color: 'text-emerald-600' },
];

interface Recommendation {
  rank: number;
  productId: string;
  productName: string;
  score: number;
  reasoning: string;
  keyMetrics: {
    demand: number;
    margin: number;
    competition: number;
    supplierAvailability: number;
    repeatPurchase: number;
  };
}

export default function RecommendationsPage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]!.value);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadRecommendations(activeCategory);
  }, [activeCategory]);

  async function loadRecommendations(category: string) {
    try {
      setLoading(true);
      const res = await recommendationsApi.getByCategory(category);
      setRecommendations(res.data.data || []);
    } catch (error) {
      console.error('Failed to load recommendations', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true);
      await recommendationsApi.generate(activeCategory);
      await loadRecommendations(activeCategory);
    } catch (error) {
      console.error('Failed to generate recommendations', error);
    } finally {
      setGenerating(false);
    }
  }

  const activeCat = CATEGORIES.find(c => c.value === activeCategory)!;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Recommendations</h1>
          <p className="text-gray-500 mt-1">AI-powered product launch recommendations by category</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition disabled:opacity-50"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Generate Fresh'}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                activeCategory === cat.value
                  ? 'bg-nature-50 text-nature-700 border border-nature-200 font-medium'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeCategory === cat.value ? 'text-nature-600' : cat.color}`} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Recommendations List */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Top 10: {activeCat.label}</h2>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No recommendations yet</p>
            <p className="text-sm mt-1">Click &quot;Generate Fresh&quot; to create AI-powered recommendations</p>
          </div>
        ) : (
          <div className="divide-y">
            {recommendations.map((rec) => (
              <div key={rec.rank} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className="w-8 h-8 rounded-full bg-nature-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-nature-700">#{rec.rank}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{rec.productName || 'Product'}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreBgColor(rec.score)}`}>
                        {rec.score}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{rec.reasoning}</p>
                    
                    {/* Metrics */}
                    <div className="flex gap-4 mt-2">
                      <MetricBadge label="Demand" value={rec.keyMetrics.demand} />
                      <MetricBadge label="Margin" value={rec.keyMetrics.margin} />
                      <MetricBadge label="Low Comp." value={rec.keyMetrics.competition} />
                      <MetricBadge label="Suppliers" value={rec.keyMetrics.supplierAvailability} />
                      <MetricBadge label="Repeat" value={rec.keyMetrics.repeatPurchase} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'text-green-600 bg-green-50' :
                value >= 40 ? 'text-yellow-600 bg-yellow-50' :
                'text-red-600 bg-red-50';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}: {Math.round(value)}
    </span>
  );
}
