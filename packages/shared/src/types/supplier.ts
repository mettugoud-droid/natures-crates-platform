// Supplier and manufacturer types

export interface Supplier {
  id: string;
  name: string;
  companyType: 'manufacturer' | 'wholesaler' | 'trader' | 'exporter';
  location: SupplierLocation;
  contactDetails: ContactDetails;
  
  // Capabilities
  oemAvailable: boolean;
  whiteLabelAvailable: boolean;
  privateLabelAvailable: boolean;
  customPackagingAvailable: boolean;
  contractManufacturing: boolean;
  
  // Terms
  moq: number | null;
  leadTimeDays: number | null;
  paymentTerms: string[];
  
  // Verification
  gstRegistered: boolean;
  gstNumber: string | null;
  certifications: string[];
  yearEstablished: number | null;
  annualTurnover: string | null;
  employeeCount: string | null;
  
  // Scores
  trustScore: number; // 0-100
  verificationStatus: 'verified' | 'partially_verified' | 'unverified';
  
  // Source
  sourceDirectory: SupplierDirectory;
  sourceUrl: string;
  
  // Metadata
  products: string[]; // Product categories they manufacture
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierLocation {
  city: string;
  state: string;
  country: string;
  pincode: string | null;
  fullAddress: string | null;
}

export interface ContactDetails {
  phone: string | null;
  email: string | null;
  website: string | null;
  contactPerson: string | null;
}

export type SupplierDirectory =
  | 'indiamart'
  | 'trade_india'
  | 'exporters_india'
  | 'alibaba'
  | 'made_in_china'
  | 'msme_directory'
  | 'state_industrial_directory'
  | 'manual_entry';

export interface SupplierVerification {
  supplierId: string;
  gstVerified: boolean;
  businessLegitimacy: 'confirmed' | 'suspected' | 'unverified';
  manufacturingCapacity: 'high' | 'medium' | 'low' | 'unknown';
  exportCapable: boolean;
  oemCapable: boolean;
  packagingCapable: boolean;
  certifications: CertificationCheck[];
  overallScore: number;
  verifiedAt: Date;
  verifiedBy: string;
}

export interface CertificationCheck {
  name: string;
  status: 'verified' | 'claimed' | 'not_available';
  expiryDate: Date | null;
}

export interface SupplierQuote {
  supplierId: string;
  productId: string;
  pricePerUnit: number;
  moq: number;
  leadTimeDays: number;
  packagingIncluded: boolean;
  customBranding: boolean;
  validUntil: Date;
  notes: string;
}
