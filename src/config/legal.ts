// ============================================================
// LEGAL & BUSINESS INFO — single source of truth for policy pages
// ============================================================
//
// WHY THIS FILE EXISTS:
// Razorpay (and most payment gateways) require a set of publicly
// accessible legal pages — Privacy, Terms, Refund/Cancellation,
// Shipping/Delivery, and Contact Us — that show REAL business
// contact details. Every policy page reads from this one file so
// you update your details in ONE place.
//
// >>> BEFORE GOING LIVE: replace every [PLACEHOLDER] below with
//     your real, registered business details. Razorpay's review
//     team checks that these match your KYC / bank account. <<<
// ============================================================

export const LEGAL = {
  // Public-facing brand name (safe to leave as-is)
  brandName: 'TrackSpendZ',

  // Legal entity name exactly as registered with Razorpay / your bank.
  // If you operate as an individual / sole proprietor, use your full legal name.
  businessName: 'KREXO',

  // Registered business / operating address. Razorpay requires a real address.
  // Keep it as a single string with line breaks ("\n") between lines.
  address: 'Panampilly Nagar, Kochi, 682036 ',

  // Contact emails — change the domain part if yours differs.
  supportEmail: 'support@trackspendz.com',
  privacyEmail: 'support@trackspendz.com',

  // Public contact phone number (Razorpay expects a reachable number).
  phone: '+91 9809494345',

  // When your support team is reachable.
  supportHours: 'Monday to Friday, 10:00 AM – 6:00 PM IST',

  // Shown as "Last updated" on every policy page. Bump when you edit content.
  lastUpdated: 'May 2026',

  // Refund/cancellation window in days (used in the Refund Policy copy).
  refundWindowDays: 7,
} as const;

export type LegalConfig = typeof LEGAL;
