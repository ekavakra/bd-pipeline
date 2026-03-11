import Link from 'next/link';

/**
 * Landing / login redirect page.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          BD Pipeline
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          AI-Powered Client Onboarding & Business Development
        </p>
      </div>

      <Link
        href="/login"
        className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow hover:bg-brand-700 transition-colors"
      >
        Sign In
      </Link>
    </main>
  );
}
