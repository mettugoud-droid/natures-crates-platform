'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Play, Target } from 'lucide-react';
import { opportunitiesApi } from '@/lib/api';
import { formatCurrency, getClassificationLabel, getScoreBgColor } from '@/lib/utils';

interface Opportunity {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  selling_price: number;
  opportunity_score: number;
  classification: string;
  demand_score: number;
  competition_score: number;
  margin_score: number;
  manufacturing_ease_score: number;
  repeat_purchase_score: number;
  branding_potential_score: number;
  regulatory_complexity_score: number;
  opportunity_types: string[];
  reasoning: string;
  expected_monthly_revenue: number;
  risks: string[];
  improvements: string[];
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const res = await opportunitiesApi.getAll(50);
      setOpportunities(res.data.data || []);
    } catch (error) {
      console.error('Failed to load opportunities', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchAnalyze() {
    try {
      setAnalyzing(true);
      await opportunitiesApi.batchAnalyze(100);
      await loadOpportunities();
    } catch (error) {
      console.error('Failed to run batch analysis', error);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">White-Label Opportunities</h1>
          <p className="text-gray-500 mt-1">Products scored for private-label and white-label potential</p>
        </div>
        <button
          onClick={handleBatchAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {analyzing ? 'Analyzing...' : 'Run Batch Analysis'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Opportunities" value={opportunities.length.toString()} color="text-blue-600" />
        <SummaryCard
          label="Excellent"
          value={opportunities.filter(o => o.classification === 'excellent').length.toString()}
          color="text-green-600"
        />
        <SummaryCard
          label="Good"
          value={opportunities.filter(o => o.classification === 'good').length.toString()}
          color="text-blue-600"
        />
        <SummaryCard
          label="Avg Score"
          value={
            opportunities.length > 0
              ? Math.round(opportunities.reduce((s, o) => s + o.opportunity_score, 0) / opportunities.length).toString()
              : '0'
          }
          color="text-purple-600"
        />
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-100 rounded w-2/3"></div>
            </div>
          ))
        ) : opportunities.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-700">No opportunities analyzed yet</h3>
            <p className="text-sm text-gray-500 mt-1">Run batch analysis to identify white-label opportunities</p>
          </div>
        ) : (
          opportunities.map((opp) => {
            const { label, color } = getClassificationLabel(opp.classification);
            return (
              <div key={opp.id} className="bg-white rounded-xl border p-6 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{opp.product_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreBgColor(opp.opportunity_score)}`}>
                        Score: {opp.opportunity_score}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 capitalize">
                      {opp.category?.replace(/_/g, ' ')} | {formatCurrency(opp.selling_price)}
                      {opp.expected_monthly_revenue ? ` | Est. Revenue: ${formatCurrency(opp.expected_monthly_revenue)}/mo` : ''}
                    </p>
                    {opp.reasoning && (
                      <p className="text-sm text-gray-600 mt-2">{opp.reasoning}</p>
                    )}
                  </div>
                </div>

                {/* Factor Scores */}
                <div className="grid grid-cols-7 gap-2 mt-4">
                  <FactorScore label="Demand" value={opp.demand_score} />
                  <FactorScore label="Competition" value={100 - opp.competition_score} />
                  <FactorScore label="Margin" value={opp.margin_score} />
                  <FactorScore label="Mfg Ease" value={opp.manufacturing_ease_score} />
                  <FactorScore label="Repeat" value={opp.repeat_purchase_score} />
                  <FactorScore label="Branding" value={opp.branding_potential_score} />
                  <FactorScore label="Low Reg." value={100 - opp.regulatory_complexity_score} />
                </div>

                {/* Types & Risks */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {(opp.opportunity_types || []).map((type: string) => (
                    <span key={type} className="px-2 py-0.5 bg-nature-50 text-nature-700 text-xs rounded-full">
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function FactorScore({ label, value }: { label: string; value: number }) {
  const bg = value >= 70 ? 'bg-green-100' : value >= 40 ? 'bg-yellow-100' : 'bg-red-100';
  return (
    <div className={`p-2 rounded text-center ${bg}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-sm font-bold">{value || 0}</p>
    </div>
  );
}
