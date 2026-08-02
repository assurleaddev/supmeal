import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const colorMap: Record<string, ChipProps['color']> = {
  default:  'default',
  primary:  'primary',
  accent:   'default',
  success:  'success',
  warning:  'warning',
  danger:   'error',
  info:     'info',
};

const sxMap: Record<string, object> = {
  accent: { bgcolor: '#fed7aa', color: '#9a3412' },
};

export function Badge({ children, variant = 'default', size = 'sm', removable, onRemove }: BadgeProps) {
  return (
    <Chip
      label={children}
      color={colorMap[variant]}
      size={size === 'sm' ? 'small' : 'medium'}
      onDelete={removable ? onRemove : undefined}
      sx={{ fontWeight: 500, ...sxMap[variant] }}
    />
  );
}

export default Badge;
