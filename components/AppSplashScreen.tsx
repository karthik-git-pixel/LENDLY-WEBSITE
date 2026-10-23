'use client';

import React from 'react';
import { ShoppingBag, Store, Package, Bike } from 'lucide-react';
import Logo, { Wordmark } from './Logo';

interface AppSplashScreenProps {
  message?: string;
  subMessage?: string;
}

export default function AppSplashScreen({
  message = 'Lendly',
  subMessage = 'Find what you need, right around you.'
}: AppSplashScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 38%, rgba(249, 115, 22, 0.16) 0%, rgba(248, 250, 252, 0.98) 62%, #f8fafc 100%)',
        color: '#0b2240',
        overflow: 'hidden',
        padding: 24,
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <style>{`
        @keyframes rcRadarRipple {
          0% {
            transform: scale(0.65);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.65);
            opacity: 0;
          }
        }

        @keyframes rcLogoFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes rcOrbitDash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -56;
          }
        }

        /* 4-Node 3D Elliptical Revolving Keyframes */
        @-webkit-keyframes rcOrbit1 {
          0% { -webkit-transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          12.5% { -webkit-transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          25% { -webkit-transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          37.5% { -webkit-transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          50% { -webkit-transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          62.5% { -webkit-transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          75% { -webkit-transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          87.5% { -webkit-transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          100% { -webkit-transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
        }

        @keyframes rcOrbit1 {
          0% { transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          12.5% { transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          25% { transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          37.5% { transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          50% { transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          62.5% { transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          75% { transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          87.5% { transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          100% { transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
        }

        @-webkit-keyframes rcOrbit2 {
          0% { -webkit-transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          12.5% { -webkit-transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          25% { -webkit-transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          37.5% { -webkit-transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          50% { -webkit-transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          62.5% { -webkit-transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          75% { -webkit-transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          87.5% { -webkit-transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          100% { -webkit-transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
        }

        @keyframes rcOrbit2 {
          0% { transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          12.5% { transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          25% { transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          37.5% { transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          50% { transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          62.5% { transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          75% { transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          87.5% { transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          100% { transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
        }

        @-webkit-keyframes rcOrbit3 {
          0% { -webkit-transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          12.5% { -webkit-transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          25% { -webkit-transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          37.5% { -webkit-transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          50% { -webkit-transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          62.5% { -webkit-transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          75% { -webkit-transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          87.5% { -webkit-transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          100% { -webkit-transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
        }

        @keyframes rcOrbit3 {
          0% { transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          12.5% { transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          25% { transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          37.5% { transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          50% { transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          62.5% { transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          75% { transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          87.5% { transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          100% { transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
        }

        @-webkit-keyframes rcOrbit4 {
          0% { -webkit-transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          12.5% { -webkit-transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          25% { -webkit-transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          37.5% { -webkit-transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          50% { -webkit-transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          62.5% { -webkit-transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          75% { -webkit-transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          87.5% { -webkit-transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          100% { -webkit-transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
        }

        @keyframes rcOrbit4 {
          0% { transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          12.5% { transform: translate3d(-110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          25% { transform: translate3d(-78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          37.5% { transform: translate3d(0px, -55px, 0) scale(0.82); z-index: 4; opacity: 0.85; }
          50% { transform: translate3d(78px, -39px, 0) scale(0.86); z-index: 4; opacity: 0.9; }
          62.5% { transform: translate3d(110px, 0px, 0) scale(0.98); z-index: 12; opacity: 1; }
          75% { transform: translate3d(78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
          87.5% { transform: translate3d(0px, 55px, 0) scale(1.08); z-index: 16; opacity: 1; }
          100% { transform: translate3d(-78px, 39px, 0) scale(1.06); z-index: 15; opacity: 1; }
        }

        @keyframes rcShimmerBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Ambient violet glow */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(36px)'
        }}
      />

      {/* ================= MAIN REVOLUTION STAGE ================= */}
      <div
        style={{
          position: 'relative',
          width: 280,
          height: 230,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18
        }}
      >
        {/* Concentric Ground Radar Waves beneath the central logo */}
        <div
          style={{
            position: 'absolute',
            bottom: 38,
            width: 130,
            height: 48,
            borderRadius: '50%',
            border: '2px solid rgba(249, 115, 22, 0.65)',
            animation: 'rcRadarRipple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 38,
            width: 130,
            height: 48,
            borderRadius: '50%',
            border: '2px solid rgba(249, 115, 22, 0.45)',
            animation: 'rcRadarRipple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite 0.8s',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 38,
            width: 130,
            height: 48,
            borderRadius: '50%',
            border: '1.5px solid rgba(234, 88, 12, 0.3)',
            animation: 'rcRadarRipple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite 1.6s',
            pointerEvents: 'none'
          }}
        />

        {/* Dashed Orbital Ellipse Ring (Matching Orbit Path rx=110, ry=55) */}
        <svg
          width="270"
          height="190"
          viewBox="0 0 270 190"
          fill="none"
          style={{ position: 'absolute', pointerEvents: 'none', zIndex: 3 }}
        >
          <ellipse
            cx="135"
            cy="95"
            rx="110"
            ry="55"
            stroke="#f97316"
            strokeWidth="2.2"
            strokeDasharray="7 7"
            strokeLinecap="round"
            style={{ animation: 'rcOrbitDash 10s linear infinite' }}
          />
        </svg>

        {/* Central Lendly mark */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rcLogoFloat 2.6s ease-in-out infinite'
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 18px 36px -12px rgba(249, 115, 22, 0.55), 0 0 0 6px rgba(249, 115, 22, 0.08)',
            }}
          >
            <Logo size={66} />
          </div>
        </div>

        {/* ================= 4 CONTINUOUSLY REVOLVING ORBIT NODES ================= */}
        
        {/* 1. Shopping Carry Bag */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -22,
            marginLeft: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#ffffff',
            border: '2.2px solid #f97316',
            boxShadow: '0 6px 16px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rcOrbit1 8s linear infinite',
            WebkitAnimation: 'rcOrbit1 8s linear infinite',
            willChange: 'transform'
          }}
        >
          <ShoppingBag size={20} style={{ color: '#0b2240' }} strokeWidth={2.4} />
        </div>

        {/* 2. Local Storefront Shop */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -22,
            marginLeft: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#ffffff',
            border: '2.2px solid #f97316',
            boxShadow: '0 6px 16px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rcOrbit2 8s linear infinite',
            WebkitAnimation: 'rcOrbit2 8s linear infinite',
            willChange: 'transform'
          }}
        >
          <Store size={20} style={{ color: '#0b2240' }} strokeWidth={2.4} />
        </div>

        {/* 3. Fast Delivery Bike */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -22,
            marginLeft: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#ffffff',
            border: '2.2px solid #f97316',
            boxShadow: '0 6px 16px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rcOrbit3 8s linear infinite',
            WebkitAnimation: 'rcOrbit3 8s linear infinite',
            willChange: 'transform'
          }}
        >
          <Bike size={21} style={{ color: '#0b2240' }} strokeWidth={2.4} />
        </div>

        {/* 4. Parcel Package Box */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -22,
            marginLeft: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#ffffff',
            border: '2.2px solid #f97316',
            boxShadow: '0 6px 16px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rcOrbit4 8s linear infinite',
            WebkitAnimation: 'rcOrbit4 8s linear infinite',
            willChange: 'transform'
          }}
        >
          <Package size={20} style={{ color: '#0b2240' }} strokeWidth={2.4} />
        </div>
      </div>

      {/* ================= LOGO & TAGLINE ================= */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <Wordmark size={40} />
        </div>

        <p
          style={{
            fontSize: 14,
            color: '#0b2240',
            margin: 0,
            fontWeight: 600,
            letterSpacing: '-0.1px',
            lineHeight: 1.4
          }}
        >
          {subMessage}
        </p>

        {/* Sleek Animated Shimmer Progress Bar */}
        <div
          style={{
            width: 140,
            height: 4,
            borderRadius: 99,
            background: 'rgba(11, 34, 64, 0.08)',
            margin: '20px auto 0',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              background: 'linear-gradient(90deg, transparent, #f97316, #ea580c, transparent)',
              animation: 'rcShimmerBar 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            }}
          />
        </div>
      </div>
    </div>
  );
}
