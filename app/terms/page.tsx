import Link from 'next/link'

const CONTACT_EMAIL = 'hello@artistrust.io'
const EFFECTIVE_DATE = 'April 9, 2026'

export const metadata = {
  title: 'Terms of Service — ArtisTrust',
}

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 52 }}>
          Effective {EFFECTIVE_DATE}
        </p>

        <ProseSection title="Acceptance">
          <p>
            By creating an ArtisTrust account or using the service, you agree to these Terms of Service.
            If you do not agree, do not use the service. These terms form a binding agreement between you
            and ArtisTrust. We may update them from time to time — continued use after changes are notified
            constitutes acceptance.
          </p>
        </ProseSection>

        <ProseSection title="The service">
          <p>
            ArtisTrust provides a private digital catalogue for artists to store, organise, and manage records of
            their artwork. Features include image storage, AI-assisted cataloguing, copyright documentation,
            voice memos, and shareable portfolio links.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the service at any time. We will
            give reasonable notice (at least 30 days by email) before discontinuing the service entirely.
          </p>
        </ProseSection>

        <ProseSection title="Your content & intellectual property">
          <p>
            <strong>You own your work.</strong> ArtisTrust claims no rights, licences, or ownership over any
            artwork, image, or content you upload. Your intellectual property is yours entirely.
          </p>
          <p>
            By uploading content, you grant ArtisTrust a limited, non-exclusive, non-transferable licence solely
            to store, display, and transmit that content back to you as part of providing the service. This licence
            ends when you delete the content or close your account.
          </p>
          <p>
            You are responsible for ensuring you have the right to upload any content. Do not upload content that
            infringes a third party&apos;s intellectual property rights.
          </p>
        </ProseSection>

        <ProseSection title="Acceptable use">
          <p>You agree not to:</p>
          <ul>
            <li>Upload content that is illegal, abusive, or infringes third-party rights.</li>
            <li>Attempt to gain unauthorised access to other users&apos; data or our systems.</li>
            <li>Use the service to distribute malware or conduct phishing attacks.</li>
            <li>Reverse-engineer or scrape the service in ways that would damage its performance.</li>
            <li>Resell or sublicence access to the service without written permission.</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms without prior notice.
          </p>
        </ProseSection>

        <ProseSection title="Plans & billing">
          <p>
            ArtisTrust offers a free <strong>Preserve</strong> plan (25 uploads/month) and paid plans
            (Studio and Archive) with higher monthly upload limits. Paid plans are billed monthly or annually
            via Stripe.
          </p>
          <ul>
            <li><strong>Subscriptions</strong> renew automatically at the end of each billing period. You can cancel at any time from your billing settings — access continues until the end of the paid period.</li>
            <li><strong>Overage charges</strong> — if you exceed your plan&apos;s monthly upload limit, additional uploads cost $0.05 each (minimum charge $0.50), charged to your saved payment method. You will be shown the total before confirming.</li>
            <li><strong>Refunds</strong> — we do not offer refunds for partial subscription periods or overage charges that have already been processed. If you believe a charge was made in error, contact us within 14 days.</li>
            <li><strong>Price changes</strong> — we will give at least 30 days&apos; notice of any price increase by email. Continued use after that date constitutes acceptance.</li>
          </ul>
        </ProseSection>

        <ProseSection title="AI analysis">
          <p>
            The AI cataloguing feature sends a compressed copy of your uploaded image to Anthropic&apos;s API to
            generate descriptions and tags. This analysis is provided for convenience — it may not be accurate.
            You are responsible for reviewing and correcting any AI-generated data before relying on it (for example,
            in copyright registration applications).
          </p>
        </ProseSection>

        <ProseSection title="Shared portfolios">
          <p>
            Studio and Archive plan users can generate shareable portfolio links for their catalogue. These links
            are accessible to anyone with the URL. You are solely responsible for the content of any shared
            portfolio and for deciding who to share links with.
          </p>
        </ProseSection>

        <ProseSection title="Availability & data safety">
          <p>
            We aim for high availability but do not guarantee uninterrupted access. We maintain regular backups
            but recommend exporting your archive periodically as a personal backup.
          </p>
          <p>
            We are not liable for data loss caused by circumstances beyond our reasonable control, including
            third-party infrastructure failures (Supabase, AWS). In the event of data loss, we will notify
            affected users promptly and make reasonable efforts to restore from backups.
          </p>
        </ProseSection>

        <ProseSection title="Account termination">
          <p>
            You may delete your account at any time from your Profile settings. Deletion is immediate and
            permanent — all images and data are removed from our systems (see our{' '}
            <Link href="/privacy" style={{ color: 'var(--accent-dim)' }}>Privacy Policy</Link> for details
            on backup retention).
          </p>
          <p>
            We may terminate accounts that violate these terms. If we terminate your account for reasons other
            than a terms violation, we will give 30 days&apos; notice and a pro-rated refund of any prepaid subscription.
          </p>
        </ProseSection>

        <ProseSection title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, ArtisTrust&apos;s liability to you for any claim arising from
            use of the service is limited to the amount you paid us in the 12 months preceding the claim. We are
            not liable for indirect, incidental, or consequential damages.
          </p>
          <p>
            Nothing in these terms limits liability for fraud, death, or personal injury caused by negligence.
          </p>
        </ProseSection>

        <ProseSection title="Governing law">
          <p>
            These terms are governed by the laws of the jurisdiction in which ArtisTrust is registered. Any
            disputes will be resolved in the courts of that jurisdiction.
          </p>
        </ProseSection>

        <ProseSection title="Contact">
          <p>
            Questions: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-dim)' }}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            Also see our <Link href="/privacy" style={{ color: 'var(--accent-dim)' }}>Privacy Policy</Link>.
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
