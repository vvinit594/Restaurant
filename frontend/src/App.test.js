import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { RestaurantAuthProvider } from './restaurant/auth/RestaurantAuthContext';

test('renders the restaurant hero heading', () => {
  render(
    <MemoryRouter>
      <RestaurantAuthProvider>
        <App />
      </RestaurantAuthProvider>
    </MemoryRouter>
  );
  const heading = screen.getByRole('heading', {
    name: /craving something extraordinary/i,
  });
  expect(heading).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^restaurants$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /restaurant login/i })).toBeInTheDocument();
});
