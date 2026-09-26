import { SUPPORT_EMAIL } from './support';

// Seller identity shown on the legal pages. Supplied at build time; nothing is
// invented. Missing values are flagged in the owner checklist (LAUNCH.md).
export const LEGAL = {
  sellerName: import.meta.env.VITE_LEGAL_SELLER_NAME || '',
  registryCode: import.meta.env.VITE_LEGAL_REGISTRY_CODE || '',
  vatNumber: import.meta.env.VITE_LEGAL_VAT_NUMBER || '',
  address: import.meta.env.VITE_LEGAL_ADDRESS || '',
  email: SUPPORT_EMAIL,
  lastUpdated: '2026-09-26',
};

export const hasSellerIdentity = Boolean(LEGAL.sellerName && LEGAL.address);
