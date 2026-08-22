/**
 * @jest-environment node
 */
import { RESERVED_RESTAURANT_PATHS } from './publicRestaurantsApi';

test('reserved portal paths are blocked from public slugs', () => {
  expect(RESERVED_RESTAURANT_PATHS.has('dashboard')).toBe(true);
  expect(RESERVED_RESTAURANT_PATHS.has('menu')).toBe(true);
});
