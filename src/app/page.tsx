export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      {/* Nav */}
      <header className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold text-brand">DonorMatch</span>
          <div className="flex items-center gap-3">
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
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-brand/20 bg-brand-light px-4 py-1.5 text-sm font-medium text-brand dark:text-brand-dark">
            Donor discovery for nonprofits
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
            Find donors who{" "}
            <span className="text-brand">share your mission</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            DonorMatch uses AI to connect your NGO with foundations, individuals, and organizations
            that align with your cause. Swipe, match, and build lasting donor relationships.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-xl sm:w-auto"
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
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light dark:bg-brand-light">
                  <svg className="h-7 w-7 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
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

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-2xl rounded-2xl bg-brand px-8 py-14 text-center shadow-2xl shadow-brand/20">
          <h2 className="text-3xl font-bold text-white">
            Ready to find your ideal donors?
          </h2>
          <p className="mt-3 text-indigo-100">
            Join hundreds of NGOs using DonorMatch to build donor relationships.
          </p>
          <a
            href="/signup"
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-white px-8 text-base font-semibold text-brand transition-colors hover:bg-indigo-50"
          >
            Get Started Free
          </a>
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
          </div>
        </div>
      </footer>
    </div>
  );
}
