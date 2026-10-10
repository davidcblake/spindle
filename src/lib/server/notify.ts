import "server-only";

/**
 * Push alerts to Dave's phone through ntfy (ntfy.sh), decision 0006: errors,
 * the Anthropic credit running out, a new iPhone, and feedback.
 *
 * ntfy needs no account. The topic name is the only thing that lets someone
 * read the alerts, so it is long, random and kept in Vercel as NTFY_TOPIC.
 * Without it, alerts are skipped and nothing else changes.
 *
 * An alert must never break the request that raised it, so this never
 * throws and gives up after three seconds.
 */
export type Alert = {
  title: string;
  message: string;
  /** ntfy's 1–5. 4 and 5 buzz even when the phone is set to quiet. */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** ntfy shows these as emoji: "warning", "tada", "speech_balloon"… */
  tags?: string[];
};

export async function notify(
  alert: Alert,
  env: Record<string, string | undefined> = process.env,
  send: typeof fetch = fetch,
): Promise<void> {
  const topic = env.NTFY_TOPIC?.trim();
  if (!topic) return;
  try {
    await send(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      body: alert.message.slice(0, 3000),
      headers: {
        // HTTP headers must be plain ASCII; ntfy reads RFC 2047 for the rest.
        Title: `=?UTF-8?B?${Buffer.from(alert.title.slice(0, 200)).toString("base64")}?=`,
        Priority: String(alert.priority ?? 3),
        ...(alert.tags?.length ? { Tags: alert.tags.join(",") } : {}),
      },
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.warn("alert not sent", e instanceof Error ? e.message : e);
  }
}
