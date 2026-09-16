import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

import {
  generateBulletinGlobal,
  generateNoteObtentionDiplome,
  normalizeBulletinModules,
} from '../src/utils/pdfGenerator.js';

test('normalizeBulletinModules does not add a duplicate Laravel row from legacy grade keys', () => {
  const modules = [{
    name: 'Frameworks web : Laravel (back end)',
    coefficient: 1,
    order: 1,
    year: '2ème année',
  }];
  const grades = {
    'Frameworks web : Laravel (back end)': { c1: '19.5', c2: '20', efcft: '19', efcfp: '18.5' },
    'Framework web : Laravel (back end)': { c1: '19.5', c2: '20', efcft: '19', efcfp: '18.5' },
  };

  assert.deepEqual(
    normalizeBulletinModules(modules, grades).map(module => module.name),
    ['Frameworks web : Laravel (back end)']
  );
});

test('PDF module lists exclude historical keys outside the selected curriculum', () => {
  const modules = [{ name: 'Current', coefficient: 3 }];
  const rows = normalizeBulletinModules(modules, { Old: { c1: 20, c2: 20 }, Current: { c1: 10 } });
  assert.deepEqual(rows.map(row => row.name), ['Current']);
  assert.equal(rows[0].coefficient, 3);
  assert.deepEqual(normalizeBulletinModules([], { Old: { c1: 20 } }), []);
});

test('normalizeBulletinModules does not add a duplicate Statistiques descriptive row from legacy grade keys', () => {
  const modules = [{
    name: 'Statistiques descriptives',
    coefficient: 2,
    order: 5,
    year: '1ère année',
  }];
  const grades = {
    'Statistiques descriptives': { c1: '18', c2: '10', efcft: '18', efcfp: '12' },
    'Statistiques descriptive': { c1: '18', c2: '10' },
  };

  assert.deepEqual(
    normalizeBulletinModules(modules, grades).map(module => module.name),
    ['Statistiques descriptives']
  );
});

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

    // Inspect the actual PDF text, not just the shared numeric helper.
    const weightedModules = [
      { name: 'A', coefficient: 1, year: '2ème année' },
      { name: 'B', coefficient: 3, year: '2ème année' },
    ];
    const marks = value => ({ c1: value, c2: value, efcft: value, efcfp: value });
    const grades = {
      [student.id]: { A: marks(18), B: marks(10), Old: marks(20), firstYear: { moyCC: 0, moyEFCFT: 0, moyEFCFP: 0, nsti: 0 } },
    };
    const annual = await generateBulletinGlobal(student, grades, weightedModules, { save: false });
    const diploma = await generateNoteObtentionDiplome(student, grades, weightedModules, { save: false });
    const text = pdf => [...pdf.internal.pages.flat().join('\n').matchAll(/\(([^\n]*?)\) Tj/g)].map(match => match[1]);
    const annualText = text(annual);
    const diplomaText = text(diploma);
    const annualRow = annualText.findIndex(value => value.startsWith('Moyennes pond'));
    const secondYearRow = diplomaText.findIndex(value => value.startsWith('Moyenne des notes obtenues en 2'));
    const firstYearRow = diplomaText.findIndex(value => value.startsWith('Moyenne des notes obtenues en 1'));
    assert.ok(annualRow >= 0 && secondYearRow >= 0 && firstYearRow >= 0);
    assert.deepEqual(annualText.slice(annualRow + 2, annualRow + 5), ['12.00', '12.00', '12.00']);
    assert.deepEqual(diplomaText.slice(secondYearRow + 1, secondYearRow + 4), annualText.slice(annualRow + 2, annualRow + 5));
    assert.deepEqual(diplomaText.slice(firstYearRow + 1, firstYearRow + 4), ['0.00', '0.00', '0.00']);
    assert.ok(diplomaText.includes('4,80'));
    assert.equal(diploma.getNumberOfPages(), 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
  }
});
