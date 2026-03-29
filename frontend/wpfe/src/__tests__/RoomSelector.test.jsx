import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import RoomSelector from '../components/RoomSelector';

vi.mock('axios');

describe('RoomSelector Integration', () => {
  beforeEach(() => {
    // Prevent network errors during testing
    axios.get.mockResolvedValue({ data: [] });
  });

  it('creates a new room and fires onJoin', async () => {
    const handleJoin = vi.fn();
    render(<RoomSelector onJoin={handleJoin} />);

    const input = screen.getByPlaceholderText('Create new room name...');
    const createBtn = screen.getByRole('button', { name: /create/i });

    fireEvent.change(input, { target: { value: 'My Awesome Room' } });
    fireEvent.click(createBtn);

    expect(handleJoin).toHaveBeenCalledWith('my-awesome-room', 'create', undefined);
  });

  it('calls onLogout when Log out is clicked', () => {
    const handleJoin = vi.fn();
    const handleLogout = vi.fn();
    render(
      <RoomSelector onJoin={handleJoin} onLogout={handleLogout} username="alice" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});