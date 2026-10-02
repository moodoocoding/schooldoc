import { invokeConsentAdmin, isConsentAdminUnavailable } from './consentAdminApi';
import type { ConsentRecipientRecord } from './types';

export const finalizeConsentForm = async(formId:string,recipients:Array<{id?:string;name:string;studentKey:string}>,password='') => invokeConsentAdmin({action:'finalize',formId,recipients,password});
export const listConsentRecipientsPage = async(formId:string,cursor:unknown=null) => invokeConsentAdmin<{recipients:ConsentRecipientRecord[];nextCursor:unknown}>({action:'list',formId,cursor});
export const listConsentRecipients=async(formId:string) => {
 const rows:ConsentRecipientRecord[]=[];let cursor:unknown=null;
 do{const page=await listConsentRecipientsPage(formId,cursor);rows.push(...page.recipients);cursor=page.nextCursor;}while(cursor);
 return rows;
};
export const isRecipientsUnavailable=isConsentAdminUnavailable;
