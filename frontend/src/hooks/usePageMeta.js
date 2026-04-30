import { useEffect } from 'react';

const setMeta = (name, content, property = false) => {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

export default function usePageMeta({ title, description, image, url } = {}) {
  useEffect(() => {
    const base = 'aFISHa';
    const fullTitle = title ? `${title} | ${base}` : base;
    document.title = fullTitle;

    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, true);
      setMeta('twitter:description', description);
    }
    if (title) {
      setMeta('og:title', fullTitle, true);
      setMeta('twitter:title', fullTitle);
    }
    if (image) {
      setMeta('og:image', image, true);
      setMeta('twitter:image', image);
    }
    if (url) {
      setMeta('og:url', url, true);
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', url);
    }
  }, [title, description, image, url]);
}
