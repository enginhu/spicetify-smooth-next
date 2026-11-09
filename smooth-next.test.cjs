const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(`${__dirname}/smooth-next.js`, "utf8");

class Clock {
  now = 0;
  id = 0;
  jobs = new Map();
  add(fn, delay, interval = 0) {
    const id = ++this.id;
    this.jobs.set(id, { fn, at: this.now + delay, interval });
    return id;
  }
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      const [id, job] = next;
      this.now = job.at;
      if (job.interval) job.at += job.interval;
      else this.jobs.delete(id);
      job.fn();
    }
    this.now = end;
  }
}

class Events {
  handlers = new Map();
  addEventListener(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
  dispatch(type, event = {}) {
    for (const fn of [...(this.handlers.get(type) ?? [])]) {
      fn(event);
      if (event.stopped) break;
    }
  }
}

function harness(options = {}) {
  const clock = new Clock();
  const window = new Events();
  const document = new Events();
  const player = new Events();
  const volumes = [];
  const skips = [];
  const notifications = [];
  const menus = new Set();
  const storage = new Map();
  const sockets = [];
  if (options.knob) {
    window.SmoothNextKnobEnabled = true;
    window.WebSocket = class {
      readyState = 0;
      sent = [];
      constructor(url, protocol) { Object.assign(this, { url, protocol }); sockets.push(this); }
      open() { this.readyState = 1; this.onopen?.(); }
      send(data) { this.sent.push(JSON.parse(data)); }
      message(data) { this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) }); }
      close() { this.readyState = 3; this.onclose?.(); }
    };
  }
  let volume = options.volume ?? 0.72;
  let trackStarted = 0;
  let initialPosition = 30000;
  player.data = {
    item: { uri: "spotify:track:first", uid: "first" },
    playbackId: "playback-first",
    isPaused: options.paused ?? false,
    isBuffering: options.buffering ?? false,
  };
  player.getVolume = () => volume;
  player.setVolume = (value) => {
    volumes.push({ time: clock.now, value });
    if (!options.ignoreVolume) volume = value;
  };
  player.isPlaying = () => !player.data.isPaused;
  player.getProgress = () => initialPosition + clock.now - trackStarted;
  function changeTrack({ uri = "spotify:track:second", uid = "second", playbackId = "playback-second", emit = true } = {}) {
    player.data = { ...player.data, item: { uri, uid }, playbackId };
    trackStarted = clock.now;
    initialPosition = 0;
    if (emit) player.dispatch("songchange");
  }
  player.next = () => {
    skips.push({ time: clock.now, volume });
    if (options.nextError) throw new Error("Skip failed");
    if (options.rejectNext) return Promise.reject(new Error("Skip rejected"));
    if (!options.noChange) {
      if (options.skipDelay) clock.add(() => changeTrack(), options.skipDelay);
      else changeTrack();
    }
  };
  const platform = { skipToNext: player.next };
  if (options.sharedAPI) {
    player.origin = platform;
    player.next = () => platform.skipToNext();
  }
  const spice = {
    Player: player,
    Platform: options.sharedAPI ? { PlayerAPI: platform } : {},
    showNotification: (message) => notifications.push(message),
    LocalStorage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
    Menu: { Item: class {
      constructor(name, enabled, onClick) { Object.assign(this, { name, isEnabled: enabled, onClick }); }
      register() { menus.add(this); }
      deregister() { menus.delete(this); }
    } },
  };
  if (options.replacePlayerAfterStartup) {
    spice.Player = Object.assign(new Events(), player, { data: undefined, handlers: new Map() });
  }
  if (!options.lateAPI) window.Spicetify = spice;
  const context = vm.createContext({
    window, document,
    console: { info() {}, warn() {}, error() {} },
    performance: { now: () => clock.now },
    setTimeout: (fn, ms) => clock.add(fn, ms),
    clearTimeout: (id) => clock.jobs.delete(id),
    setInterval: (fn, ms) => clock.add(fn, ms, ms),
    clearInterval: (id) => clock.jobs.delete(id),
  });
  const run = () => vm.runInContext(source, context);
  run();
  if (options.replacePlayerAfterStartup) spice.Player = player;
  function event(type = "click", control = "next", extra = {}) {
    const id = { next: "control-button-skip-forward", pause: "control-button-playpause", volume: "volume-bar" }[control];
    const target = {
      disabled: extra.disabled ?? false,
      getAttribute: () => null,
      closest(selector) {
        if (extra.editable && selector.startsWith("input,")) return this;
        return id && selector.includes(`[data-testid="${id}"]`) ? this : null;
      },
    };
    const event = {
      type, target, ...extra,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    window.dispatch(type, event);
    if (!event.stopped) document.dispatch(type, event);
    // Model Spotify's native handler after the document capture phase.
    if (control === "next" && type === "click" && !event.stopped && !target.disabled) player.next();
    return event;
  }
  return { clock, window, document, player, platform, spice, volumes, skips, notifications, menus, storage, sockets, changeTrack, event, run,
    get volume() { return volume; }, set volume(value) { volume = value; } };
}

test("Next fades monotonically for 2 seconds, skips once, and restores volume without fade-in", () => {
  const h = harness();
  assert.equal(h.event().prevented, true);
  h.clock.advance(1000);
  assert.equal(h.skips.length, 0);
  assert.ok(Math.abs(h.volume - 0.36) < 0.001);
  h.clock.advance(999);
  assert.equal(h.skips.length, 0);
  h.clock.advance(1);
  assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
  assert.equal(h.volume, 0.72);
  const fade = h.volumes.slice(0, -1);
  assert.ok(fade.every((entry, i) => entry.value >= 0 && (!i || entry.value <= fade[i - 1].value)));
  assert.deepEqual(h.volumes.at(-1), { time: 2000, value: 0.72 });
  const writes = h.volumes.length;
  h.clock.advance(3000);
  assert.equal(h.volumes.length, writes, "No fade-in should run after the skip");
  assert.equal(h.window.SmoothNext.busy, false);
});

test("rapid clicks during fade and loading skip only once", () => {
  const h = harness({ skipDelay: 400 });
  h.event();
  h.clock.advance(500);
  h.event();
  h.event();
  h.clock.advance(1600);
  assert.equal(h.event().stopped, true);
  h.clock.advance(4000);
  assert.equal(h.skips.length, 1);
  assert.equal(h.volume, 0.72);
});

for (const options of [{ paused: true }, { volume: 0 }]) {
  test(`native click is retained for ${JSON.stringify(options)}`, () => {
    const h = harness(options);
    assert.equal(h.event().stopped, undefined);
    assert.equal(h.skips[0].time, 0);
    assert.equal(h.volumes.length, 0);
  });
}

test("a stale buffering flag must not bypass the fade while the song is playing", () => {
  // Observed in Spotify: playback progresses and isPlaying() is true, but
  // Player.data.isBuffering remains true throughout the song.
  const h = harness({ buffering: true });
  assert.equal(h.event().prevented, true);
  h.clock.advance(1000);
  assert.equal(h.skips.length, 0);
  assert.ok(Math.abs(h.volume - 0.36) < 0.001);
  h.clock.advance(1000);
  assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
  assert.equal(h.volume, 0.72);
});

test("Player replacement after extension startup must not bypass the fade", () => {
  const h = harness({ replacePlayerAfterStartup: true, buffering: true });
  assert.equal(h.event().prevented, true);
  h.clock.advance(1000);
  assert.equal(h.skips.length, 0);
  assert.ok(Math.abs(h.volume - 0.36) < 0.001);
  h.clock.advance(1000);
  assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
  assert.equal(h.volume, 0.72);
  assert.equal(h.player.handlers.get("songchange").size, 1);
});

test("disabled Next and non-music playback are not intercepted", () => {
  const h = harness();
  assert.equal(h.event("click", "next", { disabled: true }).stopped, undefined);
  assert.equal(h.skips.length, 0);
  h.player.data.item.uri = "spotify:episode:podcast";
  assert.equal(h.event().stopped, undefined);
  assert.equal(h.volumes.length, 0);
});

test("natural end or selecting another track during the fade never causes an extra skip", () => {
  const h = harness();
  h.event();
  h.clock.advance(900);
  h.changeTrack();
  h.clock.advance(7000);
  assert.equal(h.skips.length, 0);
  assert.equal(h.volume, 0.72);
});

test("pausing mid-fade cancels and restores volume", () => {
  const h = harness();
  h.event();
  h.clock.advance(900);
  h.player.data.isPaused = true;
  h.player.dispatch("onplaypause");
  h.clock.advance(3000);
  assert.equal(h.skips.length, 0);
  assert.equal(h.volume, 0.72);
});

test("timeout restores volume when next never changes the track", () => {
  const h = harness({ noChange: true });
  h.event();
  h.clock.advance(7000);
  assert.equal(h.skips.length, 1);
  assert.equal(h.volume, 0.72);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.window.SmoothNext.busy, false);
});

test("failed volume commands do not cause a hard skip", () => {
  const h = harness({ ignoreVolume: true });
  h.event();
  h.clock.advance(3000);
  assert.equal(h.skips.length, 0);
  assert.equal(h.volume, 0.72);
  assert.equal(h.notifications.length, 1);
});

test("a throwing next restores volume", () => {
  const h = harness({ nextError: true });
  h.event();
  h.clock.advance(2000);
  assert.equal(h.volume, 0.72);
  assert.equal(h.window.SmoothNext.busy, false);
});

test("a rejected next promise restores volume", async () => {
  const h = harness({ rejectNext: true });
  h.event();
  h.clock.advance(2000);
  await Promise.resolve();
  assert.equal(h.volume, 0.72);
  assert.equal(h.window.SmoothNext.busy, false);
});

test("consecutive identical URIs are detected by playback identity without songchange", () => {
  const h = harness({ noChange: true });
  h.event();
  h.clock.advance(2000);
  h.changeTrack({ uri: "spotify:track:first", uid: "second-copy", emit: false });
  h.clock.advance(40);
  assert.equal(h.volume, 0.72);
  assert.equal(h.notifications.length, 0);
});

test("repeated song with unchanged identity is recognized by position reset", () => {
  const h = harness({ noChange: true });
  h.event();
  h.clock.advance(2000);
  h.changeTrack({ uri: "spotify:track:first", uid: "first", playbackId: "playback-first", emit: false });
  h.clock.advance(40);
  assert.equal(h.volume, 0.72);
});

test("manual volume interaction cancels before native handlers choose a new volume", () => {
  const h = harness();
  h.event();
  h.clock.advance(1000);
  h.event("pointerdown", "volume");
  assert.equal(h.volume, 0.72);
  h.volume = 0.25;
  h.clock.advance(4000);
  assert.equal(h.volume, 0.25);
  assert.equal(h.skips.length, 0);
});

test("volume shortcut cancels before Spotify processes the key", () => {
  const h = harness();
  h.event();
  h.clock.advance(600);
  h.event("keydown", "none", { metaKey: true, key: "ArrowDown" });
  assert.equal(h.volume, 0.72);
  assert.equal(h.window.SmoothNext.busy, false);
});

test("menu disable cancels and persists across reload", () => {
  const h = harness();
  h.event();
  h.clock.advance(600);
  [...h.menus][0].onClick();
  assert.equal(h.volume, 0.72);
  h.run();
  assert.equal(h.window.SmoothNext.enabled, false);
  assert.equal(h.menus.size, 1);
  assert.equal(h.event().stopped, undefined);
  assert.equal(h.skips.length, 1);
});

test("hot reload restores volume and removes old event listeners", () => {
  const h = harness();
  h.event();
  h.clock.advance(800);
  h.run();
  assert.equal(h.volume, 0.72);
  assert.equal(h.player.handlers.get("songchange").size, 1);
  assert.equal(h.document.handlers.get("click").size, 2);
  assert.equal(h.menus.size, 1);
  h.event();
  h.clock.advance(2000);
  assert.equal(h.skips.length, 1);
});

test("unloading cancels all pending work", () => {
  const h = harness();
  h.event();
  h.clock.advance(800);
  h.window.dispatch("beforeunload");
  h.clock.advance(3000);
  assert.equal(h.volume, 0.72);
  assert.equal(h.skips.length, 0);
  assert.equal(h.clock.jobs.size, 0);
});

test("extension waits for Spicetify APIs to load", () => {
  const h = harness({ lateAPI: true });
  h.clock.advance(400);
  assert.equal(h.menus.size, 0);
  h.window.Spicetify = h.spice;
  h.clock.advance(200);
  assert.equal(h.menus.size, 1);
  h.event();
  h.clock.advance(2000);
  assert.equal(h.skips.length, 1);
});

for (const keys of [
  { key: "MediaTrackNext" },
  { key: "Unidentified", code: "MediaTrackNext" },
  { key: "ArrowRight", metaKey: true },
  { key: "ArrowRight", ctrlKey: true },
]) {
  test(`keyboard Next fades before skipping: ${JSON.stringify(keys)}`, () => {
    const h = harness({ sharedAPI: true });
    assert.equal(h.event("keydown", "none", keys).prevented, true);
    h.clock.advance(1000);
    assert.equal(h.skips.length, 0);
    assert.ok(h.volume < 0.4);
    h.clock.advance(1000);
    assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
    assert.equal(h.volume, 0.72);
  });
}

test("background Media Session nexttrack route fades without any DOM key event", async () => {
  const h = harness({ sharedAPI: true });
  // This is the route used by Spotify's actual nexttrack action handler.
  const nexttrack = () => h.platform.skipToNext();
  const completion = nexttrack();
  assert.equal(h.skips.length, 0);
  h.clock.advance(2000);
  await completion;
  assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
  assert.equal(h.volume, 0.72);
});

test("mouse and media commands during the same fade do not recurse or skip twice", async () => {
  const h = harness({ sharedAPI: true });
  h.event();
  const completion = h.platform.skipToNext();
  h.event("keydown", "none", { key: "MediaTrackNext", repeat: true });
  h.clock.advance(5000);
  await completion;
  assert.equal(h.skips.length, 1);
});

test("caret navigation is preserved while a media key still works in text fields", () => {
  const h = harness();
  assert.equal(h.event("keydown", "none", { key: "ArrowRight", metaKey: true, editable: true }).stopped, undefined);
  assert.equal(h.event("keydown", "none", { key: "ArrowRight", altKey: true }).stopped, undefined);
  assert.equal(h.event("keydown", "none", { key: "MediaTrackNext", editable: true }).stopped, true);
  h.clock.advance(2000);
  assert.equal(h.skips.length, 1);
});

test("explicit queue selection keeps the original API arguments and return value", () => {
  const h = harness({ sharedAPI: true });
  h.window.SmoothNext.destroy();
  const selection = { uri: "spotify:track:chosen", uid: "chosen" };
  h.platform.skipToNext = function (arg) {
    assert.equal(this, h.platform);
    assert.equal(arg, selection);
    return "original-result";
  };
  h.run();
  assert.equal(h.platform.skipToNext(selection), "original-result");
  assert.equal(h.volumes.length, 0);
});

test("replacement of PlayerAPI is picked up and native hook is restored on unload", () => {
  const h = harness({ sharedAPI: true });
  const original = () => h.changeTrack();
  const replacement = { skipToNext: original };
  h.spice.Platform.PlayerAPI = replacement;
  h.clock.advance(1000);
  assert.notEqual(replacement.skipToNext, original);
  replacement.skipToNext();
  h.clock.advance(1000);
  assert.ok(h.volume < 0.4);
  h.window.SmoothNext.destroy();
  assert.equal(replacement.skipToNext, original);
  assert.equal(h.volume, 0.72);
  assert.equal(h.clock.jobs.size, 0);
});

test("disabling the extension restores immediate native media-key behavior", () => {
  const h = harness({ sharedAPI: true });
  h.window.SmoothNext.setEnabled(false);
  h.platform.skipToNext();
  assert.deepEqual(h.skips, [{ time: 0, volume: 0.72 }]);
  assert.equal(h.volumes.length, 0);
});

test("SDCX companion commands use the same fade without focused Spotify", () => {
  const h = harness({ knob: true, sharedAPI: true });
  const socket = h.sockets[0];
  assert.equal(socket.url, "ws://127.0.0.1:17643");
  assert.equal(socket.protocol, "smooth-next-v1");
  socket.open();
  assert.deepEqual(socket.sent[0], { type: "status", enabled: true });
  socket.message({ type: "next", id: "knob-1" });
  assert.equal(h.window.SmoothNext.busy, true);
  h.clock.advance(1000);
  assert.ok(Math.abs(h.volume - 0.36) < 0.001);
  assert.equal(h.skips.length, 0);
  socket.message({ type: "next", id: "knob-2" });
  h.clock.advance(1000);
  assert.deepEqual(h.skips, [{ time: 2000, volume: 0 }]);
  assert.equal(h.volume, 0.72);
  socket.message({ type: "next", id: "knob-2" });
  h.clock.advance(2500);
  assert.equal(h.skips.length, 1, "Duplicate delivery must not skip twice");
});

test("companion state follows the menu; disabled and paused commands retain normal Next", () => {
  const h = harness({ knob: true });
  const socket = h.sockets[0]; socket.open();
  h.window.SmoothNext.setEnabled(false);
  assert.deepEqual(socket.sent.at(-1), { type: "status", enabled: false });
  socket.message({ type: "next", id: "disabled" });
  assert.equal(h.skips[0].time, 0);
  h.window.SmoothNext.setEnabled(true);
  h.player.data.isPaused = true;
  socket.message({ type: "next", id: "paused" });
  assert.equal(h.skips.length, 2);
  assert.equal(h.volumes.length, 0);
});

test("companion ignores malformed messages, reconnects, and closes on unload", () => {
  const h = harness({ knob: true });
  const socket = h.sockets[0]; socket.open();
  socket.message("bad json"); socket.message({ type: "next" });
  socket.message({ type: "set-volume", id: "invalid" });
  assert.equal(h.window.SmoothNext.busy, false);
  socket.close(); h.clock.advance(5000);
  assert.equal(h.sockets.length, 2);
  h.sockets[1].open(); h.window.SmoothNext.destroy();
  assert.equal(h.sockets[1].readyState, 3);
  assert.equal(h.clock.jobs.size, 0);
});
