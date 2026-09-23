export const name = 'market-native-test';
export const inject = ['connection'];
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/market-test/native', methods: ['GET'], requestBody: 'buffered', fetch: () => Response.json({ answer: 6 * 7, route: 'native' }) }));
}
