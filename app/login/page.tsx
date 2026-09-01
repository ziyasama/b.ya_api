export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/dashboard";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.35em] text-cyan uppercase">
        Restricted
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Panel access</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-muted">
        Enter the dashboard password to view live Bosphorus state.
      </p>
      <form
        action="/api/auth/login"
        method="post"
        className="mt-8 w-full max-w-xs space-y-4"
      >
        <input type="hidden" name="next" value={nextPath} />
        <label className="block text-xs uppercase tracking-widest text-muted">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground outline-none focus:border-cyan"
          />
        </label>
        {params.error ? (
          <p className="text-sm text-gold">Incorrect password.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-full border border-cyan/40 bg-panel py-2.5 text-sm font-medium text-cyan transition hover:border-gold hover:text-gold"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
