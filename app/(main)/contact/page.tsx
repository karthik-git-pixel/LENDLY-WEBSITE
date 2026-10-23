'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitted(true);
    toast.success('Your message has been sent successfully!');
  };

  return (
    <div className="fade-in">
      <div className="top-header">
        <button onClick={() => router.back()} className="btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Contact Us</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="page-container" style={{ maxWidth: 800 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
          {/* Left Column: Contact Details */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', marginBottom: 6 }}>
              Get in Touch
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
              Have questions about your local order, online payments, or seller listings? We&apos;re here to help!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ background: 'rgba(22, 163, 74, 0.15)', padding: 10, borderRadius: 12, color: 'var(--primary)' }}>
                  <Mail size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>Email Support</div>
                  <a href="mailto:support@lendly.app" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                    support@lendly.app
                  </a>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Response time: 24-48 hours</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: 12, color: '#10b981' }}>
                  <Phone size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>Customer Care</div>
                  <a href="tel:+919526477923" style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600, textDecoration: 'none' }}>
                    +91 95264 77923
                  </a>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Mon - Sat: 9:00 AM - 7:00 PM IST</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: 10, borderRadius: 12, color: '#3b82f6' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>Marketplace Headquarters</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
                    Lendly Hyperlocal Technologies<br />
                    Infopark Campus, Kakkanad,<br />
                    Kochi, Kerala - 682030, India
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Direct Message Form */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', marginBottom: 16 }}>
              Send Us a Message
            </h3>

            {submitted ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>Message Received!</h4>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Thank you for reaching out. Our support team will get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Order inquiry, payment issue..."
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>Message *</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="How can we help you?"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13, resize: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
                >
                  <Send size={16} /> Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
