import React from 'react';

export function Card({ padding = true, onClick, children, style, ...rest }) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = typeof onClick === 'function';

  const cardStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: padding ? '20px' : undefined,
    cursor: isClickable ? 'pointer' : undefined,
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    boxShadow: hovered && isClickable ? 'var(--shadow)' : 'var(--shadow-sm)',
    borderColor: hovered && isClickable ? 'var(--accent)' : undefined,
    ...style,
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, style, ...rest }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        ...style,
      }}
      {...rest}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h3>
      {action && <div>{action}</div>}
    </div>
  );
}

export default Card;
