'use client';

import React from 'react';
import { useLanguage } from '@/lib/language-context';
import { LANGUAGES, SupportedLanguage } from '@/lib/i18n';
import { Globe, Check, X } from 'lucide-react';

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguageSelectorModal({ isOpen, onClose }: LanguageSelectorModalProps) {
  const { language, setLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content fade-in"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 420, padding: 24, borderRadius: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(22, 163, 74,0.15)',
              color: 'var(--primary-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
                {t('selectLanguage')}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                Change language for whole site
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LANGUAGES.map(lang => {
            const isSelected = language === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(22, 163, 74,0.08)' : 'var(--surface-hover)',
                  transition: 'all 0.15s ease'
                }}
                className="hover-scale"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 22 }}>{lang.flag}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: isSelected ? 'var(--primary-dark)' : 'var(--foreground)' }}>
                      {lang.nativeName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {lang.name}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={16} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
