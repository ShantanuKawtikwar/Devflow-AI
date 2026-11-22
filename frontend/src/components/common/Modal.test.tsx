import { render, screen, fireEvent, act } from '@testing-library/react';
import { Modal } from './Modal';
import { vi } from 'vitest';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
  };

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps}>Modal content</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/test modal/i)).toBeInTheDocument();
    expect(screen.getByText(/modal content/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false}>Modal content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<Modal {...defaultProps}>Modal content</Modal>);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    render(<Modal {...defaultProps}>Modal content</Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when content clicked', () => {
    render(<Modal {...defaultProps}>Modal content</Modal>);
    fireEvent.click(screen.getByText(/modal content/i));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows description when provided', () => {
    render(<Modal {...defaultProps} description="This is a description">Modal content</Modal>);
    expect(screen.getByText(/this is a description/i)).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    render(<Modal {...defaultProps} size="sm">Content</Modal>);
    expect(screen.getByRole('dialog')).toHaveClass('max-w-sm');

    render(<Modal {...defaultProps} size="lg">Content</Modal>);
    expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl');

    render(<Modal {...defaultProps} size="xl">Content</Modal>);
    expect(screen.getByRole('dialog')).toHaveClass('max-w-4xl');

    render(<Modal {...defaultProps} size="full">Content</Modal>);
    expect(screen.getByRole('dialog')).toHaveClass('max-w-[90vw]');
  });

  it('traps focus within modal', () => {
    render(
      <Modal {...defaultProps}>
        <button>Button 1</button>
        <button>Button 2</button>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabIndex', '-1');
  });

  it('renders children correctly', () => {
    render(
      <Modal {...defaultProps}>
        <div data-testid="custom-content">Custom Content</div>
      </Modal>
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });
});