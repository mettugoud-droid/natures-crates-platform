'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, ArrowUpDown, ExternalLink } from 'lucide-react';
import { productsApi } from '@/lib/api';
import { formatCurrency, getScoreBgColor, truncate } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  selling_price: number;
  source_marketplace: string;
  rating: number;
  reviews_count: number;
  estimated_monthly_sales: number;
  growth_rate: number;
  competition_score: number;
  opportunity_score: number;
  is_white_label_candidate: boolean;
  gross_margin_percent: number;
  net_margin_percent: number;
  classification: string;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'dry_fruits', label: 'Dry Fruits' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'seeds', label: 'Seeds' },
  { value: 'healthy_snacks', label: 'Healthy Snacks' },
  { value: 'trail_mixes', label: 'Trail Mixes' },
  { value: 'gift_boxes', label: 'Gift Boxes' },
  { value: 'functional_foods', label: 'Functional Foods' },
  { value: 'gourmet_foods', label: 'Gourmet Foods' },
  { value: 'wellness_products', label: 'Wellness Products' },
  { value: 'corporate_gifting', label: 'Corporate Gifting' },
  { value: 'premium_daily_essentials', label: 'Premium Daily Essentials' },
];

const MARKETPLACES = [
  { value: '', label: 'All Marketplaces' },
  { value: 'amazon_india', label: 'Amazon India' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'zepto', label: 'Zepto' },
  { value: 'd2c_website', label: 'D2C Website' },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    marketplace: '',
    isWhiteLabelOnly: false,
    sortBy: 'opportunity_score',
    sortOrder: 'desc',
    page: 1,
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  useEffect(() => {
    loadProducts();
  }, [filters]);

  async function loadProducts() {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        ...filters,
        categories: filters.category || undefined,
        marketplaces: filters.marketplace || undefined,
        limit: 20,
      };
      
      // Remove empty values
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] === undefined) delete params[k];
      });

      const res = await productsApi.search(params);
      setProducts(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Failed to load products', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Intelligence</h1>
        <p className="text-gray-500 mt-1">Discover and analyze products across marketplaces</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={filters.marketplace}
            onChange={(e) => setFilters({ ...filters, marketplace: e.target.value, page: 1 })}
          >
            {MARKETPLACES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filters.isWhiteLabelOnly}
              onChange={(e) => setFilters({ ...filters, isWhiteLabelOnly: e.target.checked, page: 1 })}
              className="rounded"
            />
            White-Label Only
          </label>

          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value, page: 1 })}
          >
            <option value="opportunity_score">Opportunity Score</option>
            <option value="sales">Monthly Sales</option>
            <option value="growth">Growth Rate</option>
            <option value="created_at">Newest First</option>
          </select>

          <span className="ml-auto text-sm text-gray-500 flex items-center">
            {pagination.total} products found
          </span>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sales/mo</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Growth</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Margin</th>
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
                    No products found. Try adjusting your filters or run product discovery.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{truncate(product.name, 50)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{product.brand || 'Unknown'}</span>
                          <span className="text-xs text-gray-400">|</span>
                          <span className="text-xs text-gray-500 capitalize">
                            {product.source_marketplace?.replace(/_/g, ' ')}
                          </span>
                          {product.is_white_label_candidate && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">WL</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {product.category?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(product.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {product.estimated_monthly_sales || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {product.rating ? `${product.rating}/5` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {product.growth_rate ? (
                        <span className={product.growth_rate > 0 ? 'text-green-600' : 'text-red-600'}>
                          {product.growth_rate > 0 ? '+' : ''}{product.growth_rate}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.opportunity_score ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreBgColor(product.opportunity_score)}`}>
                          {product.opportunity_score}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.gross_margin_percent ? (
                        <span className={`text-xs font-medium ${product.gross_margin_percent >= 40 ? 'text-green-600' : 'text-gray-600'}`}>
                          {product.gross_margin_percent.toFixed(0)}%
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {filters.page} of {pagination.totalPages}
            </span>
            <button
              disabled={filters.page >= pagination.totalPages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
