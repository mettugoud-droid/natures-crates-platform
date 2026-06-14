'use client';

import { useEffect, useState } from 'react';
import {
  Package,
  TrendingUp,
  Factory,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { productsApi, opportunitiesApi, recommendationsApi } from '@/lib/api';
import { formatCurrency, formatNumber, getScoreBgColor, getClassificationLabel } from '@/lib/utils';

interface DashboardStats {
  totalProducts: number;
  whiteLabelCandidates: number;
  highMarginProducts: number;
  totalSuppliers: number;
  avgOpportunityScore: number;
}

interface Opportunity {
  id: string;
  product_name: string;
  category: string;
  opportunity_score: number;
  classification: string;
  selling_price: number;
  expected_monthly_revenue: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topOpportunities, setTopOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [statsRes, oppsRes] = await Promise.all([
        productsApi.getDashboardStats(),
        opportunitiesApi.getAll(10),
      ]);
      setStats(statsRes.data.data);
      setTopOpportunities(oppsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Intelligence Dashboard</h1>
          <p className="text-gray-500 mt-1">AI-powered insights for Nature&apos;s Crates product strategy</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Products Tracked"
          value={formatNumber(stats?.totalProducts || 0)}
          icon={<Package className="w-5 h-5 text-nature-600" />}
          change="+12% this week"
          positive={true}
        />
        <KPICard
          title="White-Label Candidates"
          value={formatNumber(stats?.whiteLabelCandidates || 0)}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          change="+8 new today"
          positive={true}
        />
        <KPICard
          title="High Margin Products"
          value={formatNumber(stats?.highMarginProducts || 0)}
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          change="40%+ gross margin"
          positive={true}
        />
        <KPICard
          title="Verified Suppliers"
          value={formatNumber(stats?.totalSuppliers || 0)}
          icon={<Factory className="w-5 h-5 text-purple-600" />}
          change="+5 this week"
          positive={true}
        />
      </div>

      {/* Opportunity Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top Opportunities</h2>
            <span className="text-xs text-gray-500">Updated today</span>
          </div>
          <div className="space-y-3">
            {topOpportunities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No opportunities analyzed yet. Run discovery to get started.</p>
              </div>
            ) : (
              topOpportunities.map((opp) => {
                const { label, color } = getClassificationLabel(opp.classification);
                return (
                  <div key={opp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{opp.product_name}</p>
                      <p className="text-xs text-gray-500">{opp.category?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                      <span className={`font-bold text-sm ${getScoreBgColor(opp.opportunity_score)} px-2 py-0.5 rounded`}>
                        {opp.opportunity_score}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Health</h2>
          <div className="space-y-4">
            <StatItem label="Avg. Opportunity Score" value={`${stats?.avgOpportunityScore || 0}/100`} />
            <StatItem label="Categories Tracked" value="15" />
            <StatItem label="Data Sources Active" value="5" />
            <StatItem label="Daily Scan Status" value="Active" color="text-green-600" />
            <StatItem label="Compliance Rate" value="100%" color="text-green-600" />
            <StatItem label="Last Updated" value="2 hours ago" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton label="Discover Products" href="/products" icon={<Package className="w-4 h-4" />} />
          <ActionButton label="Analyze Margins" href="/margins" icon={<DollarSign className="w-4 h-4" />} />
          <ActionButton label="Find Suppliers" href="/suppliers" icon={<Factory className="w-4 h-4" />} />
          <ActionButton label="AI Recommendations" href="/recommendations" icon={<Sparkles className="w-4 h-4" />} />
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, change, positive }: {
  title: string; value: string; icon: React.ReactNode; change: string; positive: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center gap-1 mt-2">
        {positive ? (
          <ArrowUpRight className="w-3 h-3 text-green-500" />
        ) : (
          <ArrowDownRight className="w-3 h-3 text-red-500" />
        )}
        <span className={`text-xs ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {change}
        </span>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function ActionButton({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-4 py-3 rounded-lg border hover:bg-gray-50 transition text-sm font-medium text-gray-700"
    >
      {icon}
      {label}
    </a>
  );
}
