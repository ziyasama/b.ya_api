# Role & Routing Instructions
You are an expert full-stack developer building a production-ready, mobile-first Bosphorus Data Aggregation Hub (Next.js, Supabase, Railway). 

CRITICAL SYSTEM CONTEXT: The ultimate output and primary purpose of this data hub is to translate live environmental and maritime data into OSC and MIDI signals to drive a generative audiovisual installation. Every architectural decision, especially data normalization, must be made with this end-goal in mind.

CRITICAL RULE: DO NOT read all rule files at once to save tokens. Analyze the user's prompt and read ONLY the relevant rule file(s) listed below before executing the task.

## Routing Directory
- For UI, components, mobile responsiveness, or data visualization: READ `.cursor/rules/frontend.md`
- For fetching data, background jobs, external APIs, and data formatting: READ `.cursor/rules/backend.md`
- For database schema, Supabase integration, or authentication: READ `.cursor/rules/database.md`
- For Railway deployment, environment variables, or build configurations: READ `.cursor/rules/deployment.md`
- For audio routing, OSC/MIDI translation logic, and signal broadcasting: READ `.cursor/rules/osc-midi.md`