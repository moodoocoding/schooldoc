import { PlanError } from './core.ts';

type Consume = (key: string, windowSeconds: number, maxRequests: number) => PromiseLike<{ data: unknown; error: unknown }>;
export async function consumePlanQuota(userId: string, consume: Consume): Promise<boolean> {
  for (const [key, seconds, max] of [[`school-plan:minute:${userId}`, 60, 6], [`school-plan:day:${userId}`, 86400, 30], ['school-plan:global:day', 86400, 100]] as const) {
    let result;
    try { result = await consume(key, seconds, max); }
    catch { throw new PlanError(503, 'AI 사용량 제한을 확인하지 못해 작성을 중단했습니다. 잠시 후 다시 시도해 주세요.'); }
    if (result.error || typeof result.data !== 'boolean') throw new PlanError(503, 'AI 사용량 제한을 확인하지 못해 작성을 중단했습니다. 잠시 후 다시 시도해 주세요.');
    if (!result.data) return false;
  }
  return true;
}
