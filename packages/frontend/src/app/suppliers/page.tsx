'use client';

import { useEffect, useState } from 'react';
import { Factory, CheckCircle, Search, MapPin, Phone } from 'lucide-react';
import { suppliersApi } from '@/lib/api';
import { getScoreBgColor } from '@/lib/utils';

interface Supplier {
  id: string;
  name: string;
  location: { city: string; state: string; country: string };
  moq: number | null;
  oemAvailable: boolean;
  whiteLabelAvailable: boolean;
  customPackagingAvailable: boolean;
  privateLabelAvailable: boolean;
  certifications: string[];
  leadTimeDays: number | null;
  contactDetails: { phone: string; email: string; website: string; contactPerson: string };
  trustScore: number;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchProduct, setSearchProduct] = useState('');

  useEffect(() => {
    loadTopSuppliers();
  }, []);

  async function loadTopSuppliers() {
    try {
      setLoading(true);
      const res = await suppliersApi.getTop(30);
      setSuppliers(res.data.data || []);
    } catch (error) {
      console.error('Failed to load suppliers', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchProduct.trim()) return;
    
    try {
      setLoading(true);
      const res = await suppliersApi.search({
        product: searchProduct,
        category: 'dry_fruits',
        requirements: { oemRequired: true, whiteLabelRequired: true },
      });
      setSuppliers(res.data.data || []);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manufacturer Discovery</h1>
        <p className="text-gray-500 mt-1">Find verified manufacturers and suppliers for white-label products</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search manufacturers (e.g., 'Premium Almonds', 'Trail Mix')"
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 text-sm"
          >
            Find Manufacturers
          </button>
        </div>
      </form>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            </div>
          ))
        ) : suppliers.length === 0 ? (
          <div className="col-span-2 bg-white rounded-xl border p-12 text-center">
            <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-700">No suppliers found</h3>
            <p className="text-sm text-gray-500 mt-1">Search for a product to discover manufacturers</p>
          </div>
        ) : (
          suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white rounded-xl border p-6 hover:shadow-sm transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {supplier.location.city}, {supplier.location.state}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(supplier.trustScore)}`}>
                  Trust: {supplier.trustScore}
                </span>
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-2 mb-3">
                {supplier.oemAvailable && <Badge label="OEM" color="bg-blue-100 text-blue-700" />}
                {supplier.whiteLabelAvailable && <Badge label="White Label" color="bg-green-100 text-green-700" />}
                {supplier.privateLabelAvailable && <Badge label="Private Label" color="bg-purple-100 text-purple-700" />}
                {supplier.customPackagingAvailable && <Badge label="Custom Packaging" color="bg-orange-100 text-orange-700" />}
              </div>

              {/* Details */}
              <div className="text-sm space-y-1 text-gray-600">
                {supplier.moq && <p>MOQ: {supplier.moq} units</p>}
                {supplier.leadTimeDays && <p>Lead Time: {supplier.leadTimeDays} days</p>}
                {supplier.certifications.length > 0 && (
                  <p className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {supplier.certifications.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>

              {/* Contact */}
              {supplier.contactDetails.phone && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-gray-500">
                  <Phone className="w-3 h-3" />
                  {supplier.contactDetails.contactPerson || supplier.contactDetails.phone}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
