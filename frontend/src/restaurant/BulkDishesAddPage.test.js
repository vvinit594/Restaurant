import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BulkDishesAddPage from './BulkDishesAddPage';

jest.mock('./auth/RestaurantAuthContext', () => ({
  useRestaurantAuth: () => ({ user: { restaurantName: 'Gateway Restaurant' } }),
}));

jest.mock('../admin/components/Toast', () => ({
  useToast: () => ({ push: jest.fn() }),
}));

jest.mock('../services/restaurantMenuApi', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  getRestaurantMenu: jest.fn().mockResolvedValue([]),
  bulkCreateDishes: jest.fn(),
}));

test('section 3 offers only the orange ZIP upload button', () => {
  render(
    <MemoryRouter>
      <BulkDishesAddPage />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('button', { name: 'Select Image Folder' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select Images Manually' })).not.toBeInTheDocument();
  expect(screen.getByText(/upload a zip file containing all dish images/i)).toBeInTheDocument();

  const zipButton = screen.getByRole('button', { name: 'Upload ZIP File' });
  expect(zipButton).toHaveClass('admin-btn', 'admin-btn-primary');
  expect(zipButton).not.toHaveClass('admin-btn-ghost');

  const input = document.querySelector('input[accept=".zip,application/zip"]');
  const click = jest.spyOn(input, 'click').mockImplementation(() => {});
  fireEvent.click(zipButton);
  expect(click).toHaveBeenCalled();
});
