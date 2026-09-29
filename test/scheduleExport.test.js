import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchedulePdfSlices } from '../src/utils/scheduleExport.js';

const assertCompletePages = (capture, slices) => {
  let cursor = capture.headerHeight;
  for (const slice of slices) {
    assert.equal(slice.start, cursor, 'Every row of the bitmap must appear exactly once');
    assert.ok(slice.end > slice.start, 'Pages must make progress');
    const renderedHeight = (capture.headerHeight + slice.end - slice.start) * 277 / capture.width;
    assert.ok(renderedHeight <= 190, 'A4 landscape content must fit inside both margins');
    cursor = slice.end;
  }
  assert.equal(cursor, capture.height, 'The final day must never be cropped');
};

test('normal weekly schedule fits one landscape page without stretching or cropping', () => {
  const capture = {
    width: 3200, height: 2050, headerHeight: 400,
    rows: Array.from({ length: 7 }, (_, i) => ({ top: 400 + i * 220, bottom: 620 + i * 220 })),
  };
  const slices = getSchedulePdfSlices(capture);
  assert.equal(slices.length, 1);
  assertCompletePages(capture, slices);
});

test('long module names flow across PDF pages at day boundaries with a repeated heading', () => {
  const capture = {
    width: 3200, height: 4670, headerHeight: 400,
    rows: Array.from({ length: 7 }, (_, i) => ({ top: 400 + i * 600, bottom: 1000 + i * 600 })),
  };
  const slices = getSchedulePdfSlices(capture);
  assert.ok(slices.length > 1);
  assertCompletePages(capture, slices);
  for (const slice of slices.slice(0, -1)) {
    assert.ok(capture.rows.some(row => row.bottom === slice.end), 'A regular day stays on one page');
  }
});

test('even a single oversized day is exported completely without an endless pagination loop', () => {
  const capture = { width: 1600, height: 3700, headerHeight: 200, rows: [{ top: 200, bottom: 3670 }] };
  const slices = getSchedulePdfSlices(capture);
  assertCompletePages(capture, slices);
  assert.ok(slices.length >= 4);
});
