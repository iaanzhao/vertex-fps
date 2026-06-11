export function createNetClient(url) {
  let ws = null;
  let open = false;
  const listeners = new Map();

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  }

  function emit(type, data) {
    listeners.get(type)?.forEach((fn) => fn(data));
    listeners.get('*')?.forEach((fn) => fn(type, data));
  }

  function connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      try {
        ws = new WebSocket(url);
      } catch (err) {
        fail(err);
        return;
      }

      ws.onopen = () => {
        open = true;
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      ws.onerror = () => fail(new Error('Could not connect to server'));
      ws.onclose = () => {
        open = false;
        emit('close');
        if (!settled) fail(new Error('Connection closed'));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          emit(msg.type, msg);
        } catch {
          /* ignore */
        }
      };
    });
  }

  function connectAndJoin(handshake) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        offWelcome();
        offError();
        fn(value);
      };

      const offWelcome = on('welcome', (msg) => {
        finish(resolve, { client: api, msg });
      });
      const offError = on('error', (msg) => {
        close();
        finish(reject, new Error(msg.message || 'Join failed'));
      });

      connect()
        .then(() => send(handshake))
        .catch((err) => finish(reject, err));
    });
  }

  function send(msg) {
    if (open && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function close() {
    ws?.close();
    ws = null;
    open = false;
  }

  const api = { connect, connectAndJoin, send, close, on, get connected() { return open; } };
  return api;
}
