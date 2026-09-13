// Every currency column in this schema is BigInt (paisa). Node's JSON.stringify
// has no built-in support for BigInt and throws "Do not know how to serialize
// a BigInt" the moment one reaches a response body that wasn't manually
// converted first — which happened in practice (GET /residents/:id crashed
// with a 500 for any resident with a fee structure). Rather than requiring
// every service to remember to stringify every BigInt field by hand, teach
// JSON.stringify to do it globally, once, at process start.
//
// Imported for its side effect only — by app.module.ts, so it runs
// regardless of entry point (main.ts in production, or a TestingModule in
// e2e tests).
if (!(BigInt.prototype as unknown as { toJSON?: unknown }).toJSON) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value(this: bigint) {
      return this.toString();
    },
  });
}
