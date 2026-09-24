import Link from 'next/link';
import { Upload, Download, Shield, Clock, Lock, QrCode, ArrowRight, Zap, Globe, Eye, Radio } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent)' }} />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: '#8b5cf6' }} />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 animate-fade-in" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Zap className="w-4 h-4" />
            Secure • Fast • Simple
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-fade-up">
            Share files & clipboard<br />
            <span style={{ color: 'var(--accent)' }}>instantly across devices</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-up" style={{ color: 'var(--text-secondary)', animationDelay: '0.1s' }}>
            Store files directly on Filebase object storage, or pair devices with Live Sync for real-time clipboard synchronization.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <Link href="/upload" className="btn-primary text-base px-8 py-4 w-full sm:w-auto">
              <Upload className="w-5 h-5" />
              Upload Files
            </Link>
            <Link href="/receive" className="btn-secondary text-base px-8 py-4 w-full sm:w-auto">
              <Download className="w-5 h-5" />
              Receive Files
            </Link>
            <Link href="/sync" className="btn-secondary text-base px-8 py-4 w-full sm:w-auto border-emerald-500/30 text-emerald-400 hover:border-emerald-500">
              <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
              Live Sync Clipboard
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center mb-16" style={{ color: 'var(--text-secondary)' }}>Four simple steps to share any file</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: Upload, title: 'Upload', desc: 'Drag and drop your files or browse to select' },
              { step: '02', icon: Shield, title: 'Secure', desc: 'Configure expiration, download limits, and password' },
              { step: '03', icon: QrCode, title: 'Share', desc: 'Get a short code, link, or QR code to share' },
              { step: '04', icon: Download, title: 'Download', desc: 'Recipients enter the code and download instantly' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="glass-card p-6 text-center group">
                <div className="text-xs font-bold mb-3" style={{ color: 'var(--accent)' }}>{step}</div>
                <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: 'var(--accent-light)' }}>
                  <Icon className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Premium Features</h2>
          <p className="text-center mb-16" style={{ color: 'var(--text-secondary)' }}>Everything you need for secure file sharing</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: 'Expiring Shares', desc: 'Set auto-expiration from 1 hour to 30 days. Files become inaccessible after expiry.' },
              { icon: Download, title: 'Download Limits', desc: 'Control how many times your files can be downloaded. From 1 to unlimited.' },
              { icon: Lock, title: 'Password Protection', desc: 'Add an optional password to your shares. Securely hashed, never stored in plaintext.' },
              { icon: QrCode, title: 'QR Code Sharing', desc: 'Generate QR codes for instant mobile access. Scan and download from any device.' },
              { icon: Globe, title: 'No Account Needed', desc: 'Share files instantly as a guest. Create an account for dashboard and analytics.' },
              { icon: Eye, title: 'Download Analytics', desc: 'Track downloads, view history, and monitor your shared files from the dashboard.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="file-card flex-col items-start gap-3 p-6 group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: 'var(--accent-light)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to share?</h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Start sharing files in seconds. No signup required.</p>
          <Link href="/upload" className="btn-primary text-base px-8 py-4 inline-flex">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
