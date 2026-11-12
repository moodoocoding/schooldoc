/** Parse JSON SSE data without assuming HTTP chunks align with UTF-8 characters or events. */
export async function* readJsonEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let data: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? `${decoder.decode()}\n\n` : decoder.decode(new Uint8Array(value), { stream: true });
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline).replace(/\r$/u, '');
        pending = pending.slice(newline + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /u, ''));
        if (!line && data.length) {
          const event = data.join('\n');
          data = [];
          if (event !== '[DONE]') yield JSON.parse(event) as unknown;
        }
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
