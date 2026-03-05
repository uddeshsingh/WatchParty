import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatSidebar from '../components/ChatSidebar';

describe('ChatSidebar UI Component', () => {
  const mockMessages = [
    { type: 'system', content: 'Alice joined the party!' },
    { type: 'chat', username: 'Bob', content: 'Hello everyone!' }
  ];

  it('renders messages correctly', () => {
    render(
      <ChatSidebar 
        messages={mockMessages} 
        onSendMessage={vi.fn()} 
        onTyping={vi.fn()} 
        typingUsers={[]} 
        onSendReaction={vi.fn()} 
      />
    );

    expect(screen.getByText('Alice joined the party!')).toBeDefined();
    expect(screen.getByText('Hello everyone!')).toBeDefined();
    expect(screen.getByText('Bob:')).toBeDefined();
  });

  it('handles typing and sending messages', () => {
    const handleSend = vi.fn();
    const handleTyping = vi.fn();

    render(
      <ChatSidebar 
        messages={[]} 
        onSendMessage={handleSend} 
        onTyping={handleTyping} 
        typingUsers={[]} 
        onSendReaction={vi.fn()} 
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');
    
    const sendBtn = screen.getByRole('button', { name: 'Send' }); 

    fireEvent.change(input, { target: { value: 'Testing message' } });
    expect(handleTyping).toHaveBeenCalled();

    fireEvent.click(sendBtn); 
    expect(handleSend).toHaveBeenCalledWith('Testing message');
  });

  it('shows typing indicators for other users', () => {
    render(
      <ChatSidebar 
        messages={[]} 
        onSendMessage={vi.fn()} 
        onTyping={vi.fn()} 
        typingUsers={['Alice', 'Charlie']} 
        onSendReaction={vi.fn()} 
      />
    );

    expect(screen.getByText('Alice, Charlie are typing...')).toBeDefined();
  });
});