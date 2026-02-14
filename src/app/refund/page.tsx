export const metadata = {
  title: "Refund Policy - Funderra",
  description: "Funderra refund and cancellation policy",
};

export default function RefundPolicyPage() {
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

      <h1 className="text-3xl font-bold mb-8">Refund Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Overview</h2>
          <p>
            Funderra (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) wants you to be satisfied
            with our service. If you are not happy with your subscription, we offer refunds under the
            conditions described below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Subscription Refunds</h2>

          <h3 className="text-lg font-medium mt-4 mb-2">Initial Subscription</h3>
          <p>
            If you are not satisfied with the Service, you may request a full refund within{" "}
            <strong>14 days</strong> of your initial subscription payment. No questions asked.
          </p>

          <h3 className="text-lg font-medium mt-4 mb-2">Renewal Payments</h3>
          <p>
            For recurring subscription renewals, you may request a refund within{" "}
            <strong>7 days</strong> of the renewal charge date.
          </p>

          <h3 className="text-lg font-medium mt-4 mb-2">After the Refund Window</h3>
          <p>
            Refund requests made after the applicable window (14 days for initial, 7 days for
            renewals) will be reviewed on a case-by-case basis at our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. Enrichment Credits</h2>
          <p>
            Enrichment credits (deep donor research) that have already been{" "}
            <strong>used are non-refundable</strong>. Unused enrichment credits included in your
            subscription will be refunded as part of a subscription refund. Separately purchased
            enrichment credits ($3 each) are refundable only if unused.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. How to Request a Refund</h2>
          <p>
            To request a refund, contact us at{" "}
            <a href="mailto:legal@funderra.app" className="text-blue-600 hover:underline">
              legal@funderra.app
            </a>{" "}
            with:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Your account email address</li>
            <li>The date of the charge</li>
            <li>The reason for the refund request (optional but helpful)</li>
          </ul>
          <p className="mt-4">
            We aim to process all refund requests within <strong>5 business days</strong>. Refunds
            are issued to the original payment method.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Cancellation</h2>
          <p>
            You may cancel your subscription at any time through your account settings. When you
            cancel:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Your subscription remains active until the end of the current billing period</li>
            <li>You will not be charged for the next billing period</li>
            <li>Your account reverts to the Free tier after the paid period ends</li>
            <li>Your pipeline data and match history are preserved</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Payment Processing</h2>
          <p>
            All payments and refunds are processed by <strong>Paddle</strong>, our authorized
            Merchant of Record. Paddle handles all billing, tax collection, and refund disbursement
            on our behalf. Refunds will appear on your statement from Paddle.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Contact</h2>
          <p>
            For billing questions or refund requests, contact us at{" "}
            <a href="mailto:legal@funderra.app" className="text-blue-600 hover:underline">
              legal@funderra.app
            </a>.
          </p>
          <p>
            For general support, reach us at{" "}
            <a href="mailto:support@funderra.app" className="text-blue-600 hover:underline">
              support@funderra.app
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex gap-6 border-t border-zinc-100 pt-6 text-sm text-zinc-400">
        <a href="/terms" className="transition-colors hover:text-zinc-600">Terms</a>
        <a href="/privacy" className="transition-colors hover:text-zinc-600">Privacy</a>
        <a href="/refund" className="font-medium text-zinc-600">Refund Policy</a>
      </div>
    </main>
  );
}
