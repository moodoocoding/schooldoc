import { useEffect, useState } from "react";
import { loadRoleRecords, type RoleRecord } from "./roleApi";
export function useRoleRecords(start: string, end: string, revision = 0) {
  const [records, setRecords] = useState<RoleRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    setRecords([]);
    setLoading(true);
    setError("");
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await loadRoleRecords(start, end);
        if (!cancelled) {
          setRecords(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [start, end, revision, retry]);
  return { records, error, loading, refresh: () => setRetry((n) => n + 1) };
}
