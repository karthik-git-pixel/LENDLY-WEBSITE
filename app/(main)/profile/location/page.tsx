'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateUserProfile } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/error-utils';
import { getCurrentLocation } from '@/lib/location';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Navigation, MapPin, Check } from 'lucide-react';

export default function UpdateLocationPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [address, setAddress] = useState(profile?.location?.address || '');
  const [location, setLocation] = useState(profile?.location ? { lat: profile.location.lat, lng: profile.location.lng } : null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`);
        const data = await res.json();
        if (data.display_name) setAddress(data.display_name);
      } catch {}
      toast.success('Location updated!');
    } catch { toast.error('Could not detect location'); }
    finally { setDetecting(false); }
  };

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      await updateUserProfile(profile.uid, {
        location: { lat: location?.lat || 0, lng: location?.lng || 0, address },
      });
      await refreshProfile();
      toast.success('Location saved!');
      router.back();
    } catch (e) { toast.error(getErrorMessage(e, 'Failed to save location')); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Update Location</h1>
        <div style={{ width: 36 }} />
      </div>
      <div className="page-container">
        <button onClick={handleDetect} className="btn-primary" style={{ width: '100%', marginBottom: 16, padding: 14 }} disabled={detecting}>
          {detecting ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Navigation size={18} /> Detect My Location</>}
        </button>
        {location && (
          <div className="glass-card" style={{ padding: 12, marginBottom: 16, fontSize: 13 }}>
            <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
          </div>
        )}
        <div style={{ marginBottom: 24 }}>
          <label className="input-label">Address</label>
          <input className="input-field" value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <button onClick={handleSave} className="btn-primary" style={{ width: '100%', padding: 14 }} disabled={loading}>
          {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Check size={16} /> Save Location</>}
        </button>
      </div>
    </div>
  );
}
