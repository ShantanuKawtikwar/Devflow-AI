import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithQueryClient } from '../../test/setup.tsx';
import { Modal } from './Modal';
import { vi } from 'vitest';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Test Modal',
  };

  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
  });

  it('renders when isOpen is true', () => {
    renderWithQueryClient(<Modal {...defaultProps} onClose={onClose}>Modal content</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/test modal/i)).toBeInTheDocument();
    expect(screen.getByText(/modal content/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWithQueryClient(<Modal {...defaultProps} isOpen={false} onClose={onClose}>Modal content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    renderWithQueryClient(<Modal {...defaultProps} onClose={onClose}>Modal content</Modal>);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    renderWithQueryClient(<Modal {...defaultProps} closeOnOverlayClick={true} onClose={onClose}>Modal content</Modal>);
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when content clicked', () => {
    renderWithQueryClient(<Modal {...defaultProps} onClose={onClose}>Modal content</Modal>);
    const content = screen.getByTestId('modal-content');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows description when provided', () => {
    renderWithQueryClient(<Modal {...defaultProps} description="This is a description" onClose={onClose}>Modal content</Modal>);
    expect(screen.getByText(/this is a description/i)).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    const { unmount, container, rerender } = renderWithQueryClient(<Modal {...defaultProps} size="sm" onClose={onClose}>Content</Modal>);
    const modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-sm');
    unmount();
    expect(container.innerHTML).toBe('');

    const { unmount: unmount2, container: container2, rerender: rerender2 } = renderWithQueryClient(<Modal {...defaultProps} size="lg" onClose={onClose}>Content</Modal>);
    const modalContent2 = screen.getByTestId('modal-content');
    expect(modalContent2).toHaveClass('max-w-2xl');
    unmount2();
    expect(container2.innerHTML).toBe('');

    const { unmount: unmount3, container: container3, rerender: rerender3 } = renderWithQueryClient(<Modal {...defaultProps} size="xl" onClose={onClose}>Content</Modal>);
    const modalContent3 = screen.getByTestId('modal-content');
    expect(modalContent3).toHaveClass('max-w-4xl');
    unmount3();
    expect(container3.innerHTML).toBe('');

    const { unmount: unmount4, container: container4, rerender: rerender4 } = renderWithQueryClient(<Modal {...defaultProps} size="full" onClose={onClose}>Content</Modal>);
    const modalContent4 = screen.getByTestId('modal-content');
    expect(modalContent4).toHaveClass('max-w-[90vw]');
    unmount4();
    expect(container4.innerHTML).toBe('');
  });

  it('renders children correctly', () => {
    renderWithQueryClient(
      <Modal {...defaultProps} onClose={onClose}>
        <div data-testid="custom-content">Custom Content</div>
      </Modal>
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });
});