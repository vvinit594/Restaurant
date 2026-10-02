import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { RestaurantAuthProvider } from './restaurant/auth/RestaurantAuthContext';

test('renders the DilYum home hero and navigation', () => {
  render(
    <MemoryRouter>
      <RestaurantAuthProvider>
        <App />
      </RestaurantAuthProvider>
    </MemoryRouter>
  );
  expect(screen.getByAltText(/dilyum/i)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /explore food menu/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^restaurants$/i })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: /restaurant login/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

  expect(screen.getByRole('menuitem', { name: /restaurant login/i })).toBeInTheDocument();
});
