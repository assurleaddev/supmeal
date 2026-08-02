import { Button as MuiButton, CircularProgress } from '@mui/material';
import type { ButtonProps as MuiButtonProps } from '@mui/material';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'size'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function getVariantProps(variant: Variant): { muiVariant: MuiButtonProps['variant']; color?: string; sx?: object } {
  switch (variant) {
    case 'primary':   return { muiVariant: 'contained', color: 'primary' };
    case 'secondary': return { muiVariant: 'contained', color: 'inherit', sx: { bgcolor: 'grey.100', color: 'text.primary', boxShadow: 'none', '&:hover': { bgcolor: 'grey.200', boxShadow: 'none' } } };
    case 'danger':    return { muiVariant: 'contained', color: 'error' };
    case 'ghost':     return { muiVariant: 'text', color: 'inherit' };
    case 'outline':   return { muiVariant: 'outlined', color: 'inherit', sx: { borderColor: 'grey.300', color: 'text.primary', '&:hover': { bgcolor: 'grey.50' } } };
  }
}

const sizeMap: Record<Size, MuiButtonProps['size']> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, disabled, sx, ...props }, ref) => {
    const { muiVariant, color, sx: variantSx } = getVariantProps(variant);
    return (
      <MuiButton
        ref={ref}
        variant={muiVariant}
        color={color as MuiButtonProps['color']}
        size={sizeMap[size]}
        disabled={disabled || loading}
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : leftIcon}
        endIcon={!loading ? rightIcon : undefined}
        sx={{ ...variantSx, ...sx }}
        {...props}
      >
        {children}
      </MuiButton>
    );
  },
);

Button.displayName = 'Button';
export default Button;
