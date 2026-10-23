'use client';

/** Loading placeholder shaped like a ProductCard, so the grid never jumps. */
export default function ProductCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            animation: `rcStaggerIn 0.5s var(--ease-out-expo) ${i * 45}ms backwards`,
          }}
        >
          <div className="skeleton" style={{ aspectRatio: '1 / 0.9', borderRadius: 0 }} />
          <div style={{ padding: '12px 12px 13px' }}>
            <div className="skeleton" style={{ height: 15, width: '78%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '46%', marginBottom: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div className="skeleton" style={{ height: 16, width: 62 }} />
              <div className="skeleton" style={{ height: 30, width: 30, borderRadius: '50%' }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
