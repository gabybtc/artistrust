import Link from 'next/link'

const CONTACT_EMAIL = 'hello@artistrust.io'
const EFFECTIVE_DATE = 'April 9, 2026'

export const metadata = {
  title: 'Privacy Policy — ArtisTrust',
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-body), Epilogue, sans-serif',
      fontWeight: 300,
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-display), Lora, serif',
          fontSize: 20, fontStyle: 'italic', fontWeight: 400,
          color: 'var(--text)', textDecoration: 'none',
          letterSpacing: '0.01em',
        }}>
          ArtisTrust
        </Link>
        <Link href="/" style={{
          fontSize: 12, color: 'var(--muted)',
          textDecoration: 'none', letterSpacing: '0.08em',
          fontFamily: 'var(--font-body), Epilogue, sans-serif',
        }}>
          ← Back
        </Link>
      </header>

      <main style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '60px 40px 100px',
      }}>
        <p style={{
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--accent)', marginBottom: 14,
          fontFamily: 'var(--font-body), Epilogue, sans-serif',
        }}>
          Legal
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display), Lora, serif',
          fontSize: 34, fontWeight: 400, fontStyle: 'italic',
          color: 'var(--text)', marginBottom: 8,
        }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 52 }}>
          Effective {EFFECTIVE_DATE}
        </p>

        <ProseSection title="Overview">
          <p>
            ArtisTrust is a private catalogue for artists. We take data privacy seriously — your artwork, metadata,
            and personal information belong to you. This policy explains exactly what we collect, how we store it,
            who we share it with (almost no one), and how you can request deletion at any time.
          </p>
        </ProseSection>

        <ProseSection title="What we collect">
          <ul>
            <li><strong>Account information</strong> — your email address and any name you provide during sign-up.</li>
            <li><strong>Artwork images</strong> — photos and files you upload are stored on your behalf.</li>
            <li><strong>Artwork metadata</strong> — titles, dates, dimensions, materials, locations, notes, tags, and copyright information you enter.</li>
            <li><strong>EXIF / camera data</strong> — if present in an uploaded image, we read and store it (shutter speed, aperture, GPS coordinates, etc.). You can see and edit this data at any time.</li>
            <li><strong>Voice memos</strong> — audio recordings you attach to artworks are stored as audio files.</li>
            <li><strong>AI analysis results</strong> — when you run AI analysis, the image is sent to Anthropic (see Third Parties below) and the resulting description, tags, and colour palette are stored with the artwork.</li>
            <li><strong>Billing information</strong> — if you subscribe to a paid plan or add a payment method, Stripe processes and stores your card details. We store only your Stripe customer ID and subscription status — we never see your card number.</li>
            <li><strong>Usage data</strong> — upload counts per month (used to enforce plan limits). We do not run analytics, tracking pixels, or ad networks.</li>
          </ul>
        </ProseSection>

        <ProseSection title="How we store it">
          <p>
            Artwork images are stored in AWS S3 (US East region) via Supabase Storage, encrypted at rest using AES-256
            and in transit using TLS 1.2+. Metadata and account information are stored in a PostgreSQL database hosted
            by Supabase (US East region), also encrypted at rest.
          </p>
          <p>
            Access to your data is protected by row-level security policies — no other user can read or write your records.
            Our server-side code uses a service-role key only for operations you explicitly trigger (uploading, cataloguing,
            billing), and that key is never exposed to the browser.
          </p>
        </ProseSection>

        <ProseSection title="Third parties">
          <ul>
            <li>
              <strong>Supabase</strong> (supabase.com) — authentication, database, and file storage. Supabase is SOC 2 Type II certified.
              <br /><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-dim)', fontSize: 12 }}>supabase.com/privacy</a>
            </li>
            <li>
              <strong>Anthropic</strong> (anthropic.com) — AI image analysis. When you run AI cataloguing, a compressed copy of the artwork image is sent to Anthropic&apos;s API. Anthropic does not train on API inputs by default.
              <br /><a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-dim)', fontSize: 12 }}>anthropic.com/privacy</a>
            </li>
            <li>
              <strong>Stripe</strong> (stripe.com) — payment processing. Stripe is PCI DSS Level 1 certified. We never transmit your raw card data through our servers.
              <br /><a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-dim)', fontSize: 12 }}>stripe.com/privacy</a>
            </li>
            <li>
              <strong>Resend</strong> (resend.com) — transactional email delivery (welcome emails, receipts). Your email address is shared with Resend solely to deliver messages from us.
              <br /><a href="https://resend.com/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-dim)', fontSize: 12 }}>resend.com/privacy</a>
            </li>
          </ul>
          <p>We do not sell, rent, or share your personal data with any other third parties.</p>
        </ProseSection>

        <ProseSection title="Your rights">
          <ul>
            <li><strong>Access</strong> — you can export all your artwork data at any time from the app.</li>
            <li><strong>Correction</strong> — you can edit all metadata we hold about you directly in the app.</li>
            <li><strong>Deletion</strong> — you can delete your account from your Profile settings. This permanently removes all images from storage, all database records, and your authentication account. Stripe billing records are retained as required by financial regulations (typically 7 years), but are held by Stripe, not us.</li>
            <li><strong>Data portability</strong> — use the archive export feature to download all your artwork images and metadata.</li>
            <li><strong>Withdraw consent</strong> — you can stop using the service and delete your account at any time.</li>
          </ul>
          <p>
            If you are in the EU or UK, you have additional rights under GDPR / UK GDPR. To exercise any of these rights,
            contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-dim)' }}>{CONTACT_EMAIL}</a>.
          </p>
        </ProseSection>

        <ProseSection title="Cookies & sessions">
          <p>
            We use a single session cookie set by Supabase Auth to keep you signed in. We do not use advertising cookies,
            tracking cookies, or third-party analytics. The session cookie is HttpOnly and Secure.
          </p>
        </ProseSection>

        <ProseSection title="Data retention">
          <p>
            Your data is retained for as long as your account exists. If you delete your account, all data is removed immediately
            from our systems. Automated backups held by Supabase are purged on their standard schedule (typically within 30 days).
          </p>
        </ProseSection>

        <ProseSection title="Changes to this policy">
          <p>
            If we make material changes to this policy, we will notify you by email at least 14 days before the changes take effect.
            The effective date at the top of this page will always reflect the current version.
          </p>
        </ProseSection>

        <ProseSection title="Contact">
          <p>
            Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-dim)' }}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            Also see our <Link href="/terms" style={{ color: 'var(--accent-dim)' }}>Terms of Service</Link>.
          </p>
        </ProseSection>
      </main>
    </div>
  )
}

function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{
        fontFamily: 'var(--font-body), Epilogue, sans-serif',
        fontSize: 11, fontWeight: 500,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--accent)', marginBottom: 18,
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: 14, color: 'var(--text-dim)',
        lineHeight: 1.85,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {children}
      </div>
      <style>{`
        section ul {
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          list-style: disc;
        }
        section ul li { color: var(--text-dim); font-size: 14px; line-height: 1.75; }
        section ul strong { color: var(--text); font-weight: 500; }
        section p strong { color: var(--text); font-weight: 500; }
      `}</style>
    </section>
  )
}
