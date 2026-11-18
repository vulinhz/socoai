import { useEffect } from 'react';

interface PageSeoOptions {
  title: string;
  description: string;
  path?: string;
  jsonLd?: Record<string, unknown>;
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function usePageSeo({ title, description, path, jsonLd }: PageSeoOptions) {
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);

    if (path && typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
      upsertMetaTag('property', 'og:url', fullUrl);
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = fullUrl;
    }

    const existingScript = document.getElementById('soco-page-jsonld');
    if (jsonLdStr) {
      let script = existingScript as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'soco-page-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = jsonLdStr;
    } else if (existingScript) {
      existingScript.remove();
    }
  }, [title, description, path, jsonLdStr]);
}
