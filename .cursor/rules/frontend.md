# Frontend & UI Rules (Next.js & Tailwind CSS)

## Mobile-First & Layout
- The UI MUST be designed mobile-first. The dashboard will primarily be viewed on smartphones by the client.
- Use Tailwind CSS strictly. No custom CSS files unless absolutely necessary.
- Build a dark-mode oriented, sleek, "data-hub" aesthetic (cyan/gold accents, minimal borders).

## Real-time Data Visualization
- Use Supabase Realtime subscriptions to update the dashboard instantly when a new row is added to the database. No manual browser refreshing should be required.
- Keep visualization simple: use textual indicators, simple gauges, or trend arrows (e.g., "Wind: Increasing").

## Components
- Keep components small, modular, and in the `/components` directory. Use server components where possible, but use client components (`"use client"`) for the realtime dashboard view.

## Locked decisions
- `/dashboard` is the live view (`components/DashboardLive.tsx`). Aesthetic: dark cyan/gold, Tailwind only.