import Link from "next/link";
import { getPatchFiles } from "@/lib/radio/patch";

export const dynamic = "force-dynamic";

const FILE_NOTES: Record<string, string> = {
  "boot.scd": "Language boot — opens UDP 57121 and loads the hot-reload slot.",
  "live.scd": "Hot-reloadable slot — replace this file, then send /bosphorus/patch/reload.",
  "placeholder.scd": "Default patch loaded by live.scd until a composed patch replaces it.",
};

export default async function RadioPatchPage() {
  const files = await getPatchFiles();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">
            Bosphorus
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            SuperCollider patch
          </h1>
          <p className="mt-1 text-xs text-muted">
            Radio container sources in{" "}
            <span className="font-mono text-foreground/80">radio/patch/</span>.
            Edit locally, then reload via OSC or restart the container.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-border px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="flex flex-col gap-4">
        {files.map((file) => (
          <section
            key={file.path}
            className="overflow-hidden rounded-xl border border-border bg-panel"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-cyan">
                {file.path}
              </p>
              {FILE_NOTES[file.name] ? (
                <p className="mt-1 text-xs text-muted">{FILE_NOTES[file.name]}</p>
              ) : null}
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90">
              <code>{file.content}</code>
            </pre>
          </section>
        ))}
      </div>
    </div>
  );
}
