interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hover = false, onClick, padding = 'md' }: CardProps) {
  const paddingClass = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding];
  const hoverClass = hover ? 'cursor-pointer hover:shadow-card-hover transition-shadow duration-200' : '';

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-card ${paddingClass} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
}

export default Card;
