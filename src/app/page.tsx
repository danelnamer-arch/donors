export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      {/* Nav */}
      <header className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2 text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">D</span>
            <span className="text-zinc-900 dark:text-zinc-100">Donor<span className="text-brand">Match</span></span>
          </span>
          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Pricing
            </a>
            <a
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
        {/* Gradient mesh */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
          <div className="absolute -bottom-24 right-1/4 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-400/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex animate-fade-in items-center rounded-full border border-brand/20 bg-brand-light px-4 py-1.5 text-sm font-medium text-brand dark:text-brand-dark">
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI-powered donor discovery for nonprofits
          </div>
          <h1 className="animate-fade-in text-5xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-white [animation-delay:100ms]">
            Find donors who{" "}
            <span className="bg-gradient-to-r from-brand to-indigo-400 bg-clip-text text-transparent">share your mission</span>
          </h1>
          <p className="mt-6 animate-fade-in text-lg leading-8 text-zinc-600 dark:text-zinc-400 [animation-delay:200ms]">
            DonorMatch uses AI to connect your NGO with foundations, individuals, and organizations
            that align with your cause. Swipe, match, and build lasting donor relationships.
          </p>
          <div className="mt-10 flex animate-fade-in flex-col items-center gap-4 sm:flex-row sm:justify-center [animation-delay:300ms]">
            <a
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-xl hover:-translate-y-0.5 sm:w-auto"
            >
              Start Free
            </a>
            <a
              href="#how-it-works"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-zinc-200 px-8 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-24 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-zinc-900 dark:text-white">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-500">
            Three simple steps to find and manage your ideal donors
          </p>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Tell us about your NGO",
                desc: "Share your mission, causes, and geographic focus. Our AI builds a profile of your ideal donor.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                ),
              },
              {
                step: "2",
                title: "Swipe through matches",
                desc: "Review AI-curated donor profiles. Swipe right on promising matches, left to pass.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                ),
              },
              {
                step: "3",
                title: "Manage your pipeline",
                desc: "Track donors from discovery to funded. Get enriched research and manage outreach.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                ),
              },
            ].map((item) => (
              <div key={item.step} className="group text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light transition-transform group-hover:scale-110 dark:bg-brand-light">
                  <svg className="h-7 w-7 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand">Step {item.step}</div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-zinc-100 px-6 py-24 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-zinc-900 dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-500">
            Start free. Upgrade when you need more matches and research.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "$0",
                period: "",
                features: [
                  "5 donor matches total",
                  "3 matches per day",
                  "Basic donor info",
                  "Pipeline board",
                ],
                limitations: ["No enrichment", "Limited matches"],
                popular: false,
              },
              {
                name: "Starter",
                price: "$29",
                period: "/mo",
                features: [
                  "Unlimited donor matches",
                  "5 enrichments/month",
                  "Deep donor research",
                  "Pipeline board",
                  "Priority support",
                ],
                limitations: [],
                popular: false,
              },
              {
                name: "Pro",
                price: "$79",
                period: "/mo",
                features: [
                  "Unlimited donor matches",
                  "20 enrichments/month",
                  "Deep donor research",
                  "Pipeline board",
                  "Priority support",
                  "Export data",
                ],
                limitations: [],
                popular: true,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-white p-8 dark:bg-zinc-950 ${
                  plan.popular
                    ? "border-2 border-brand shadow-lg shadow-brand/10 dark:shadow-brand/5"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-100">{plan.price}</span>
                  {plan.period && <span className="text-sm text-zinc-500">{plan.period}</span>}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                  {plan.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2 text-sm text-zinc-400">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {limitation}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`mt-8 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    plan.popular
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {plan.price === "$0" ? "Get Started" : `Start ${plan.name}`}
                </a>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-zinc-400">
            Need more research credits? Additional enrichments at $3 each on any paid plan.
            <br />
            All payments processed securely by Paddle.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl bg-brand px-8 py-14 text-center shadow-2xl shadow-brand/20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold text-white">
              Ready to find your ideal donors?
            </h2>
            <p className="mt-3 text-indigo-100">
              Join hundreds of NGOs using DonorMatch to build donor relationships.
            </p>
            <a
              href="/signup"
              className="mt-8 inline-flex h-12 items-center rounded-xl bg-white px-8 text-base font-semibold text-brand transition-all hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 px-6 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-sm text-zinc-400">
            DonorMatch {new Date().getFullYear()}
          </span>
          <div className="flex gap-6 text-sm text-zinc-400">
            <a href="/terms" className="transition-colors hover:text-zinc-600">
              Terms
            </a>
            <a href="/privacy" className="transition-colors hover:text-zinc-600">
              Privacy
            </a>
            <a href="/refund" className="transition-colors hover:text-zinc-600">
              Refund Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
