'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingCart, Zap, BarChart3, RefreshCw,
  ArrowUp, ArrowDown, Minus, Globe,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface MarketplaceSummary {
  amazon: { bestSellers: number; moversShakers: number; newReleases: number; mostWished: number; total: number };
  flipkart: { bestSellers: number; trending: number; fastGrowingCategories: number; total: number };
  googleTrends: { keywordsAnalyzed: number; risingTrends: number; seasonalInsights: number; forecasts: number };
}

interface TrendingProduct {
  name: string;
  category: string;
  brand: string;
  selling_price: number;
  estimated_monthly_sales: number;
  growth_rate: number;
  rating: number;
  source_marketplace: string;
  growth_percent: number | null;
}

interface RisingTrend {
  keyword: string;
  cluster: string;
  currentInterest: number;
  trendDirection: 'rising' | 'stable' | 'declining';
  growthRate: number;
  forecastNextMonth: number;
}

export default function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [risingTrends, setRisingTrends] = useState<RisingTrend[]>([]);
  const [activeTab, setActiveTab] = useState<'amazon' | 'flipkart' | 'trends'>('amazon');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [trendingRes, risingRes] = await Promise.all([
        api.get('/marketplace/amazon/trending?limit=20').catch(() => ({ data: { data: [] } })),
        api.get('/marketplace/trends/rising?limit=15').catch(() => ({ data: { data: [] } })),
      ]);
      setTrendingProducts(trendingRes.data.data || []);
      setRisingTrends(risingRes.data.data || []);
    } catch (error) {
      console.error('Failed to load marketplace data', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerRefresh() {
    try {
      setRefreshing(true);
      await api.post('/marketplace/refresh');
      // The refresh runs in background; show notification
      alert('Marketplace refresh started! This will take several minutes.');
    } catch (error) {
      console.error('Refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Intelligence</h1>
          <p className="text-gray-500 mt-1">Real-time monitoring across Amazon, Flipkart & Google Trends</p>
        </div>
        <button
          onClick={triggerRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Platform Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={activeTab === 'amazon'} onClick={() => setActiveTab('amazon')} icon={<ShoppingCart className="w-4 h-4" />} label="Amazon India" />
        <TabButton active={activeTab === 'flipkart'} onClick={() => setActiveTab('flipkart')} icon={<Zap className="w-4 h-4" />} label="Flipkart" />
        <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} icon={<Globe className="w-4 h-4" />} label="Google Trends" />
      </div>

      {/* Content */}
      {activeTab === 'amazon' && (
        <div className="space-y-6">
          {/* Amazon KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <KPICard title="Best Sellers" value="Tracking" icon={<TrendingUp className="w-4 h-4 text-orange-500" />} subtitle="Top products by category" />
            <KPICard title="Movers & Shakers" value="Monitoring" icon={<ArrowUp className="w-4 h-4 text-green-500" />} subtitle="Biggest rank improvements" />
            <KPICard title="New Releases" value="Scanning" icon={<Zap className="w-4 h-4 text-blue-500" />} subtitle="Recently launched products" />
            <KPICard title="Most Wished" value="Active" icon={<BarChart3 className="w-4 h-4 text-purple-500" />} subtitle="Highest demand signals" />
          </div>

          {/* Trending Products Table */}
          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Amazon India - Trending Products</h2>
              <p className="text-xs text-gray-500">Products with highest growth in sales rank</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Product</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Price</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Sales/mo</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Growth</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b"><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse"></div></td></tr>
                    ))
                  ) : trendingProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No trending data yet. Click Refresh to start scanning.</td></tr>
                  ) : (
                    trendingProducts.map((p, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm text-gray-900 truncate max-w-xs">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.brand} | {p.category?.replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.selling_price)}</td>
                        <td className="px-4 py-3 text-sm text-right">{p.estimated_monthly_sales || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <GrowthBadge value={p.growth_rate || p.growth_percent} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{p.rating ? `${p.rating}/5` : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'flipkart' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Best Sellers" value="Tracking" icon={<TrendingUp className="w-4 h-4 text-blue-600" />} subtitle="Category-wise top products" />
            <KPICard title="Trending" value="Monitoring" icon={<Zap className="w-4 h-4 text-yellow-500" />} subtitle="New products gaining traction" />
            <KPICard title="Fast-Growing" value="Analyzing" icon={<BarChart3 className="w-4 h-4 text-green-500" />} subtitle="Categories with high growth" />
          </div>
          <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="font-medium text-gray-700">Flipkart Intelligence</h3>
            <p className="text-sm mt-1">Click &quot;Refresh All&quot; to start scanning Flipkart marketplace data</p>
            <p className="text-xs mt-3 text-gray-400">Monitors: Best Sellers, Trending Products, Fast-Growing Categories</p>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <KPICard title="Keywords Tracked" value={`${risingTrends.length > 0 ? '70+' : '0'}`} icon={<Globe className="w-4 h-4 text-blue-600" />} subtitle="Across 9 clusters" />
            <KPICard title="Rising Trends" value={`${risingTrends.filter(t => t.trendDirection === 'rising').length}`} icon={<ArrowUp className="w-4 h-4 text-green-500" />} subtitle="High growth signals" />
            <KPICard title="Seasonal Peaks" value="Mapped" icon={<BarChart3 className="w-4 h-4 text-orange-500" />} subtitle="Festival & seasonal patterns" />
            <KPICard title="Forecasts" value="Active" icon={<TrendingUp className="w-4 h-4 text-purple-500" />} subtitle="30/90 day predictions" />
          </div>

          {/* Rising Trends */}
          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Rising Google Trends</h2>
              <p className="text-xs text-gray-500">Keywords with growing search interest in India</p>
            </div>
            <div className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse"><div className="h-5 bg-gray-100 rounded w-1/3"></div></div>
                ))
              ) : risingTrends.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Globe className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No trend data available. Refresh to start tracking.</p>
                </div>
              ) : (
                risingTrends.map((trend, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{trend.keyword}</p>
                      <p className="text-xs text-gray-500 capitalize">{trend.cluster?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Interest</p>
                        <p className="text-sm font-bold">{trend.currentInterest}/100</p>
                      </div>
                      <GrowthBadge value={trend.growthRate} />
                      <DirectionIcon direction={trend.trendDirection} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
        active ? 'bg-nature-50 text-nature-700 border border-nature-200 font-medium' : 'bg-white border text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function KPICard({ title, value, icon, subtitle }: { title: string; value: string; icon: React.ReactNode; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

function GrowthBadge({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-400 text-xs">-</span>;
  const color = value > 0 ? 'text-green-600 bg-green-50' : value < 0 ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {value > 0 ? '+' : ''}{Math.round(value)}%
    </span>
  );
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'rising') return <ArrowUp className="w-4 h-4 text-green-500" />;
  if (direction === 'declining') return <ArrowDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}
