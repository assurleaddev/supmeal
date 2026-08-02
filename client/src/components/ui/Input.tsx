import { TextField, InputAdornment } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { forwardRef } from 'react';

interface InputProps extends Omit<TextFieldProps, 'error' | 'variant'> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, hint, ...props }, ref) => (
    <TextField
      inputRef={ref}
      label={label}
      error={Boolean(error)}
      helperText={error || hint}
      fullWidth
      size="small"
      variant="outlined"
      InputProps={leftIcon ? {
        startAdornment: <InputAdornment position="start">{leftIcon}</InputAdornment>,
      } : undefined}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

interface TextareaProps extends Omit<TextFieldProps, 'error' | 'variant' | 'multiline'> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLInputElement, TextareaProps>(
  ({ label, error, hint, ...props }, ref) => (
    <TextField
      inputRef={ref}
      label={label}
      error={Boolean(error)}
      helperText={error || hint}
      fullWidth
      size="small"
      variant="outlined"
      multiline
      minRows={3}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';
export default Input;
