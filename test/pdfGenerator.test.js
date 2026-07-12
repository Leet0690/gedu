import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

import { generateBulletinGlobal } from '../src/utils/pdfGenerator.js';

test('generateBulletinGlobal renders the largest configured bulletin on one page', async () => {
  const originalFetch = globalThis.fetch;
  const originalFileReader = globalThis.FileReader;
  const logoBytes = await readFile(new URL('../public/logo.jpg', import.meta.url));

  globalThis.fetch = async () => ({
    ok: true,
    blob: async () => new Blob([logoBytes], { type: 'image/jpeg' }),
  });
  globalThis.FileReader = class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      }).catch(error => this.onerror?.(error));
    }
  };

  try {
    const modules = Array.from({ length: 15 }, (_, index) => ({
      name: index === 14 ? 'Stage en Entreprise' : `Module ${index + 1}`,
      coefficient: 1,
      order: index + 1,
      year: '2ème année',
    }));
    const student = {
      id: 'student-test',
      firstName: 'Test',
      lastName: 'Stagiaire',
      major: 'Gestion de Transport et Logistique',
      year: '2ème année',
      regNo: 'TEST-001',
    };

    const doc = await generateBulletinGlobal(student, {}, modules, { save: false });

    assert.equal(doc.getNumberOfPages(), 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
  }
});
