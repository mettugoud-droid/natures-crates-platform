'use client';

import { useEffect, useState } from 'react';
import { Target, Trophy, Filter, Sparkles, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, getScoreBgColor, getClassificationLabel, truncate } from '@/lib/utils';

interface ProductFinderResult {
  id: string;
  name: string;
  category: string;
  brand: string;
  selling_price: number;
  estimated_monthly_sales: number;
  gross_margin_percent: number;
  net_margin_percent: number;
  roi: number;
  wl_opportunity_score: number;
  classification: string;
  demand_score: number;
  repeat_purchase_score: number;
  branding_potential_score: number;
  reasoning: string;
  supplier_count: number;
  estimated_investment: number;
  source_marketplace: string;
}

interface FinderSummary {
  white_label_candidates: number;
  high_margin_products: number;
  top_opportunities: number;
  verified_suppliers: number;
  avg_opportunity_score: number;
  avg_gross_margin: number;
  avg_net_margin: number;
}

export default function ProductFinderPage() {
  const [products, setProducts] = useState<ProductFinderResult[]>([]);
  const [summary, setSummary] = useState<FinderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<'top-10' | 'top-25' | 'top-50'>('top-10');

  useEffect(() => {
    loadData();
  }, [activeList]);

  async function loadData() {
    try {
      setLoading(true);
      const [productsRes, summaryRes] = await Promise.all([
        api.get(`/product-finder/${activeList}`),
        api.get('/product-finder/summary'),
      ]);
      setProducts(productsRes.data.data || []);
      setSummary(summaryRes.data.data || null);
    } catch (error) {
      console.error('Failed to load product finder data', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-nature-600" />
            <h1 className="text-2xl font-bold text-gray-900">Best Products for Nature&apos;s Crates</h1>
          </div>
          <p className="text-gray-500 mt-1">AI-filtered products meeting all launch criteria</p>
        </div>
      </div>

      {/* Criteria Banner */}
      <div className="bg-nature-50 border border-nature-200 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-nature-800 mb-2">Filter Criteria Applied:</h3>
        <div className="flex flex-wrap gap-3">
          <CriteriaBadge label="Gross Margin" value="40%+" />
          <CriteriaBadge label="Net Margin" value="20%+" />
          <CriteriaBadge label="Max Investment" value="<50K" />
          <CriteriaBadge label="White Label" value="Available" />
          <CriteriaBadge label="Opportunity" value="60+" />
          <CriteriaBadge label="Competition" value="<70" />
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="White-Label Ready" value={summary.white_label_candidates?.toString() || '0'} color="text-green-600" />
          <StatCard label="High Margin" value={summary.high_margin_products?.toString() || '0'} color="text-blue-600" />
          <StatCard label="Verified Suppliers" value={summary.verified_suppliers?.toString() || '0'} color="text-purple-600" />
          <StatCard label="Avg Opportunity" value={`${Math.round(summary.avg_opportunity_score || 0)}/100`} color="text-orange-600" />
        </div>
      )}

      {/* List Selector */}
      <div className="flex gap-2 mb-6">
        {(['top-10', 'top-25', 'top-50'] as const).map(list => (
          <button
            key={list}
            onClick={() => setActiveList(list)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeList === list
                ? 'bg-nature-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-1" />
            {list.replace('-', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {activeList.replace('-', ' ').toUpperCase()} Opportunities
          </h2>
          <span className="text-sm text-gray-500">{products.length} products found</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Gross %</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Net %</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Investment</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Suppliers</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse"></div></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Sparkles className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No products match all criteria yet.</p>
                    <p className="text-sm mt-1">Run product discovery and margin analysis first.</p>
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const { label, color } = getClassificationLabel(p.classification || 'moderate');
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-400">#{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900">{truncate(p.name, 45)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 capitalize">{p.category?.replace(/_/g, ' ')}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${color}`}>{label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(p.selling_price)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-green-600 font-medium">
                          {p.gross_margin_percent ? `${parseFloat(String(p.gross_margin_percent)).toFixed(0)}%` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-blue-600 font-medium">
                          {p.net_margin_percent ? `${parseFloat(String(p.net_margin_percent)).toFixed(0)}%` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreBgColor(p.wl_opportunity_score || 0)}`}>
                          {p.wl_opportunity_score || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {p.estimated_investment ? formatCurrency(parseFloat(String(p.estimated_investment))) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {p.supplier_count || 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CriteriaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-nature-200 rounded text-xs text-nature-700">
      <span className="font-medium">{label}:</span> {value}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
