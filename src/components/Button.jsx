import React from 'react';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary: {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    border: '1px solid var(--accent)',
  },
  secondary: {
    backgroundColor: 'var(--surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  danger: {
    backgroundColor: 'var(--expense)',
    color: '#ffffff',
    border: '1px solid var(--expense)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid transparent',
  },
};

const hoverVariants = {
  primary: { backgroundColor: 'var(--accent-hover)' },
  secondary: { backgroundColor: 'var(--bg)' },
  danger: { opacity: 0.9 },
  ghost: { backgroundColor: 'var(--surface)' },
};

const sizeStyles = {
  sm: { padding: '6px 12px', fontSize: '13px', gap: '6px' },
  md: { padding: '8px 16px', fontSize: '14px', gap: '8px' },
  lg: { padding: '12px 24px', fontSize: '16px', gap: '10px' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  children,
  style,
  ...rest
}) {
  const [hovered, setHovered] = React.useState(false);
  const isDisabled = disabled || loading;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius)',
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'background-color 0.15s ease, opacity 0.15s ease',
    width: fullWidth ? '100%' : undefined,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(hovered && !isDisabled ? hoverVariants[variant] : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}
