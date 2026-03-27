import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import App from '../App';

vi.mock('axios');

describe('WatchParty Full System Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn(); // Suppress jsdom alert crashes
  });

  it('completes the full flow: login -> create room -> add video', async () => {
    
    // Fake the network
    axios.post.mockResolvedValue({ 
      data: { 
        user: { username: 'uddesh_test' },
        token: 'fake-jwt-token'
      } 
    });
    axios.get.mockImplementation((url) => {
      if (url.includes('/videos')) {
        return Promise.resolve({ data: [{ id: 1, title: 'Rick Astley' }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <GoogleOAuthProvider clientId="test-client-id">
        <App />
      </GoogleOAuthProvider>
    );

    // 1. Login Phase
    const usernameInput = screen.getByPlaceholderText(/username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const loginBtn = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(usernameInput, { target: { value: 'uddesh_test' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginBtn);

    // 2. Lobby Phase
    const roomInput = await screen.findByPlaceholderText(/create new room name/i);
    const createBtn = screen.getByRole('button', { name: /create/i });

    fireEvent.change(roomInput, { target: { value: 'IntegrationTestRoom' } });
    fireEvent.click(createBtn);

    // 3. Dashboard Phase
    const videoInput = await screen.findByPlaceholderText(/search youtube or paste url/i);
    const addBtn = screen.getByRole('button', { name: /add video/i }); 

    fireEvent.change(videoInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    fireEvent.click(addBtn);

    // 4. Verify Video List
    await waitFor(() => {
      expect(screen.getByText(/Rick Astley/i)).toBeInTheDocument();
    });
  });
});