import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      {/* Hero — full-width background image */}
      <section className="relative min-h-[75vh] overflow-hidden">
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt="Israeli flag waving over golden wheat fields at sunset"
          fill
          className="object-cover object-center"
          priority
        />

        {/* Gradient overlays — lighter to let the landscape breathe */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Nav — on top of image */}
        <header className="relative z-10">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <span className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">F</span>
              <span className="text-white">Fund<span className="text-brand">erra</span></span>
            </span>
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
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

        {/* Hero content — positioned over image */}
        <div className="relative z-10 flex min-h-[calc(75vh-4rem)] items-center px-6 pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex animate-fade-in items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Built by Israelis, for Israelis
              </div>
              <h1 className="animate-fade-in text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl [animation-delay:100ms]">
                Find the right donors for{" "}
                <span className="text-amber-300">
                  your nonprofit
                </span>
              </h1>
              <p className="mt-6 max-w-xl animate-fade-in text-lg leading-8 text-white/80 [animation-delay:200ms]">
                AI-powered donor intelligence that maps 5,000+ foundations
                and philanthropists across Israel and worldwide.
              </p>
              <div className="mt-10 flex animate-fade-in flex-col gap-4 sm:flex-row [animation-delay:300ms]">
                <a
                  href="/signup"
                  className="flex h-12 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-xl hover:-translate-y-0.5"
                >
                  Start Free
                </a>
                <a
                  href="#how-it-works"
                  className="flex h-12 items-center justify-center rounded-xl border border-white/40 bg-white/10 px-8 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  See How It Works
                </a>
              </div>

              {/* Stats row */}
              <div className="mt-10 flex animate-fade-in gap-8 [animation-delay:400ms]">
                <div>
                  <p className="text-2xl font-bold text-white">5,000+</p>
                  <p className="text-sm text-white/60">donors mapped</p>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div>
                  <p className="text-2xl font-bold text-white">AI</p>
                  <p className="text-sm text-white/60">powered matching</p>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div>
                  <p className="text-2xl font-bold text-white">Free</p>
                  <p className="text-sm text-white/60">to start</p>
                </div>
              </div>
            </div>
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
            Three steps to discover and manage your ideal donors
          </p>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Describe your organization",
                desc: "Add your website or registration number. Our AI builds your profile in seconds.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                ),
              },
              {
                step: "2",
                title: "Get matched with donors",
                desc: "We surface foundations and individuals aligned with your mission \u2014 ranked by fit.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                ),
              },
              {
                step: "3",
                title: "Manage your pipeline",
                desc: "Track every prospect from first discovery to funded grant.",
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

      {/* Testimonials */}
      <section className="border-t border-zinc-100 px-6 py-24 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-zinc-900 dark:text-white">
            Trusted by nonprofits across Israel
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-500">
            Hear from organizations already using Funderra
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                quote: "We used to spend weeks researching potential funders. Funderra surfaced 30 relevant foundations in our first hour.",
                name: "Noa R.",
                role: "Development Director",
                org: "Youth education nonprofit, Tel Aviv",
              },
              {
                quote: "The donor profiles are incredibly detailed. We walked into meetings actually knowing who we were talking to.",
                name: "Michael K.",
                role: "Executive Director",
                org: "Environmental NGO, Haifa",
              },
              {
                quote: "Funderra replaced three different spreadsheets and a part-time researcher. It paid for itself in the first month.",
                name: "Yael S.",
                role: "Grants Manager",
                org: "Social services organization, Jerusalem",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="relative rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {/* Quote mark */}
                <svg className="mb-4 h-8 w-8 text-brand/20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609L9.978 5.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H0z" />
                </svg>
                <p className="text-sm leading-relaxed text-zinc-600 italic dark:text-zinc-400">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                  <p className="text-xs text-zinc-400">{t.org}</p>
                </div>
              </div>
            ))}
          </div>
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
              Start discovering donors today
            </h2>
            <p className="mt-3 text-indigo-100">
              Join nonprofits already using Funderra to connect with the right funders.
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
            Funderra {new Date().getFullYear()}
          </span>
          <div className="flex gap-6 text-sm text-zinc-400">
            <a href="/billing" className="transition-colors hover:text-zinc-600">
              Pricing
            </a>
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
