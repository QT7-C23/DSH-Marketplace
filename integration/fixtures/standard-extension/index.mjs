export default {
  activate(context) {
    context.extensions.publish({ apiVersion: 'commands.dsh/v1alpha1', kind: 'Command' }, 'hello', {
      execute: ({ rawInput }) => ({ kind: 'success', text: `Standard command: ${rawInput.trim()}` }),
    });
  },
};
