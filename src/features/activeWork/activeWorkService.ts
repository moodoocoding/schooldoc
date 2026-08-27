import { isActiveWorkDemoMode, loadActiveWorkSnapshot } from './activeWorkProviders';
import { loadRemoteActiveWorkSnapshot } from './activeWorkRepository';
import type { ActiveWorkLoadContext, ActiveWorkSnapshot } from './types';

interface ActiveWorkPorts {
  demoMode: boolean;
  loadRemote: (now: Date) => Promise<ActiveWorkSnapshot>;
  loadLegacy: (context: ActiveWorkLoadContext) => Promise<ActiveWorkSnapshot>;
}

const defaultPorts: ActiveWorkPorts = {
  demoMode: isActiveWorkDemoMode,
  loadRemote: loadRemoteActiveWorkSnapshot,
  loadLegacy: loadActiveWorkSnapshot,
};

const EMPTY_SNAPSHOT: ActiveWorkSnapshot = { groups: [], failures: [] };

/**
 * 운영에서는 요약 RPC 한 번만 호출한다. 마이그레이션과 프런트 배포 사이 또는 일시적인
 * RPC 장애에는 기존 공급자 경로로 돌아가므로 진행 업무 자체가 사라지지는 않는다.
 */
export const loadActiveWork = async (
  context: ActiveWorkLoadContext,
  ports: ActiveWorkPorts = defaultPorts,
) => {
  if (!context.userId && !ports.demoMode) return EMPTY_SNAPSHOT;
  if (ports.demoMode) return ports.loadLegacy(context);
  try {
    return await ports.loadRemote(context.now);
  } catch {
    return ports.loadLegacy(context);
  }
};
