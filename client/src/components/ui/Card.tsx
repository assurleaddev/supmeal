import { Paper, Box, Typography } from '@mui/material';
import type { PaperProps } from '@mui/material';

interface CardProps extends PaperProps {
  children: React.ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = { none: 0, sm: 2, md: 2.5, lg: 3 };

export function Card({ children, hover = false, padding = 'md', sx, onClick, ...props }: CardProps) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: paddingMap[padding],
        cursor: hover || onClick ? 'pointer' : 'default',
        transition: hover ? 'box-shadow 0.2s' : undefined,
        '&:hover': hover ? { boxShadow: 3 } : undefined,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }} className={className}>
      {children}
    </Box>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Typography variant="h6" fontWeight={600} className={className}>
      {children}
    </Typography>
  );
}

export default Card;
