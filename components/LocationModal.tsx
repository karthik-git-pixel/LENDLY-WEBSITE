'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateUserProfile } from '@/lib/firestore';
import { getCurrentLocation, reverseGeocode, searchAddress, type Coordinates } from '@/lib/location';
import { MapPin, Search, Navigation, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationUpdated?: (loc: Coordinates & { address: string }) => void;
}

export default function LocationModal({ isOpen, onClose, onLocationUpdated }: LocationModalProps) {
  const { profile, refreshProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; address: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<{ lat: number; lng: number; address: string }>({
    lat: profile?.location?.lat || 9.9312,
    lng: profile?.location?.lng || 76.2673,
    address: profile?.location?.address || 'Kochi, Kerala',
  });
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (queryStr: string) => {
    setSearchQuery(queryStr);
    if (!queryStr.trim() || queryStr.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchAddress(queryStr);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    try {
      const coords = await getCurrentLocation();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setSelectedLoc({ lat: coords.lat, lng: coords.lng, address: addr });
      toast.success('Location detected!');
    } catch (e) {
      console.error(e);
      toast.error('Could not detect location. Please search manually below.');
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        location: {
          lat: selectedLoc.lat,
          lng: selectedLoc.lng,
          address: selectedLoc.address,
        },
      });
      await refreshProfile();
      if (onLocationUpdated) {
        onLocationUpdated(selectedLoc);
      }
      toast.success(`Location set to ${selectedLoc.address.split(',')[0]}! 📍`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'rgba(243,129,129,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
            }}>
              <MapPin size={18} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
              Set Your Location
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Detect Location Button */}
        <button
          onClick={handleDetectLocation}
          className="btn-secondary"
          style={{ width: '100%', padding: '12px 16px', borderRadius: 14, marginBottom: 16, justifyContent: 'center' }}
          disabled={detecting}
        >
          <Navigation size={16} style={{ color: 'var(--primary)', animation: detecting ? 'spin 1s linear infinite' : 'none' }} />
          <span>{detecting ? 'Detecting current GPS/IP...' : 'Use Current Device Location'}</span>
        </button>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            className="input-field"
            placeholder="Type city, neighborhood, area..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: 40, height: 44, borderRadius: 14, fontSize: 13 }}
          />
        </div>

        {/* Live Search Suggestions */}
        {searching ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Searching address suggestions...
          </div>
        ) : searchResults.length > 0 ? (
          <div style={{
            background: 'var(--surface-hover)', borderRadius: 16, border: '1px solid var(--border-color)',
            maxHeight: 180, overflowY: 'auto', marginBottom: 16, padding: 6
          }}>
            {searchResults.map((res, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedLoc(res);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.2s'
                }}
              >
                <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {res.address}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Currently Selected Location Display */}
        <div className="glass-card" style={{ padding: 16, marginBottom: 20, background: 'rgba(149,225,211,0.1)', border: '1px solid var(--accent)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 4 }}>
            Selected Location:
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} style={{ color: 'var(--primary)' }} />
            <span>{selectedLoc.address}</span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: 12, minWidth: '120px' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary" style={{ flex: 1.5, padding: 12, minWidth: '160px', whiteSpace: 'nowrap' }} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
