import { institutionConfig } from '../config/institution.js';

const logoDataUrlPromises = new Map();

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export const loadLogoDataUrl = (requestedLogoUrl = '') => {
  const runtimeLogoUrl = typeof window !== 'undefined' ? window.__GEDU_INSTITUTION__?.logoUrl : '';
  const logoUrl = requestedLogoUrl || runtimeLogoUrl || institutionConfig.logoUrl;
  if (!logoUrl) return Promise.resolve(null);
  if (!logoDataUrlPromises.has(logoUrl)) {
    const promise = logoUrl.startsWith('data:')
      ? Promise.resolve(logoUrl)
      : fetch(logoUrl, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Logo unavailable: ${response.status}`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(error => {
        logoDataUrlPromises.delete(logoUrl);
        throw error;
      });
    logoDataUrlPromises.set(logoUrl, promise);
  }

  return logoDataUrlPromises.get(logoUrl);
};
