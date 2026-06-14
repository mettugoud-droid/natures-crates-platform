import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export function getClassificationLabel(classification: string): {
  label: string;
  color: string;
} {
  switch (classification) {
    case 'excellent':
      return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    case 'good':
      return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    case 'moderate':
      return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' };
    case 'avoid':
      return { label: 'Avoid', color: 'bg-red-100 text-red-800' };
    default:
      return { label: classification, color: 'bg-gray-100 text-gray-800' };
  }
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'safe_to_launch':
      return 'bg-green-100 text-green-800';
    case 'review_required':
      return 'bg-yellow-100 text-yellow-800';
    case 'avoid':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}
