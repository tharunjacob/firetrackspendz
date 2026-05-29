import { useEffect } from 'react';

// ============================================================
// usePageMeta — Dynamic per-page SEO meta tags
// ============================================================
//
// WHY THIS HOOK EXISTS:
// React SPAs render a single index.html with static meta tags.
// Search engines and social platforms see the SAME title/description
// for every route. This hook sets unique meta per page so that:
//   - Google indexes each page with its own title/description
//   - Social shares (OG/Twitter) show page-specific previews
//   - Canonical URLs prevent duplicate content penalties
//
// HOW TO USE:
//   import { usePageMeta } from '@/hooks/usePageMeta';
//   usePageMeta({
//     title: 'Features | TrackSpendZ',
//     description: 'Explore 13 financial tools...',
//     canonical: '/features',
//   });
//
// ALWAYS call this at the top of every page component.
// ============================================================

const BASE_URL = 'https://trackspendz.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = 'TrackSpendZ';

interface PageMeta {
  title: string;
  description: string;
  canonical?: string;      // path like '/pricing' — BASE_URL prepended automatically
  ogImage?: string;        // full URL or relative path
  ogType?: string;         // default: 'website'
  noIndex?: boolean;       // if true, adds noindex meta
}

const setMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
};

const setCanonical = (href: string) => {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
};

export const usePageMeta = ({ title, description, canonical, ogImage, ogType, noIndex }: PageMeta) => {
  useEffect(() => {
    // Title
    document.title = title;

    // Description
    setMeta('description', description);

    // Canonical URL
    const canonicalUrl = canonical
      ? (canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`)
      : `${BASE_URL}/`;
    setCanonical(canonicalUrl);

    // Open Graph
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:image', ogImage || DEFAULT_OG_IMAGE, 'property');
    setMeta('og:type', ogType || 'website', 'property');
    setMeta('og:site_name', SITE_NAME, 'property');

    // Twitter
    setMeta('twitter:title', title, 'name');
    setMeta('twitter:description', description, 'name');
    setMeta('twitter:image', ogImage || DEFAULT_OG_IMAGE, 'name');

    // Robots
    if (noIndex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      // Remove noindex if it was set by a previous page
      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) robotsMeta.remove();
    }

    // Cleanup: restore defaults on unmount (optional — next page will override)
    return () => {
      document.title = `${SITE_NAME} — Track Expenses, Build Wealth, Reach FIRE`;
    };
  }, [title, description, canonical, ogImage, ogType, noIndex]);
};
