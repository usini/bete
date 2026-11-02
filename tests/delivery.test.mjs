import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDelay } from '../js/delivery.js';

test('French delivery copy becomes a calendar-day delay and ignores order countdowns', () => {
  const today = new Date(2026, 10, 2, 23, 59);
  assert.equal(deliveryDelay('Livraison GRATUITE **vendredi 6 novembre** pour les membres Prime. Commandez dans les 3 h', today), '4 jours');
  assert.equal(deliveryDelay('Livraison mardi 3 novembre', today), '1 jour');
  assert.equal(deliveryDelay('Livraison 2 novembre', today), '0 jours');
  assert.equal(deliveryDelay('Livraison 1er décembre 2026', today), '29 jours');
  assert.equal(deliveryDelay('Livraison 6\u00a0novembre', today), '4 jours');
});

test('year changes, accents, leap dates and DST use calendar dates', () => {
  assert.equal(deliveryDelay('Livraison 2 janvier', new Date(2026, 11, 31)), '2 jours');
  assert.equal(deliveryDelay('Livraison 2 février', new Date(2026, 0, 31)), '2 jours');
  assert.equal(deliveryDelay('Livraison 2 août', new Date(2026, 6, 31)), '2 jours');
  assert.equal(deliveryDelay('Livraison 30 mars', new Date(2026, 2, 28, 23)), '2 jours');
  assert.equal(deliveryDelay('Livraison 29 février 2028', new Date(2028, 1, 28)), '1 jour');
});

test('free text and invalid or explicitly past dates are left unchanged', () => {
  const today = new Date(2026, 10, 2);
  for (const text of ['2-3 jours', 'Commandez dans les 3 h', '31 novembre', '29 février 2026', '1 novembre 2026', '']) assert.equal(deliveryDelay(text, today), null, text);
});
