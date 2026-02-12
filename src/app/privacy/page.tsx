export const metadata = {
  title: "Privacy Policy - DonorMatch",
  description: "How DonorMatch handles your data",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <a
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </a>

      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
          <p>
            DonorMatch (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, and safeguard your information when you
            use our donor discovery and relationship management platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Information We Collect</h2>

          <h3 className="text-lg font-medium mt-4 mb-2">Account Information</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Name and email address</li>
            <li>Organization name, mission, and profile details</li>
            <li>Payment information (processed by Paddle; we do not store card details)</li>
          </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Usage Data</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Swipe actions (right/left) on donor recommendations</li>
            <li>Donor pipeline activity (stages, notes, interactions)</li>
            <li>Search queries and filter preferences</li>
            <li>Feature usage patterns</li>
          </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Donor Data</h3>
          <p>
            We compile donor profiles from publicly available sources including government filings
            (IRS 990), foundation websites, news articles, and public databases. This data is not
            user-submitted personal data — it is publicly available philanthropic information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Matching:</strong> Your organization profile is used to match you with relevant donors</li>
            <li><strong>Improvement:</strong> Your swipe actions and feedback improve our matching algorithm for all users</li>
            <li><strong>Service delivery:</strong> Account management, billing, support</li>
            <li><strong>Communication:</strong> Service updates, feature announcements (you can opt out)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Sharing</h2>
          <p>We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Paddle:</strong> Payment processing</li>
            <li><strong>OpenAI:</strong> AI-powered matching and research (organization data is sent for processing)</li>
            <li><strong>Tavily, Perplexity, Firecrawl:</strong> Web research services (search queries only, no user data)</li>
            <li><strong>Hosting providers:</strong> Infrastructure (Vercel, database hosting)</li>
          </ul>
          <p className="mt-2">
            We may disclose information if required by law or to protect our rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including encryption in transit
            (HTTPS), encrypted database connections, and access controls. However, no system is
            100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Retention</h2>
          <p>
            We retain your account data for the duration of your subscription plus 90 days after
            cancellation. Anonymized usage data (swipe patterns, matching feedback) may be retained
            indefinitely to improve the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Export your data (pipeline, notes, activity)</li>
            <li>Opt out of non-essential communications</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@donormatch.com" className="text-blue-600 hover:underline">
              privacy@donormatch.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">8. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use
            third-party tracking cookies. Analytics, if implemented, will use privacy-respecting
            tools.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">9. International Data Transfers</h2>
          <p>
            Your data may be processed in the United States and other countries where our service
            providers operate. We ensure appropriate safeguards are in place for international
            data transfers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes via email or through the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact</h2>
          <p>
            For privacy-related questions, contact us at{" "}
            <a href="mailto:privacy@donormatch.com" className="text-blue-600 hover:underline">
              privacy@donormatch.com
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex gap-6 border-t border-zinc-100 pt-6 text-sm text-zinc-400">
        <a href="/terms" className="transition-colors hover:text-zinc-600">Terms</a>
        <a href="/privacy" className="font-medium text-zinc-600">Privacy</a>
        <a href="/refund" className="transition-colors hover:text-zinc-600">Refund Policy</a>
      </div>
    </main>
  );
}
