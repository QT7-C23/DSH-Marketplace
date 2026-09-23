/** @typedef {{current:()=>string|null|undefined,list:(sessionId:string)=>Promise<Array<{name:string}>>,execute:(sessionId:string,line:string)=>Promise<{kind:string,text?:string}>}} CommandPort */
/** An explicit market action targets the host command; the composer is never read or written. */
export async function executeResourceCommand(resource, argument, /** @type {CommandPort} */ port) {
  const command = resource.command || resource.title;
  if (resource.type !== 'Slash' || !resource.parentId || !/^\/[a-z][a-z0-9-]{0,63}$/.test(command) || typeof argument !== 'string' || argument.length > 4000 || argument.includes('\0')) throw Error('资源命令格式无效');
  const sessionId = port.current();
  if (!sessionId) throw Error('请先在 DSH 创建或选择会话，再从商店使用模板');
  const commands = await port.list(sessionId);
  if (port.current() !== sessionId) throw Error('会话已变化，请重新确认命令');
  if (!commands.some(item => item.name === command.slice(1))) throw Error('当前会话未提供此命令，请检查所属插件');
  const result = await port.execute(sessionId, command + (argument ? ' ' + argument : ''));
  if (!result || result.kind !== 'success') throw Error(result?.text || '命令执行失败');
  return result.text || '命令已执行';
}
