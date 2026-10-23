'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Sheet from '@/components/ui/Sheet';
import { createReport } from '@/lib/supabase-db';

const REASONS = [
  'Misleading or suspicious listing',
  'Prohibited or illegal item',
  'Wrong price or description',
  'Possible fraud or scam',
  'Counterfeit item',
  'Other safety concern',
];

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  reporterId: string;
  productId?: string;
  sellerId?: string;
  orderId?: string;
}

export default function ReportSheet({ open, onClose, reporterId, productId, sellerId, orderId }: ReportSheetProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await createReport({ reporterId, productId, sellerId, orderId, reason, description: details.trim() });
      toast.success('Thanks — our team will review it');
      setDetails('');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the report');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={orderId ? 'Report a problem' : 'Report this listing'}
      footer={
        <>
          <button type="button" className="ln-btn ln-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ln-btn ln-btn-primary" style={{ flex: 1 }} disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </>
      }
    >
      <fieldset className="ln-fieldset">
        <legend className="ln-field-label">What&apos;s wrong?</legend>
        <div className="ln-radio-list">
          {REASONS.map(r => (
            <label key={r} className="ln-radio">
              <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="ln-field-label" htmlFor="report-details">Details (optional)</label>
      <textarea
        id="report-details"
        className="ln-input"
        rows={3}
        maxLength={2000}
        value={details}
        onChange={e => setDetails(e.target.value)}
        placeholder="Anything that helps us check it quickly"
      />
    </Sheet>
  );
}
