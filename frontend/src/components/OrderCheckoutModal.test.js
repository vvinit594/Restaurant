import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderCheckoutModal, { parseTableNumber } from './OrderCheckoutModal';
import { placePublicOrder } from '../services/ordersApi';

jest.mock('../services/ordersApi', () => ({
  placePublicOrder: jest.fn(),
}));

const items = [{ dishId: 'd1', name: 'Paneer', price: 100, quantity: 1 }];

function renderModal() {
  return render(
    <MemoryRouter>
      <OrderCheckoutModal
        open
        restaurantName="XYZ Restaurant"
        restaurantSlug="xyz-rest"
        items={items}
        onClose={jest.fn()}
      />
    </MemoryRouter>,
  );
}

test('parseTableNumber accepts positive integers and rejects invalid values', () => {
  expect(parseTableNumber('1')).toEqual({ valid: true, empty: false, number: '1' });
  expect(parseTableNumber(' 025 ')).toEqual({ valid: true, empty: false, number: '25' });
  expect(parseTableNumber('100').valid).toBe(true);
  expect(parseTableNumber('').valid).toBe(false);
  expect(parseTableNumber('0').valid).toBe(false);
  expect(parseTableNumber('-1').valid).toBe(false);
  expect(parseTableNumber('1.5').valid).toBe(false);
  expect(parseTableNumber('abc').valid).toBe(false);
});

test('table step uses a manual number and sends it with the order', async () => {
  placePublicOrder.mockResolvedValue({ orderNumber: 'DY1', tableNumber: '25' });
  renderModal();

  expect(screen.queryByRole('button', { name: 'Table 1' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Table Number')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Table Number'), { target: { value: '1.5' } });
  expect(screen.getByText('Please enter a valid table number.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Table Number'), { target: { value: '25' } });
  expect(screen.queryByText('Please enter a valid table number.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('25')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await waitFor(() => {
    expect(placePublicOrder).toHaveBeenCalledWith(
      'xyz-rest',
      expect.objectContaining({ tableNumber: '25' }),
    );
  });
  expect(placePublicOrder.mock.calls[0][1].tableId).toBeUndefined();
});
