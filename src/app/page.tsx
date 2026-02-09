export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-12 py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-black dark:text-zinc-50">
            DonorMatch
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Find the right donors for your NGO. Swipe, match, and build
            lasting relationships with foundations, individuals, and
            organizations that share your mission.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-8 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            href="/signup"
          >
            Get Started Free
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-8 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            href="/login"
          >
            Sign In
          </a>
        </div>

        <div className="flex gap-6 text-sm text-zinc-400">
          <a href="/terms" className="hover:text-zinc-600 transition-colors">
            Terms of Use
          </a>
          <a href="/privacy" className="hover:text-zinc-600 transition-colors">
            Privacy Policy
          </a>
        </div>
      </main>
    </div>
  );
}
