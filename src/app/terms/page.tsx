import Link from "next/link";

export const metadata = {
  title: "Terms of Use - Funderra",
  description: "Terms and conditions for using Funderra",
};

export default function TermsOfUsePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </Link>

      <h1 className="text-3xl font-bold mb-8">Terms of Use</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Funderra (&quot;the Service&quot;), you agree to be bound by these
            Terms of Use. If you do not agree, do not use the Service. The Service is operated by
            Funderra (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Description of Service</h2>
          <p>
            Funderra is a donor discovery and relationship management platform designed for
            nonprofit organizations (NGOs). The Service helps organizations identify potential
            donors, foundations, and grant-makers based on organizational parameters, and manage
            donor relationships over time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. Account Registration</h2>
          <p>
            To use the Service, you must create an account and provide accurate, complete
            information about yourself and your organization. You are responsible for maintaining
            the confidentiality of your account credentials and for all activities under your
            account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Subscription and Billing</h2>
          <p>
            Funderra offers a freemium model with the following tiers:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Free:</strong> 5 initial donor matches plus up to 3 new matches per day. No enrichment features.</li>
            <li><strong>Starter:</strong> Unlimited matches plus 5 donor enrichments per month.</li>
            <li><strong>Pro:</strong> Unlimited matches plus 20 donor enrichments per month, plus CRM features.</li>
            <li><strong>Additional enrichments:</strong> Available for purchase on any paid plan.</li>
          </ul>
          <p className="mt-4">
            Billing is processed through Paddle, our authorized payment provider. By subscribing,
            you agree to Paddle&apos;s terms of service. Subscriptions auto-renew monthly unless
            cancelled. You may cancel at any time through your account settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Refund Policy</h2>
          <p>
            If you are not satisfied with the Service, you may request a refund within 14 days of
            your initial subscription payment. Refunds for renewal payments are available within 7
            days. Enrichment credits that have already been used are non-refundable. To request a
            refund, contact us at{" "}
            <a href="mailto:legal@funderra.app" className="text-blue-600 hover:underline">
              legal@funderra.app
            </a>. For full details, see our{" "}
            <a href="/refund" className="text-blue-600 hover:underline">
              Refund Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Scrape, copy, or redistribute donor data obtained through the Service</li>
            <li>Share your account credentials with unauthorized parties</li>
            <li>Attempt to reverse-engineer the matching algorithm</li>
            <li>Use the Service to harass, spam, or send unsolicited communications to donors</li>
            <li>Misrepresent your organization or its mission</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Data and Donor Information</h2>
          <p>
            Donor information provided through the Service is gathered from publicly available
            sources including government filings, foundation websites, and public databases. While
            we strive for accuracy, we do not guarantee the completeness or accuracy of donor data.
            Users should independently verify information before taking action.
          </p>
          <p className="mt-2">
            The Service uses AI-powered research tools to compile donor profiles. AI-generated
            content may occasionally contain inaccuracies. All data points are linked to their
            source where possible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">8. Intellectual Property</h2>
          <p>
            The Service, including its algorithms, design, and compiled databases, is the
            intellectual property of Funderra. Your subscription grants you a limited,
            non-exclusive, non-transferable license to use the Service for your organization&apos;s
            fundraising purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">9. Limitation of Liability</h2>
          <p>
            Funderra is provided &quot;as is&quot; without warranty of any kind. We are not responsible
            for the outcome of any fundraising efforts based on information provided through the
            Service. In no event shall Funderra be liable for any indirect, incidental, or
            consequential damages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account if you violate these Terms.
            Upon termination, your access to the Service will cease and your data may be deleted
            after a reasonable retention period.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes
            via email or through the Service. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">12. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:legal@funderra.app" className="text-blue-600 hover:underline">
              legal@funderra.app
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex gap-6 border-t border-zinc-100 pt-6 text-sm text-zinc-400">
        <a href="/terms" className="font-medium text-zinc-600">Terms</a>
        <a href="/privacy" className="transition-colors hover:text-zinc-600">Privacy</a>
        <a href="/refund" className="transition-colors hover:text-zinc-600">Refund Policy</a>
      </div>
    </main>
  );
}
