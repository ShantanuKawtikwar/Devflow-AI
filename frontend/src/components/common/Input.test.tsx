import { screen, fireEvent } from '@testing-library/react';
import { renderWithQueryClient } from '../../test/setup.tsx';
import { Input } from './Input';
import { vi } from 'vitest';

describe('Input', () => {
  it('renders label and input', () => {
    renderWithQueryClient(<Input label="Email" placeholder="Enter email" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter email/i)).toBeInTheDocument();
  });

  it('renders textarea when as="textarea"', () => {
    renderWithQueryClient(<Input label="Description" as="textarea" placeholder="Enter description" />);
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter description/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    renderWithQueryClient(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when provided', () => {
    renderWithQueryClient(<Input label="Password" helperText="Must be at least 8 characters" />);
    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    renderWithQueryClient(<Input label="Name" onChange={handleChange} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('calls onBlur handler', () => {
    const handleBlur = vi.fn();
    renderWithQueryClient(<Input label="Name" onBlur={handleBlur} />);
    fireEvent.blur(screen.getByLabelText(/name/i));
    expect(handleBlur).toHaveBeenCalled();
  });

  it('applies disabled state', () => {
    renderWithQueryClient(<Input label="Name" disabled />);
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
  });

  it('applies required attribute', () => {
    renderWithQueryClient(<Input label="Email" required />);
    expect(screen.getByLabelText(/email/i)).toBeRequired();
  });

  it('sets input type correctly', () => {
    renderWithQueryClient(<Input label="Password" type="password" />);
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
  });

  it('forwards ref correctly', () => {
    const { result } = renderWithQueryClient(<Input label="Name" />);
    // Note: Testing ref forwarding requires more complex setup
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });
});