'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, PieChart, DollarSign, MapPin, Layers } from 'lucide-react';
import { api } from '@/lib/api';

interface CategoryGrowth {
  category: string;
  total_products: number;
  new_this_week: number;
  new_this_month: number;
  avg_price: number;
  avg_monthly_sales: number;
  avg_growth_rate: number;
  avg_opportunity: number;
}

interface OpportunityDist {
  classification: string;
  count: number;
  avg_score: number;
}

interface MarginDist {
  grossMargins: { range: string; count: number }[];
  netMargins: { range: string; count: number }[];
  byChannel: { channel: string; avg_gross: number; avg_net: number; products: number }[];
}

interface SupplierDist {
  byState: { state: string; count: number; avg_trust_score: number }[];
  byCapability: { oem_capable: number; white_label: number; private_label: number; custom_packaging: number; total: number };
  byVerification: { verification_status: string; count: number }[];
}

export default function AnalyticsPage() {
  const [categoryGrowth, setCategoryGrowth] = useState<CategoryGrowth[]>([]);
  const [oppDist, setOppDist] = useState<OpportunityDist[]>([]);
  const [marginDist, setMarginDist] = useState<MarginDist | null>(null);
  const [supplierDist, setSupplierDist] = useState<SupplierDist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const [catRes, oppRes, marginRes, supplierRes] = await Promise.all([
        api.get('/analytics/category-growth').catch(() => ({ data: { data: [] } })),
        api.get('/analytics/opportunity-distribution').catch(() => ({ data: { data: [] } })),
        api.get('/analytics/margin-distribution').catch(() => ({ data: { data: null } })),
        api.get('/analytics/supplier-distribution').catch(() => ({ data: { data: null } })),
      ]);
      setCategoryGrowth(catRes.data.data || []);
      setOppDist(oppRes.data.data || []);
      setMarginDist(marginRes.data.data);
      setSupplierDist(supplierRes.data.data);
    } catch (error) {
      console.error('Failed to load analytics', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-500 mt-1">Executive-level performance visualization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Growth */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Category Growth</h2>
          </div>
          <div className="space-y-3">
            {categoryGrowth.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No category data yet</p>
            ) : (
              categoryGrowth.slice(0, 8).map((cat, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{cat.category?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{cat.total_products} products | +{cat.new_this_week} this week</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      {cat.avg_growth_rate ? `+${parseFloat(String(cat.avg_growth_rate)).toFixed(0)}%` : '-'}
                    </p>
                    <p className="text-xs text-gray-500">Score: {Math.round(parseFloat(String(cat.avg_opportunity || '0')))}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Opportunity Score Distribution */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Opportunity Distribution</h2>
          </div>
          <div className="space-y-4">
            {oppDist.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No opportunity data yet</p>
            ) : (
              oppDist.map((item, i) => {
                const colors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-red-500'];
                const total = oppDist.reduce((s, d) => s + parseInt(String(d.count)), 0);
                const pct = total > 0 ? (parseInt(String(item.count)) / total) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{item.classification}</span>
                      <span className="text-sm font-medium">{item.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${colors[i] || 'bg-gray-400'}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Margin Distribution */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-gray-900">Margin Distribution</h2>
          </div>
          {marginDist?.grossMargins && marginDist.grossMargins.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Gross Margin Ranges</p>
              {marginDist.grossMargins.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">{item.range}</span>
                  <span className="text-sm font-medium px-2 py-0.5 bg-green-50 text-green-700 rounded">{item.count}</span>
                </div>
              ))}
              {marginDist.byChannel && marginDist.byChannel.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 uppercase mt-4">By Channel</p>
                  {marginDist.byChannel.map((ch: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-700 capitalize">{ch.channel?.replace(/_/g, ' ')}</span>
                      <span className="text-xs">{parseFloat(ch.avg_net || '0').toFixed(0)}% net</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No margin data yet</p>
          )}
        </div>

        {/* Supplier Distribution */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Supplier Distribution</h2>
          </div>
          {supplierDist?.byState && supplierDist.byState.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase">By State</p>
              {supplierDist.byState.slice(0, 8).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">{item.state}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Trust: {Math.round(parseFloat(item.avg_trust_score || '0'))}</span>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
              {supplierDist.byCapability && (
                <>
                  <p className="text-xs font-medium text-gray-500 uppercase mt-4">Capabilities</p>
                  <div className="grid grid-cols-2 gap-2">
                    <CapBadge label="OEM" value={supplierDist.byCapability.oem_capable} />
                    <CapBadge label="White Label" value={supplierDist.byCapability.white_label} />
                    <CapBadge label="Private Label" value={supplierDist.byCapability.private_label} />
                    <CapBadge label="Custom Pkg" value={supplierDist.byCapability.custom_packaging} />
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No supplier data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CapBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded p-2 text-center">
      <p className="text-lg font-bold text-gray-900">{value || 0}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
