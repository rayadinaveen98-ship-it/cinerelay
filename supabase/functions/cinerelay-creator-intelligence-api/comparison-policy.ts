/** C6 YouTube developer policy gate. Explicit approval + reference required.
 * Approval must be independently reviewed; this code does not grant permission.
 * Default false even in production. Never use a client-controlled flag.
 */
export function creatorComparisonApproved(
  enabled:string|undefined,
  approvalReference:string|undefined,
):boolean{
  if(enabled!=='true')return false;
  const ref=(approvalReference??'').trim();
  return ref.length>=12 && ref.length<=128 && /^[A-Za-z0-9][A-Za-z0-9_./:-]*$/.test(ref)
    && !/^(pending|todo|test|example|unapproved|none)$/i.test(ref);
}
