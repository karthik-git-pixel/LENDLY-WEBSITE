'use client';

export default function FeaturedIn() {
  return (
    <section style={{ marginTop: 36, marginBottom: 24, textTransform: 'uppercase' }}>
      <div 
        style={{ 
          textAlign: 'center', 
          marginBottom: 16,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '1.5px',
          color: 'var(--muted)',
          opacity: 0.75,
        }}
      >
        Featured & Recognized In
      </div>

      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(24px, 5vw, 48px)',
          flexWrap: 'wrap',
          background: 'var(--surface)',
          padding: '20px 24px',
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Google */}
        <div className="featured-logo" title="Google">
          <svg viewBox="0 0 24 24" width="76" height="26" fill="currentColor">
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
          </svg>
        </div>

        {/* Adobe */}
        <div className="featured-logo" title="Adobe">
          <svg viewBox="0 0 24 24" width="76" height="24" fill="currentColor">
            <path d="M13.966 22h9.437L15.342 2.6H8.625l5.341 19.4zm-9.37 0L.5 22 8.625 2.6h3.42L4.596 22zM15.5 15.5h-5.2l2.6-6.3 2.6 6.3z"/>
          </svg>
        </div>

        {/* Adidas */}
        <div className="featured-logo" title="Adidas">
          <svg viewBox="0 0 24 24" width="68" height="26" fill="currentColor">
            <path d="M22.983 20.898l-7.794-13.5h-4.32l5.12 8.868-3.085 1.782-3.882-6.726h-4.32l3.882 6.726-3.085 1.782-2.645-4.582h-4.32l4.492 7.782h24.262zm-7.794-13.5l3.228 5.592h4.32l-7.548-13.074h-4.32l4.32 7.482z"/>
          </svg>
        </div>

        {/* CARS24 */}
        <div className="featured-logo" title="CARS24">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>
            <span>CARS</span>
            <span style={{ background: 'currentColor', color: 'var(--surface)', padding: '1px 6px', borderRadius: 4, fontSize: 15 }}>24</span>
          </div>
        </div>

        {/* TechCrunch */}
        <div className="featured-logo" title="TechCrunch">
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.8px', fontFamily: 'sans-serif' }}>
            Tech<span style={{ fontWeight: 400 }}>Crunch</span>
          </div>
        </div>

        {/* YourStory */}
        <div className="featured-logo" title="YourStory">
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px', fontFamily: 'sans-serif' }}>
            YOUR<span style={{ fontWeight: 300 }}>STORY</span>
          </div>
        </div>
      </div>
    </section>
  );
}
