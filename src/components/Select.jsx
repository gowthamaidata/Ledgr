import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({
  label,
  options = [],
  error,
  placeholder,
  style,
  containerStyle,
  ...rest
}) {
  return (
    <div style={{ marginBottom: '16px', ...containerStyle }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          style={{
            width: '100%',
            padding: '8px 36px 8px 12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--surface)',
            border: `1px solid ${error ? 'var(--expense)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
            lineHeight: 1.5,
            boxSizing: 'border-box',
            ...style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? 'var(--expense)' : 'var(--border)';
          }}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>
      {error && (
        <div style={{ fontSize: '12px', color: 'var(--expense)', marginTop: '4px' }}>
          {error}
        </div>
      )}
    </div>
  );
}
