interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const variantClasses = {
  default:  'bg-gray-100 text-gray-700',
  primary:  'bg-primary-100 text-primary-800',
  accent:   'bg-orange-100 text-orange-800',
  success:  'bg-green-100 text-green-800',
  warning:  'bg-yellow-100 text-yellow-800',
  danger:   'bg-red-100 text-red-700',
  info:     'bg-blue-100 text-blue-800',
};

export function Badge({ children, variant = 'default', size = 'sm', removable, onRemove }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClass} ${variantClasses[variant]}`}>
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors"
          aria-label="Remove"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

export default Badge;
