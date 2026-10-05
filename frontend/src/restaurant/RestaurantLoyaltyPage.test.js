import { fireEvent, render, screen } from '@testing-library/react';
import RestaurantLoyaltyPage from './RestaurantLoyaltyPage';

jest.mock('./auth/RestaurantAuthContext', () => ({
  useRestaurantAuth: () => ({
    user: { restaurantName: 'Test Kitchen' },
    permissions: {
      viewLoyalty: true,
      manageLoyaltyPrograms: true,
      sendLoyaltyOffers: true,
    },
  }),
}));

jest.mock('../admin/components/Toast', () => ({
  useToast: () => ({ push: jest.fn() }),
}));

jest.mock('./RestaurantEngagementTab', () => function EngagementStub() {
  return <div>Engagement customers</div>;
});

jest.mock('../services/loyaltyApi', () => ({
  getLoyaltyPrograms: jest.fn(),
  getLoyaltyStats: jest.fn(),
  getLoyaltyCustomers: jest.fn(),
  getLoyaltyCustomer: jest.fn(),
  createLoyaltyCustomer: jest.fn(),
  updateLoyaltyCustomer: jest.fn(),
  deleteLoyaltyCustomer: jest.fn(),
  sendLoyaltyWhatsappOffer: jest.fn(),
  updateLoyaltyProgram: jest.fn(),
}));

const { getLoyaltyPrograms } = require('../services/loyaltyApi');

test('does not spin on loyalty programs while Customer Engagement is open', () => {
  getLoyaltyPrograms.mockImplementation(() => new Promise(() => {}));
  render(<RestaurantLoyaltyPage />);
  expect(screen.getByText('Engagement customers')).toBeInTheDocument();
  expect(screen.queryByText(/loading loyalty programs/i)).not.toBeInTheDocument();
  expect(getLoyaltyPrograms).not.toHaveBeenCalled();
});

test('loads loyalty programs when that tab is opened', async () => {
  getLoyaltyPrograms.mockResolvedValue({
    items: [
      {
        id: '1',
        programType: 'WELCOME',
        title: 'Welcome back',
        summary: 'A returning guest offer',
        enabled: true,
        configuration: {},
      },
    ],
  });
  render(<RestaurantLoyaltyPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Loyalty Programs' }));
  expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  expect(getLoyaltyPrograms).toHaveBeenCalledTimes(1);
});

test('shows retry when loyalty programs fail to load', async () => {
  getLoyaltyPrograms.mockRejectedValueOnce(new Error('Network down'));
  render(<RestaurantLoyaltyPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Loyalty Programs' }));
  expect(await screen.findByText(/unable to load loyalty programs/i)).toBeInTheDocument();
  expect(screen.getByText('Network down')).toBeInTheDocument();

  getLoyaltyPrograms.mockResolvedValueOnce({ items: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText(/no loyalty programs found/i)).toBeInTheDocument();
  expect(getLoyaltyPrograms).toHaveBeenCalledTimes(2);
});
