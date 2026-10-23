'use client';

/**
 * Content-shaped loading state for the product page. Mirrors the real
 * two-column layout so nothing shifts once the listing arrives.
 */
export default function ProductDetailSkeleton() {
  return (
    <div className="page-container" style={{ maxWidth: 1240, padding: '20px 16px 80px' }} aria-busy="true" aria-label="Loading listing">
      {/* Breadcrumb */}
      <div className="skeleton" style={{ height: 14, width: 210, marginBottom: 20 }} />

      <div className="rc-detail-skeleton-grid">
        {/* Gallery column */}
        <div>
          <div
            className="skeleton"
            style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 24, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ width: 72, height: 72, borderRadius: 14, flexShrink: 0 }}
              />
            ))}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div className="skeleton" style={{ height: 16, width: 140, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 9 }} />
            <div className="skeleton" style={{ height: 12, width: '94%', marginBottom: 9 }} />
            <div className="skeleton" style={{ height: 12, width: '76%' }} />
          </div>
        </div>

        {/* Buy box column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: 20,
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div className="skeleton" style={{ height: 20, width: 78, borderRadius: 999 }} />
              <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 999 }} />
            </div>
            <div className="skeleton" style={{ height: 24, width: '86%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 13, width: '54%', marginBottom: 22 }} />
            <div className="skeleton" style={{ height: 36, width: 168, marginBottom: 22 }} />
            <div className="skeleton" style={{ height: 48, width: '100%', borderRadius: 14, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 48, width: '100%', borderRadius: 14 }} />
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: 20,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 15, width: '62%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
