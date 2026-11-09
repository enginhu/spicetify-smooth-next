// NAME: Smooth Next
// VERSION: 1.3.0
// DESCRIPTION: Fade out for 2 seconds before Next, including keyboard/media commands. No fade-in.
// No build step or dependencies. PlayerAPI hooks are feature-detected.

(function smoothNext() {
  "use strict";

  const FADE_MS = 2000;
  const TICK_MS = 40;
  const VOLUME_ACK_MS = 1000;
  const SKIP_TIMEOUT_MS = 5000;
  const ENABLED_KEY = "smooth-next:enabled";
  const NEXT = '[data-testid="control-button-skip-forward"]';
  const VOLUME = '[data-testid="volume-bar"], .volume-bar, .volume-bar__icon-button';
  const OTHER_CONTROL = '[data-testid="control-button-playpause"], [data-testid="control-button-skip-back"]';

  // A hot reload must not leave a second click handler or an unfinished fade.
  window.SmoothNext?.destroy();
  let disposed = false;
  let readyTimer;
  let timer;
  let apiTimer;
  let bypassDepth = 0;
  let active = null;
  let player;
  let unlistenPlayer = () => {};
  let menu;
  let enabled = true;
  const unlisten = [];
  const skipHooks = new Map();
  let knobSocket;
  let knobRetry;
  let lastKnobCommand;

  const controller = {
    version: "1.3.0",
    get enabled() { return enabled; },
    get busy() { return active !== null; },
    setEnabled,
    destroy,
    connectKnob,
  };
  window.SmoothNext = controller;

  // Optional macOS companion: only loopback, never a remote server. It maps
  // this keypad's native Next to a reserved global hotkey, then sends it here.
  function connectKnob() {
    if (disposed || !window.SmoothNextKnobEnabled || !window.WebSocket || knobSocket) return;
    clearTimeout(knobRetry);
    let socket;
    try { socket = new window.WebSocket("ws://127.0.0.1:17643", "smooth-next-v1"); }
    catch (_) { knobRetry = setTimeout(connectKnob, 5000); return; }
    knobSocket = socket;
    lastKnobCommand = undefined;
    socket.onopen = () => {
      if (disposed || knobSocket !== socket) { socket.close(); return; }
      sendKnobStatus();
      // Native WebSocket ping/pong keeps the companion alive even when
      // Chromium throttles this page's background JavaScript timers.
    };
    socket.onmessage = (event) => {
      if (disposed || knobSocket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (message.type !== "next" || typeof message.id !== "string" || message.id === lastKnobCommand) return;
      lastKnobCommand = message.id;
      try {
        if (!startFade()) callWithoutFade(() => window.Spicetify.Player.next());
        socket.send(JSON.stringify({ type: "ack", id: message.id }));
      } catch (error) { report(error); }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (knobSocket !== socket) return;
      knobSocket = undefined;
      if (!disposed) knobRetry = setTimeout(connectKnob, 5000);
    };
  }

  function sendKnobStatus() {
    if (knobSocket?.readyState === 1) {
      knobSocket.send(JSON.stringify({ type: "status", enabled }));
    }
  }

  function report(error) {
    console.error("[Smooth Next]", error);
    window.Spicetify?.showNotification?.("Smooth Next: Geçiş tamamlanamadı; ses geri yüklenmeye çalışıldı.", true);
  }

  function listen(target, type, handler, capture = false) {
    target.addEventListener(type, handler, capture);
    unlisten.push(() => target.removeEventListener(type, handler, capture));
  }

  function refreshPlayer() {
    const current = window.Spicetify?.Player;
    if (!current) throw new Error("Spicetify.Player henüz hazır değil.");
    if (current === player) return;
    // Spotify/Spicetify can replace this object after extension startup.
    // The original object may still expose methods, but its data stays empty.
    unlistenPlayer();
    player = current;
    current.addEventListener("songchange", tick);
    current.addEventListener("onplaypause", tick);
    unlistenPlayer = () => {
      current.removeEventListener("songchange", tick);
      current.removeEventListener("onplaypause", tick);
    };
  }

  function callWithoutFade(callback) {
    bypassDepth++;
    try { return callback(); }
    finally { bypassDepth--; }
  }

  function refreshSkipHooks() {
    if (disposed) return;
    const spice = window.Spicetify;
    // Spotify's keyboard shortcuts and Media Session nexttrack callback both
    // call PlayerAPI.skipToNext(), including when the window is unfocused.
    const targets = new Set([spice?.Platform?.PlayerAPI, spice?.Player?.origin]);
    for (const target of targets) {
      if (!target || skipHooks.has(target) || typeof target.skipToNext !== "function") continue;
      const original = target.skipToNext;
      function skipToNext(...args) {
        const invoke = () => original.apply(this, args);
        // Explicit queue-item selection is not a generic Next command.
        if (disposed || bypassDepth || args.some((arg) => arg != null)) return invoke();
        const transition = startFade(invoke);
        return transition ? transition.done : invoke();
      }
      try {
        target.skipToNext = skipToNext;
        if (target.skipToNext === skipToNext) skipHooks.set(target, { original, wrapped: skipToNext });
      } catch (error) {
        console.warn("[Smooth Next] Medya tuşu bağlantısı kurulamadı.", error);
      }
    }
  }

  function itemOf(data) {
    return data?.item ?? data?.track;
  }

  function identity(data) {
    const item = itemOf(data);
    if (!item?.uri) return null;
    // URI alone cannot distinguish two consecutive copies of the same song.
    return JSON.stringify([item.uri, item.uid ?? "", data.playbackId ?? data.playback_id ?? ""]);
  }

  function finish(error) {
    const transition = active;
    if (!transition) return;
    active = null;
    clearInterval(timer);
    timer = undefined;
    try {
      // Restore directly: the next song has NO fade-in.
      const result = (window.Spicetify?.Player ?? player).setVolume(transition.volume);
      if (result?.catch) result.catch(report);
    } catch (restoreError) {
      report(restoreError);
    }
    if (error) report(error);
    transition.resolve(transition.result);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) finish();
    sendKnobStatus();
    if (menu) menu.isEnabled = enabled;
    try { window.Spicetify?.LocalStorage?.set(ENABLED_KEY, String(enabled)); }
    catch (error) { console.warn("[Smooth Next] Ayar kaydedilemedi.", error); }
  }

  function destroy() {
    disposed = true;
    clearTimeout(readyTimer);
    clearInterval(apiTimer);
    clearTimeout(knobRetry);
    knobSocket?.close();
    knobSocket = undefined;
    finish();
    unlistenPlayer();
    for (const remove of unlisten) remove();
    for (const [target, hook] of skipHooks) {
      // Do not overwrite a hook installed later by another extension.
      if (target.skipToNext === hook.wrapped) target.skipToNext = hook.original;
    }
    skipHooks.clear();
    menu?.deregister();
    if (window.SmoothNext === controller) delete window.SmoothNext;
  }

  function writeVolume(value, transition) {
    const result = player.setVolume(Math.max(0, Math.min(1, value)));
    if (result?.catch) result.catch((error) => {
      if (active === transition) finish(error);
    });
  }

  function inspectState() {
    if (!active) return;
    const key = identity(player.data);
    if (key && key !== active.identity) {
      // This also cancels a fade if the user selects a song, or the current
      // song ends naturally. Never skip again and accidentally lose a track.
      finish();
      return;
    }
    if (!key) {
      if (active.phase !== "switching") finish();
      return;
    }
    if (!player.isPlaying()) {
      finish();
      return;
    }
    const position = player.getProgress();
    if (active.phase === "switching" && position < active.skipPosition - 1000) {
      // Older clients may not expose a new UID/playbackId for repeated songs.
      finish();
    }
  }

  function tick() {
    if (!active) return;
    try {
      refreshPlayer();
      inspectState();
      if (!active) return;
      const transition = active;
      const now = performance.now();

      if (transition.phase === "fading") {
        const fraction = Math.min(1, (now - transition.startedAt) / FADE_MS);
        const eased = fraction * fraction * (3 - 2 * fraction);
        writeVolume(transition.volume * (1 - eased), transition);
        if (fraction < 1) return;
        transition.phase = "muting";
        transition.deadline = now + VOLUME_ACK_MS;
      }

      if (transition.phase === "muting") {
        // setVolume() returns void in the official wrapper. Check its reported
        // result before skipping, instead of assuming an awaited call is an ACK.
        if (player.getVolume() > 0.005) {
          if (now >= transition.deadline) finish(new Error("Ses kısma isteği uygulanmadı."));
          return;
        }
        transition.phase = "switching";
        transition.skipPosition = player.getProgress();
        transition.deadline = now + SKIP_TIMEOUT_MS;
        const result = callWithoutFade(transition.invokeNext);
        transition.result = result;
        if (result?.catch) {
          // Keep callers' promises fulfilled on a handled transition failure.
          transition.result = result.catch((error) => {
            if (active === transition) finish(error);
          });
        }
        // Covers synchronous state changes and clients that miss songchange.
        inspectState();
        return;
      }

      if (transition.phase === "switching" && now >= transition.deadline) {
        finish(new Error("Sonraki şarkı zamanında başlamadı."));
      }
    } catch (error) {
      finish(error);
    }
  }

  function startFade(invokeNext = () => window.Spicetify.Player.next()) {
    if (!enabled || disposed) return null;
    if (active) return active;
    try {
      refreshPlayer();
      const data = player.data;
      const volume = player.getVolume();
      const uri = itemOf(data)?.uri ?? "";
      // Spotify can keep isBuffering=true even while a song is audibly
      // playing. Trust isPlaying(), not that stale flag, to decide to fade.
      // Paused, silent and non-music playback keep native behavior.
      if (!/^(spotify:track:|spotify:local:)/.test(uri) || !player.isPlaying() ||
          !Number.isFinite(volume) || volume <= 0 || volume > 1) return null;
      let resolve;
      const done = new Promise((complete) => { resolve = complete; });
      active = {
        phase: "fading",
        startedAt: performance.now(),
        identity: identity(data),
        volume,
        invokeNext,
        done,
        resolve,
      };
      timer = setInterval(tick, TICK_MS);
      return active;
    } catch (error) {
      // If the APIs are not ready, leave this click to Spotify.
      console.warn("[Smooth Next] Oynatıcı hazır değil.", error);
      return null;
    }
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onClick(event) {
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const button = target?.closest(NEXT);
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
    if (!startFade()) return;
    // Capture runs before Spotify's React click handler. Further clicks during
    // this transition are consumed, so a double click still skips exactly once.
    consume(event);
  }

  function onKeyDown(event) {
    if (!enabled || event.isComposing) return;
    const mediaNext = event.key === "MediaTrackNext" || event.code === "MediaTrackNext" || event.keyCode === 176;
    const shortcut = event.key === "ArrowRight" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
    if (!mediaNext && !shortcut) return;
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    // Preserve caret navigation and slider interactions. A hardware media key
    // is still a media command when focus happens to be in an input.
    if (!mediaNext && target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')) return;
    if (event.repeat || startFade()) consume(event);
  }

  function onUserControl(event) {
    if (!active) return;
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const volumeShortcut = event.type === "keydown" && (event.ctrlKey || event.metaKey) &&
      (event.key === "ArrowUp" || event.key === "ArrowDown");
    if (volumeShortcut || target?.closest(VOLUME) ||
        (event.type === "click" && target?.closest(OTHER_CONTROL))) {
      // Restore before Spotify handles the user's volume/mute/pause action.
      finish();
    }
  }

  function ready() {
    if (disposed) return;
    const spice = window.Spicetify;
    const required = ["getVolume", "setVolume", "getProgress", "isPlaying", "next", "addEventListener", "removeEventListener"];
    if (!spice?.Player || !spice.Menu?.Item || !spice.LocalStorage ||
        !required.every((method) => typeof spice.Player[method] === "function")) {
      readyTimer = setTimeout(ready, 200);
      return;
    }
    refreshPlayer();
    refreshSkipHooks();
    // APIs can be replaced during startup. Keep the shared media-key route
    // attached without replacing Spotify's Media Session handlers.
    apiTimer = setInterval(refreshSkipHooks, 1000);
    try { enabled = spice.LocalStorage.get(ENABLED_KEY) !== "false"; }
    catch (error) { console.warn("[Smooth Next] Ayar okunamadı.", error); }
    menu = new spice.Menu.Item("Smooth Next · 2 sn fade-out", enabled, () => setEnabled(!enabled));
    menu.register();
    listen(document, "click", onClick, true);
    listen(window, "keydown", onKeyDown, true);
    for (const type of ["pointerdown", "wheel", "keydown", "click"]) listen(document, type, onUserControl, true);
    listen(window, "beforeunload", destroy);
    connectKnob();
    console.info("[Smooth Next] Hazır: 2 saniye fade-out, ardından sonraki şarkı.");
  }

  ready();
})();
