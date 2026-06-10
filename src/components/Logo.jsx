import React from 'react';

export default function Logo({ size = 48, white = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.18,
        background: white ? 'rgba(255,255,255,.12)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: white ? '2px solid rgba(255,255,255,.2)' : 'none',
      }}
    >
      <img
        src="/logo-kalan.png"
        alt="Kalan Consulting"
        style={{ width: '90%', height: '90%', objectFit: 'contain' }}
      />
    </div>
  );
}
