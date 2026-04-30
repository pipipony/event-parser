import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { tokenStorage } from '../services/api';

jest.mock('../services/api', () => ({
  authAPI: { me: jest.fn().mockResolvedValue({ data: null }) },
  tokenStorage: {
    getAccessToken: jest.fn().mockReturnValue(null),
    getRefreshToken: jest.fn().mockReturnValue(null),
    clear: jest.fn(),
    setTokens: jest.fn(),
  },
  eventsAPI: {
    getEvents: jest.fn().mockResolvedValue({ data: { items: [], total: 0, pages: 0, page: 1, page_size: 9 } }),
  },
  ticketsAPI: { createTicket: jest.fn() },
  usersAPI: { getMe: jest.fn(), getMyTickets: jest.fn() },
  weatherAPI: { getWeather: jest.fn() },
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../hooks/usePageMeta', () => () => {});

const Home = React.lazy(() => import('../pages/Home'));
const Login = React.lazy(() => import('../pages/Login'));

test('home page renders without crashing', async () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <React.Suspense fallback={<div>loading</div>}>
          <Home />
        </React.Suspense>
      </MemoryRouter>
    </AuthProvider>
  );
  expect(await screen.findByText(/aFISHa/i)).toBeInTheDocument();
});

test('login page renders', async () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <React.Suspense fallback={<div>loading</div>}>
          <Login />
        </React.Suspense>
      </MemoryRouter>
    </AuthProvider>
  );
  expect(await screen.findByRole('button', { name: /войти/i })).toBeInTheDocument();
});
