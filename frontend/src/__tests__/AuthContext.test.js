import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { authAPI, tokenStorage } from '../services/api';

jest.mock('../services/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
  },
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clear: jest.fn(),
  },
}));

const TestComponent = () => {
  const { user, isAuthenticated, isAdmin, login, logout, register } = useAuth();
  return (
    <div>
      <span data-testid="username">{user?.username || 'none'}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <button onClick={() => login('testuser', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => register({ username: 'new', email: 'n@n.com', password: 'p' })}>Register</button>
    </div>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  tokenStorage.getAccessToken.mockReturnValue(null);
  tokenStorage.getRefreshToken.mockReturnValue(null);
});

test('initial state: not authenticated', async () => {
  renderWithAuth();
  await waitFor(() => {
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });
});

test('login sets user state', async () => {
  authAPI.login.mockResolvedValue({ data: { access_token: 'acc', refresh_token: 'ref' } });
  authAPI.me.mockResolvedValue({ data: { username: 'testuser', role: 'user', id: 1 } });
  tokenStorage.getAccessToken.mockReturnValue('acc');

  renderWithAuth();
  const loginBtn = screen.getByText('Login');

  await act(async () => {
    await userEvent.click(loginBtn);
  });

  await waitFor(() => {
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('testuser');
    expect(screen.getByTestId('admin').textContent).toBe('false');
  });
});

test('admin role detected correctly', async () => {
  authAPI.login.mockResolvedValue({ data: { access_token: 'acc', refresh_token: 'ref' } });
  authAPI.me.mockResolvedValue({ data: { username: 'admin', role: 'admin', id: 1 } });
  tokenStorage.getAccessToken.mockReturnValue('acc');

  renderWithAuth();

  await act(async () => {
    await userEvent.click(screen.getByText('Login'));
  });

  await waitFor(() => {
    expect(screen.getByTestId('admin').textContent).toBe('true');
  });
});

test('logout clears state', async () => {
  authAPI.login.mockResolvedValue({ data: { access_token: 'acc', refresh_token: 'ref' } });
  authAPI.me.mockResolvedValue({ data: { username: 'testuser', role: 'user', id: 1 } });
  authAPI.logout.mockResolvedValue({});
  tokenStorage.getAccessToken.mockReturnValue('acc');
  tokenStorage.getRefreshToken.mockReturnValue('ref');

  renderWithAuth();

  await act(async () => {
    await userEvent.click(screen.getByText('Login'));
  });

  await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('true'));

  await act(async () => {
    await userEvent.click(screen.getByText('Logout'));
  });

  await waitFor(() => {
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(tokenStorage.clear).toHaveBeenCalled();
  });
});

test('register creates session', async () => {
  authAPI.register.mockResolvedValue({ data: { access_token: 'acc', refresh_token: 'ref' } });
  authAPI.me.mockResolvedValue({ data: { username: 'new', role: 'user', id: 2 } });
  tokenStorage.getAccessToken.mockReturnValue('acc');

  renderWithAuth();

  await act(async () => {
    await userEvent.click(screen.getByText('Register'));
  });

  await waitFor(() => {
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('new');
  });
});
