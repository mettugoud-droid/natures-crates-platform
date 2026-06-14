'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Factory,
  BarChart3,
  ShieldCheck,
  Lightbulb,
  DollarSign,
  Settings,
  Globe,
  Target,
  Users,
  Gift,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/marketplace', label: 'Marketplace Intel', icon: BarChart3 },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/product-finder', label: 'Product Finder', icon: Target },
  { href: '/opportunities', label: 'Opportunities', icon: TrendingUp },
  { href: '/margins', label: 'Margin Analyzer', icon: DollarSign },
  { href: '/suppliers', label: 'Suppliers', icon: Factory },
  { href: '/competitors', label: 'Competitors', icon: Users },
  { href: '/bundles', label: 'Bundles', icon: Gift },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-nature-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">NC</span>
          </div>
          <div>
            <h1 className="font-bold text-sm text-gray-900">Nature&apos;s Crates</h1>
            <p className="text-xs text-gray-500">Intelligence Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-nature-50 text-nature-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-nature-600' : ''}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
