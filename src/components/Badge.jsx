import React from 'react';

const variantMap = {
  default: {
    backgroundColor: 'var(--surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  success: {
    backgroundColor: 'color-mix(in srgb, var(--income) 12%, transparent)',
    color: 'var(--income)',
    border: '1px solid color-mix(in srgb, var(--income) 25%, transparent)',
  },
  warning: {
    backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
    color: 'var(--warning)',
    border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
  },
  danger: {
    backgroundColor: 'color-mix(in srgb, var(--expense) 12%, transparent)',
    color: 'var(--expense)',
    border: '1px solid color-mix(in srgb, var(--expense) 25%, transparent)',
  },
  accent: {
    backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    color: 'var(--accent)',
    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
  },
};

export default function Badge({ variant = 'default', children, style, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '999px',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...variantMap[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
