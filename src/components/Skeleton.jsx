import React from 'react';

export function Skeleton({ width, height = '16px', style, ...rest }) {
  return (
    <div
      className="skeleton"
      style={{
        width: width || '100%',
        height,
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
      {...rest}
    />
  );
}

export function SkeletonRows({ n = 3, gap = 12, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, ...style }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton
          key={i}
          height="16px"
          width={i === n - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCards({ n = 3, gap = 16, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, ...style }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}
        >
          <Skeleton height="14px" width="40%" style={{ marginBottom: '12px' }} />
          <Skeleton height="12px" width="100%" style={{ marginBottom: '8px' }} />
          <Skeleton height="12px" width="75%" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
