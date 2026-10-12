import { useState } from "react";
import type { ReactNode } from "react";

interface InfoTipProps {
  label: string;
  children: ReactNode;
}

function InfoTip({ label, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={label}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
          open ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        }`}
      >
        {label}
      </button>
      {/* invisible bridge over the gap so the pointer can travel into the panel */}
      {open && <div aria-hidden="true" className="absolute left-0 right-0 top-full h-1" />}
      <div
        role="tooltip"
        className={`absolute left-1/2 top-full z-50 mt-1 w-128 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-left shadow-xl shadow-black/40 transition-all ease-out ${
          open
            ? "translate-y-0 scale-100 opacity-100 delay-0 duration-200"
            : "pointer-events-none translate-y-1 scale-95 opacity-0 delay-150 duration-150"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const TITLE = "text-sm font-semibold text-zinc-200";
const BODY = "mt-2 text-[13px] leading-relaxed text-zinc-400";

export function HeaderInfo() {
  return (
    <>
      <InfoTip label="Legal">
        <p className={TITLE}>Legal notice</p>
        <div className={`${BODY} space-y-2.5`}>
          <p>SK-AI is provided &quot;as is&quot; without warranties of any kind, express or implied.</p>
          <p>
            To the fullest extent permitted by law, the application shall not be held liable for any
            data breach, unauthorized access, data loss, or other security incident arising from or
            related to your use of this service.
          </p>
          <p>
            You remain solely responsible for any information you submit through this application.
          </p>
        </div>
      </InfoTip>

      <InfoTip label="Privacy Policy">
        <p className={TITLE}>Privacy Policy</p>
        <ul className={`${BODY} space-y-2.5`}>
          <li>
            <span className="font-medium text-zinc-300">Anonymous usage:</span> no account or
            personal details are collected; a random identifier stored in your browser links you to
            your data.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Data we store:</span> conversations,
            uploaded files, and daily usage counters (Cloudflare D1). Deleting a conversation
            permanently removes its messages and files.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Data processing:</span> your messages and
            attached files are transmitted to APInex and OpenRouter solely to generate AI
            responses; their respective privacy policies govern that processing.
          </li>
          <li>
            <span className="font-medium text-zinc-300">No selling:</span> your data is never sold,
            rented, or shared with third parties beyond the model providers named above.
          </li>
        </ul>
      </InfoTip>

      <InfoTip label="Features">
        <p className={TITLE}>Features</p>
        <ul className={`${BODY} space-y-2.5`}>
          <li>
            <span className="font-medium text-zinc-300">Free text chat:</span> pick any free model —
            APInex&apos;s (25 messages per day, up to 5 per minute) or OpenRouter&apos;s (5
            requests/day, shared with file tasks). Responses stream live with markdown formatting.
          </li>
          <li>
            <span className="font-medium text-zinc-300">File Q&amp;A:</span> ask about images, PDFs,
            and text/code files (up to 5 MB) — answered by OpenRouter&apos;s free multimodal models
            within the same 5 requests/day.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Smart failover:</span> free models go down
            often — SK-AI retries and automatically switches to another free model, and tells you
            which one answered (shown under every reply).
          </li>
          <li>
            <span className="font-medium text-zinc-300">Notifications:</span> quota updates, model
            switches, and limit alerts appear as a brief toast and are saved under the bell icon.
          </li>
          <li>
            <span className="font-medium text-zinc-300">History &amp; search:</span> conversations
            are saved automatically and fully searchable from the sidebar.
          </li>
          <li>
            <span className="font-medium text-zinc-300">Everywhere:</span> responsive layout with a
            mobile sidebar — no sign-up required.
          </li>
        </ul>
      </InfoTip>
    </>
  );
}
