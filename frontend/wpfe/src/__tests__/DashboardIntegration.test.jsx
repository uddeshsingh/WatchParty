import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import App from '../App';

vi.mock('axios');

describe('WatchParty UI Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn(); // Suppress jsdom alert crashes
  });

  it('updates the playlist automatically when a video is added', async () => {
    // Fake the Login network call
    axios.post.mockResolvedValue({ 
      data: { 
        user: { username: 'Tester' },
        token: 'fake-jwt-token' 
      } 
    });

    // Fake the Room and Video fetching
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

    // 1. Fill login
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Tester' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // 2. Create Room
    const roomInput = await screen.findByRole('textbox', { name: /new room name/i });
    fireEvent.change(roomInput, { target: { value: 'IntegrationTestRoom' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    // 3. Add a video
    const input = await screen.findByPlaceholderText(/search youtube or paste url/i);
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByRole('button', { name: /add video/i }));

    // 4. Check for auto-refresh
    await waitFor(() => {
      expect(screen.getByText(/Rick Astley/i)).toBeInTheDocument();
    });
  });
});