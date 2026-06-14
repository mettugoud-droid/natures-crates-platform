export interface Supplier {
    id: string;
    name: string;
    companyType: 'manufacturer' | 'wholesaler' | 'trader' | 'exporter';
    location: SupplierLocation;
    contactDetails: ContactDetails;
    oemAvailable: boolean;
    whiteLabelAvailable: boolean;
    privateLabelAvailable: boolean;
    customPackagingAvailable: boolean;
    contractManufacturing: boolean;
    moq: number | null;
    leadTimeDays: number | null;
    paymentTerms: string[];
    gstRegistered: boolean;
    gstNumber: string | null;
    certifications: string[];
    yearEstablished: number | null;
    annualTurnover: string | null;
    employeeCount: string | null;
    trustScore: number;
    verificationStatus: 'verified' | 'partially_verified' | 'unverified';
    sourceDirectory: SupplierDirectory;
    sourceUrl: string;
    products: string[];
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
export type SupplierDirectory = 'indiamart' | 'trade_india' | 'exporters_india' | 'alibaba' | 'made_in_china' | 'msme_directory' | 'state_industrial_directory' | 'manual_entry';
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
//# sourceMappingURL=supplier.d.ts.map