import Link from 'next/link'

const CONTACT_EMAIL = 'hello@artistrust.io'
const EFFECTIVE_DATE = 'April 15, 2026'

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

        <ProseSection title="Acceptance of Terms.">
          <p>
            Welcome to ArtisTrust. These Terms of Service (&quot;Terms&quot;) govern your access to
            and use of the ArtisTrust website, services, and platform provided by Wibbly Works Inc. (&quot;ArtisTrust,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          </p>
          <p>
            By creating an ArtisTrust account or using the service, you agree to be bound by
            these Terms. If you do not agree to these Terms, please do not use our
            services. We may update them from time to time. Continued use after changes are notified
            constitutes acceptance.
          </p>
        </ProseSection>

        <ProseSection title="The Service.">
          <p>
            ArtisTrust provides a private digital catalogue for artists to store, organise,
            and manage records of their artwork. Features include image storage, AI-assisted
            cataloguing, copyright documentation, voice memos, and shareable portfolio
            links.
          </p>
          <p>
            <strong>AI Analysis:</strong> The AI cataloguing feature sends a compressed copy of your uploaded image to
            Anthropic&apos;s API to generate descriptions and tags. This analysis is provided for
            convenience and may not be entirely accurate. You are responsible for reviewing
            and correcting any AI-generated data before relying on it.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the service
            at any time. We will give reasonable notice (at least 30 days by email) before
            discontinuing the service entirely.
          </p>
        </ProseSection>

        <ProseSection title="Content and Ownership.">
          <p>
            <strong>Your art remains your art.</strong> ArtisTrust claims no rights, licences, or ownership
            over any artwork, image, or content you upload. Your intellectual property is
            yours entirely.
          </p>
          <p>
            By uploading content, you grant ArtisTrust a limited, non-exclusive,
            non-transferable licence solely to host, store, display, and transmit that content back to
            you as part of providing the service to you. This licence ends when you delete
            the content or close your account.
          </p>
          <p>
            You represent and warrant that you own or have the necessary rights and
            permissions to upload all content to our platform. Do not upload content that infringes
            a third party&apos;s intellectual property rights.
          </p>
        </ProseSection>

        <ProseSection title="Acceptable Use.">
          <p>You agree not to use the ArtisTrust platform to:</p>
          <ul>
            <li>Upload content that is illegal, abusive, or infringes third-party rights.</li>
            <li>Attempt to gain unauthorised access to other users&apos; data, our systems, or reverse engineer our platform.</li>
            <li>Use our service to build a competitive product, distribute malware, or train your own machine learning models.</li>
            <li>Resell or sublicence access to the service without written permission.</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms without prior notice.
          </p>
        </ProseSection>

        <ProseSection title="Plans, Billing, and Subscriptions.">
          <p>
            ArtisTrust offers a free <strong>Preserve</strong> plan (25 uploads/month) and paid plans
            (Studio and Archive) with higher monthly upload limits. Paid plans are billed monthly or annually
            via Stripe and renew automatically at the end of each billing period.
          </p>
          <ul>
            <li><strong>Overage charges</strong> — if you exceed your plan&apos;s monthly upload limit, additional uploads cost $0.05 each (minimum charge $0.50), charged to your saved payment method. You will be shown the total before confirming.</li>
            <li><strong>Cancellations and Refunds</strong> — you can cancel at any time from your billing settings. Access continues until the end of the paid period. We do not offer refunds for partial subscription periods or overage charges that have already been processed.</li>
            <li><strong>Price changes</strong> — we will give at least 30 days&apos; notice of any price increase by email. Continued use after that date constitutes acceptance.</li>
          </ul>
        </ProseSection>

        <ProseSection title="Availability and Data Safety.">
          <p>
            We built ArtisTrust as infrastructure for your creative legacy. We aim for high
            availability but do not guarantee uninterrupted access. We maintain regular
            backups but strongly recommend exporting your archive periodically as a personal
            backup.
          </p>
          <p>
            <strong>Data Portability:</strong> You may export a full backup of your catalogue, including AI-generated metadata
            and voice memos, at any time.
          </p>
          <p>
            <strong>Advance Notice Guarantee:</strong> In the event of a significant platform change, pivot, or shutdown, ArtisTrust
            guarantees a minimum of 12 months&apos; advance written notice, allowing you ample
            time to export your archive safely.
          </p>
        </ProseSection>

        <ProseSection title="Disclaimers and Liability.">
          <p>
            Your use of ArtisTrust is at your sole risk. The service is provided on an &quot;as
            is&quot; and &quot;as available&quot; basis. While we strive for permanence and reliability, we
            do not warrant that the service will be entirely uninterrupted, entirely
            error-free, or completely secure. We specifically disclaim any implied warranties of
            merchantability or fitness for a particular purpose.
          </p>
          <p>
            To the maximum extent permitted by law, Wibbly Works Inc. shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages
            resulting from your use of or inability to use the platform, unauthorized access to your
            data, or the loss of your data. Our total liability to you for any claim
            arising from use of the service is limited to the amount you paid us in the 12 months
            preceding the claim. Nothing in these terms limits liability for fraud, death,
            or personal injury caused by negligence.
          </p>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            the State of New York, without regard to its conflict of law provisions. Any legal
            action or proceeding arising under these Terms will be brought exclusively in
            the federal or state courts located in New York.
          </p>
        </ProseSection>

        <ProseSection title="Contact.">
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p>
            Wibbly Works Inc.<br />
            8, The Green<br />
            Dover DE 19901<br />
            USA
          </p>
          <p>
            Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-dim)' }}>{CONTACT_EMAIL}</a>
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
