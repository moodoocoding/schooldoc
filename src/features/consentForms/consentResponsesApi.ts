import { invokeConsentAdmin } from './consentAdminApi';
import type { ConsentResponseRecord } from './types';
export const getConsentResponse = async(formId:string,responseId:string) => (await invokeConsentAdmin<{response:ConsentResponseRecord}>({action:'detail',formId,responseId})).response;
export const listConsentResponseHistory = async(formId:string,recipientId:string,cursor:unknown=null) => invokeConsentAdmin<{responses:ConsentResponseRecord[];nextCursor:unknown}>({action:'history',formId,recipientId,cursor});
/** 최신 결과를 60건씩 읽고 모든 페이지에서 같은 갱신 버전을 확인한다. */
export const listConsentResponses = async(formId:string) => {
  const responses:ConsentResponseRecord[]=[];let cursor:unknown=null;let version:string|undefined;
  do {
    const page=await invokeConsentAdmin<{responses:ConsentResponseRecord[];nextCursor:unknown;version:string}>({action:'responses',formId,cursor,version});
    responses.push(...page.responses);cursor=page.nextCursor;version=page.version;
  }while(cursor);
  return responses;
};

export const listConsentResponseHeaders=async(formId:string,cursor:unknown)=>invokeConsentAdmin<{responses:ConsentResponseRecord[];nextCursor:unknown}>({action:'headers',formId,cursor});
