'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, X, Shield, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface KYCApplication {
  uid: string;
  email?: string;
  displayName?: string;
  kycData?: {
    personal?: { fullName?: string; email?: string };
    identity?: { panNumberMasked?: string; governmentIdMasked?: string };
    address?: { address?: string; district?: string; state?: string; pinCode?: string };
    bank?: { accountNumberMasked?: string; ifsc?: string };
    business?: { businessName?: string; businessPanMasked?: string; gstin?: string };
  };
}

export default function AdminKYCPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<KYCApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await authFetch('/api/admin/kyc');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplications(data.applications || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch KYC applications';
      toast.error(msg);
      if (msg.includes('Unauthorized')) {
        router.push('/home'); // Redirect non-admins
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (uid: string, action: 'APPROVE' | 'REJECT') => {
    if (action === 'REJECT' && !rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      const res = await authFetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: uid, action, reason: action === 'REJECT' ? rejectionReason : undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Application ${action === 'APPROVE' ? 'Approved' : 'Rejected'}!`);
      setSelectedApp(null);
      setRejectionReason('');
      fetchApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} application`;
      toast.error(msg);
    }
  };

  if (!profile) return null;

  return (
    <div className="fade-in">
      <div className="top-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>Admin Dashboard</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>KYC Management</p>
          </div>
        </div>
      </div>

      <div className="page-container pb-safe">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading...</div>
        ) : applications.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <Shield size={48} style={{ color: 'var(--muted)', margin: '0 auto 16px', opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>No Pending Applications</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>All caught up!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {applications.map((app) => (
              <div key={app.uid} className="glass-card" style={{ padding: 20, borderRadius: 16, borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>{app.kycData?.personal?.fullName || app.displayName}</h3>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>ID: {app.uid}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Email: {app.kycData?.personal?.email || app.email}</p>
                  </div>
                  <div style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--accent)', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> PENDING
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>PAN Number</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{app.kycData?.identity?.panNumberMasked}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Aadhaar/Govt ID</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{app.kycData?.identity?.governmentIdMasked}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Address</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
                      {app.kycData?.address?.address}, {app.kycData?.address?.district}, {app.kycData?.address?.state} - {app.kycData?.address?.pinCode}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Bank Account</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{app.kycData?.bank?.accountNumberMasked}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>IFSC</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{app.kycData?.bank?.ifsc}</div>
                  </div>
                  {app.kycData?.business && (
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>Business Details</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Name</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{app.kycData.business.businessName}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Business PAN</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{app.kycData.business.businessPanMasked}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedApp === app.uid ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: 12, borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <AlertCircle size={14} /> Rejection Reason
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Invalid PAN format, Bank name mismatch..." 
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="input-field"
                      style={{ marginBottom: 12, padding: 10, fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setSelectedApp(null)} className="btn-secondary" style={{ flex: 1, padding: 8, fontSize: 12 }}>Cancel</button>
                      <button onClick={() => handleAction(app.uid, 'REJECT')} className="btn-primary" style={{ flex: 1, padding: 8, fontSize: 12, background: 'var(--danger)' }}>Confirm Rejection</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                      onClick={() => handleAction(app.uid, 'APPROVE')} 
                      className="btn-primary" 
                      style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button 
                      onClick={() => setSelectedApp(app.uid)} 
                      className="btn-secondary" 
                      style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, color: 'var(--danger)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
