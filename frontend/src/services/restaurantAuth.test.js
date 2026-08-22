/**
 * @jest-environment node
 */
import { getPermissions, RESTAURANT_ROLES } from './restaurantAuth';

test('restaurant role permissions matrix', () => {
  expect(getPermissions(RESTAURANT_ROLES.OWNER).manageSettings).toBe(true);
  expect(getPermissions(RESTAURANT_ROLES.STAFF).deleteDish).toBe(false);
  expect(getPermissions(RESTAURANT_ROLES.STAFF).addDish).toBe(true);
});
