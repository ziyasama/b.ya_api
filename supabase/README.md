# Supabase

## Apply the schema (recommended: SQL Editor)

`supabase db push` only works after the CLI is **linked** to a project. You do not need the CLI for the first migration.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **SQL Editor** → New query
3. Paste the full contents of [`migrations/0001_bosphorus_state_logs.sql`](migrations/0001_bosphorus_state_logs.sql)
4. Run
5. **Database → Publications**: confirm `bosphorus_state_logs` is in `supabase_realtime`

## Why `supabase db push` failed

The CLI wants the **project ref** (the subdomain), not the URL and not an API key.

From `https://abcdefghijklmnop.supabase.co` the ref is `abcdefghijklmnop`.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

`link` also asks for the database password (Project Settings → Database → Database password), which is **not** the `service_role` JWT.

## Keys

| Env var | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser, server, worker (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server reads (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker writes only — never a `"use client"` file |

