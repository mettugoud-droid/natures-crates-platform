'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Activity, Database } from 'lucide-react';
import { complianceApi } from '@/lib/api';
import { formatPercent } from '@/lib/utils';

interface ConnectorStatus {
  name: string;
  enabled: boolean;
  tier: string;
}

interface ComplianceReport {
  period: string;
  totalRequests: number;
  compliantRequests: number;
  complianceRate: number;
  violations: any[];
  sourceBreakdown: any[];
}

export default function CompliancePage() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  async function loadComplianceData() {
    try {
      setLoading(true);
      const [reportRes, connectorsRes] = await Promise.all([
        complianceApi.getReport('daily'),
        complianceApi.getConnectors(),
      ]);
      setReport(reportRes.data.data);
      setConnectors(connectorsRes.data.data?.connectors || []);
      setHealth(connectorsRes.data.data?.health || {});
    } catch (error) {
      console.error('Failed to load compliance data', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance & Data Sources</h1>
        <p className="text-gray-500 mt-1">Monitor data acquisition compliance and connector health</p>
      </div>

      {/* Compliance KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Compliance Rate</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {report ? formatPercent(report.complianceRate) : '100%'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-500">Total Requests (24h)</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{report?.totalRequests || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-gray-500">Violations</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{report?.violations?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-500">Active Connectors</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {connectors.filter(c => c.enabled).length}/{connectors.length}
          </p>
        </div>
      </div>

      {/* Connectors */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Data Connectors</h2>
        </div>
        <div className="divide-y">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))
          ) : connectors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No connectors configured</div>
          ) : (
            connectors.map((connector, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${connector.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{connector.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{connector.tier.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    connector.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {connector.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Data Acquisition Tiers */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Data Acquisition Policy</h2>
        <div className="space-y-4">
          <TierSection
            tier="Tier 1"
            label="Official APIs"
            description="Amazon PA-API, Google Trends, Meta Ads Library"
            color="bg-green-50 border-green-200"
            priority="Primary Source"
          />
          <TierSection
            tier="Tier 2"
            label="Approved Providers"
            description="Bright Data, Keepa, Apify, DataForSEO, Semrush"
            color="bg-blue-50 border-blue-200"
            priority="Secondary Source"
          />
          <TierSection
            tier="Tier 3"
            label="Configurable Connectors"
            description="IndiaMART, TradeIndia, custom adapters"
            color="bg-amber-50 border-amber-200"
            priority="Supplementary"
          />
        </div>
      </div>
    </div>
  );
}

function TierSection({ tier, label, description, color, priority }: {
  tier: string; label: string; description: string; color: string; priority: string;
}) {
  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-gray-500">{tier}</span>
          <h3 className="font-medium text-gray-900">{label}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <span className="px-2 py-0.5 bg-white border rounded text-xs text-gray-600">
          {priority}
        </span>
      </div>
    </div>
  );
}
