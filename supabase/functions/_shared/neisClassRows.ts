/** Read complete row objects out of the model's streamed {"rows":[...]} result. */
export function createClassRowReader() {
  let prefix = '';
  let started = false;
  let ended = false;
  let row = '';
  let depth = 0;
  let quoted = false;
  let escaped = false;

  return {
    push(chunk: string) {
      const rows: unknown[] = [];
      if (!started) {
        prefix += chunk;
        const match = /^\s*\{\s*"rows"\s*:\s*\[/u.exec(prefix);
        if (!match) {
          if (prefix.length > 1024) throw new Error('학급 평어 응답 형식을 확인하지 못했습니다.');
          return rows;
        }
        started = true;
        chunk = prefix.slice(match[0].length);
        prefix = '';
      }
      for (const char of chunk) {
        if (ended) break;
        if (!depth) {
          if (char === ']') ended = true;
          if (char !== '{') continue;
        }
        row += char;
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === '{') depth++;
        else if (char === '}' && --depth === 0) {
          rows.push(JSON.parse(row));
          row = '';
        }
      }
      return rows;
    },
    get ended() { return ended; },
  };
}
