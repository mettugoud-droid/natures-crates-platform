'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { marginsApi } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface HighMarginProduct {
  id: string;
  product_name: string;
  category: string;
  brand: string;
  selling_price: number;
  total_cost: number;
  gross_profit: number;
  gross_margin_percent: number;
  net_profit: number;
  net_margin_percent: number;
  roi: number;
  break_even_units: number;
  recommended_selling_price: number;
}

export default function MarginsPage() {
  const [products, setProducts] = useState<HighMarginProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHighMarginProducts();
  }, []);

  async function loadHighMarginProducts() {
    try {
      setLoading(true);
      const res = await marginsApi.getHighMargin(50);
      setProducts(res.data.data || []);
    } catch (error) {
      console.error('Failed to load margins', error);
    } finally {
      setLoading(false);
    }
  }

  const avgGrossMargin = products.length > 0
    ? products.reduce((sum, p) => sum + parseFloat(String(p.gross_margin_percent)), 0) / products.length
    : 0;
  const avgNetMargin = products.length > 0
    ? products.reduce((sum, p) => sum + parseFloat(String(p.net_margin_percent)), 0) / products.length
    : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Margin Analyzer</h1>
        <p className="text-gray-500 mt-1">Products meeting margin targets (40%+ gross, 20%+ net)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">High Margin Products</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-500">Avg Gross Margin</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatPercent(avgGrossMargin)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-500">Avg Net Margin</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{formatPercent(avgNetMargin)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-gray-500">Target</span>
          </div>
          <p className="text-lg font-bold text-amber-600">40% Gross / 20% Net</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gross Margin</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Net Margin</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">ROI</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Break-Even</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Recommended SP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Calculator className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No margin analyses available yet. Calculate margins for discovered products.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-gray-900">{p.product_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.category?.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.selling_price)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(p.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="font-medium text-green-600">{formatPercent(parseFloat(String(p.gross_margin_percent)))}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="font-medium text-blue-600">{formatPercent(parseFloat(String(p.net_margin_percent)))}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-purple-600 font-medium">
                      {formatPercent(parseFloat(String(p.roi)))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {p.break_even_units} units
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {p.recommended_selling_price ? formatCurrency(p.recommended_selling_price) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
