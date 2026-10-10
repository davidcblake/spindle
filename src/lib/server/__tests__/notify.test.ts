import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { notify } from "@/lib/server/notify";

describe("notify", () => {
  it("does nothing without a topic", async () => {
    const send = vi.fn();
    await notify({ title: "t", message: "m" }, {}, send);
    expect(send).not.toHaveBeenCalled();
  });

  it("posts the message to the topic with its title and priority", async () => {
    const send = vi.fn().mockResolvedValue(new Response());
    await notify(
      { title: "New iPhone — Spindle", message: "hello", priority: 4, tags: ["tada"] },
      { NTFY_TOPIC: "spindle-abc" },
      send,
    );
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/spindle-abc");
    expect(init.body).toBe("hello");
    expect(init.headers.Priority).toBe("4");
    expect(init.headers.Tags).toBe("tada");
    const encoded = init.headers.Title.slice("=?UTF-8?B?".length, -"?=".length);
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe("New iPhone — Spindle");
  });

  it("never throws, even when ntfy is unreachable", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(notify({ title: "t", message: "m" }, { NTFY_TOPIC: "x" }, send)).resolves.toBeUndefined();
  });
});
