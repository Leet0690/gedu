import { institutionConfig } from '../config/institution.js';

let logoDataUrlPromise;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export const loadLogoDataUrl = () => {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(institutionConfig.logoUrl || '/logo-ipfpp.png', { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Logo unavailable: ${response.status}`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(error => {
        logoDataUrlPromise = undefined;
        throw error;
      });
  }

  return logoDataUrlPromise;
};
