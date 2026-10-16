/** Cloudflare Workers의 HTMLRewriter(.on · .onDocument · .transform(Response))를 같은 엔진(lol-html wasm)으로 제공한다. */
import pkg from 'html-rewriter-wasm';

const { HTMLRewriter: RawRewriter } = pkg;

export class HTMLRewriter {
  constructor() {
    this.handlers = [];
  }
  on(selector, handlers) {
    this.handlers.push(['on', selector, handlers]);
    return this;
  }
  onDocument(handlers) {
    this.handlers.push(['onDocument', handlers]);
    return this;
  }
  transform(response) {
    const run = async () => {
      const input = new Uint8Array(await response.arrayBuffer());
      const chunks = [];
      const rw = new RawRewriter((c) => chunks.push(c.slice()));
      try {
        for (const [kind, a, b] of this.handlers) kind === 'on' ? rw.on(a, b) : rw.onDocument(a);
        await rw.write(input);
        await rw.end();
      } finally {
        rw.free();
      }
      return Buffer.concat(chunks);
    };
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    const body = new ReadableStream({
      async start(ctrl) {
        try {
          ctrl.enqueue(new Uint8Array(await run()));
          ctrl.close();
        } catch (e) {
          ctrl.error(e);
        }
      },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }
}
