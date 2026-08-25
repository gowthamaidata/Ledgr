import React from 'react';

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

const errorStyle = {
  fontSize: '12px',
  color: 'var(--expense)',
  marginTop: '4px',
};

const wrapperStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

function getInputStyle(hasIcon, hasSuffix, hasError) {
  return {
    width: '100%',
    padding: '8px 12px',
    paddingLeft: hasIcon ? '36px' : '12px',
    paddingRight: hasSuffix ? '48px' : '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface)',
    border: `1px solid ${hasError ? 'var(--expense)' : 'var(--border)'}`,
    borderRadius: 'var(--radius)',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  };
}

const focusHandler = (e) => {
  e.target.style.borderColor = 'var(--accent)';
  e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb, 0,0,0), 0.1)';
};

const blurHandler = (hasError) => (e) => {
  e.target.style.borderColor = hasError ? 'var(--expense)' : 'var(--border)';
  e.target.style.boxShadow = 'none';
};

export default function Input({
  label,
  error,
  icon: Icon,
  suffix,
  style,
  containerStyle,
  ...rest
}) {
  return (
    <div style={{ marginBottom: '16px', ...containerStyle }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={wrapperStyle}>
        {Icon && (
          <Icon
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        )}
        <input
          style={{ ...getInputStyle(!!Icon, !!suffix, !!error), ...style }}
          onFocus={focusHandler}
          onBlur={blurHandler(!!error)}
          {...rest}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute',
              right: '12px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  icon: Icon,
  style,
  containerStyle,
  ...rest
}) {
  return (
    <div style={{ marginBottom: '16px', ...containerStyle }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={wrapperStyle}>
        {Icon && (
          <Icon
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        )}
        <textarea
          style={{
            ...getInputStyle(!!Icon, false, !!error),
            resize: 'vertical',
            minHeight: '80px',
            ...style,
          }}
          onFocus={focusHandler}
          onBlur={blurHandler(!!error)}
          {...rest}
        />
      </div>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}
