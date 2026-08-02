import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const sizeMap = {
  sm: 'xs' as const,
  md: 'sm' as const,
  lg: 'md' as const,
  xl: 'lg' as const,
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth={sizeMap[size]}
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      {title && (
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>{title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Fermer">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
      )}
      <DialogContent dividers={Boolean(title)} sx={{ pt: title ? 2 : 3 }}>
        {children}
      </DialogContent>
      {footer && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          {footer}
        </DialogActions>
      )}
    </Dialog>
  );
}

export default Modal;
