export const operationPhases = ['requested', 'backed-up', 'running', 'configuring', 'cancelling', 'cancelled', 'failed', 'restart-required', 'recovery-required'];
export const operationActions = ['install', 'remove', 'configure', 'cancel'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** @typedef {{operationId:string,action:string,name:string,phase:string,at:string}} OperationRow */
/** @typedef {{blocked:boolean,operationId:string|null,recent:OperationRow[]}} OperationStatus */
/** @returns {OperationStatus} */
export function operationStatus(value) {
  if (!value || typeof value.blocked !== 'boolean' || value.operationId !== null && !uuid.test(value.operationId)
    || !Array.isArray(value.recent) || value.recent.length > 20) throw Error('Invalid operation status');
  const recent = value.recent.map(row => {
    if (!row || !uuid.test(row.operationId) || !operationActions.includes(row.action) || !operationPhases.includes(row.phase)
      || typeof row.name !== 'string' || row.name.length > 214 || !row.name || typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) throw Error('Invalid operation history');
    return { operationId: row.operationId, action: row.action, name: row.name, phase: row.phase, at: row.at };
  });
  return { blocked: value.blocked, operationId: value.operationId, recent };
}
