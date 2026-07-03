var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var main_exports = {};
__export(main_exports, {
  default: () => SoundersPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var PRESET_NAMES = ["beep", "coin", "pop", "ding", "laser", "drum"];
var PRESET_LABELS = {
  beep: "Beep",
  coin: "Coin",
  pop: "Pop",
  ding: "Ding",
  laser: "Laser",
  drum: "Drum"
};
var AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "flac",
  "aac",
  "opus",
  "webm",
  "oga",
  "mp4",
  "3gp"
];
function defaultSettings() {
  return {
    playlists: [
      {
        id: "builtin",
        name: "Built-in",
        sounds: PRESET_NAMES.map((n) => ({ type: "preset", id: n }))
      }
    ],
    activePlaylistId: "builtin",
    volume: 0.8,
    leftClickAction: "next",
    shuffle: false,
    repeatMode: "auto"
  };
}
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0)
    return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function decodeId3Text(enc, bytes) {
  try {
    if (enc === 1)
      return new TextDecoder("utf-16").decode(bytes);
    if (enc === 2)
      return new TextDecoder("utf-16be").decode(bytes);
    if (enc === 3)
      return new TextDecoder("utf-8").decode(bytes);
    return new TextDecoder("windows-1252").decode(bytes);
  } catch (e) {
    return "";
  }
}
function syncsafe(a, b, c, d) {
  return (a & 127) << 21 | (b & 127) << 14 | (c & 127) << 7 | d & 127;
}
function parseArtist(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length > 10 && data[0] === 73 && data[1] === 68 && data[2] === 51) {
    const major = data[3];
    const size = syncsafe(data[6], data[7], data[8], data[9]);
    const end = Math.min(10 + size, data.length);
    const v2 = major === 2;
    const target = v2 ? "TP1" : "TPE1";
    let off = 10;
    while (off + (v2 ? 6 : 10) <= end) {
      let frameId;
      let frameSize;
      let headerLen;
      if (v2) {
        frameId = String.fromCharCode(data[off], data[off + 1], data[off + 2]);
        frameSize = data[off + 3] << 16 | data[off + 4] << 8 | data[off + 5];
        headerLen = 6;
      } else {
        frameId = String.fromCharCode(
          data[off],
          data[off + 1],
          data[off + 2],
          data[off + 3]
        );
        if (major === 4) {
          frameSize = syncsafe(
            data[off + 4],
            data[off + 5],
            data[off + 6],
            data[off + 7]
          );
        } else {
          frameSize = data[off + 4] * 16777216 + data[off + 5] * 65536 + data[off + 6] * 256 + data[off + 7];
        }
        headerLen = 10;
      }
      if (frameSize <= 0 || !/^[A-Z0-9]+$/.test(frameId))
        break;
      if (frameId === target) {
        const dstart = off + headerLen;
        const enc = data[dstart];
        const textBytes = data.slice(dstart + 1, dstart + frameSize);
        const text = decodeId3Text(enc, textBytes).replace(/\0+$/g, "").trim();
        if (text)
          return text;
        break;
      }
      off += headerLen + frameSize;
    }
  }
  if (data.length >= 128) {
    const tagStart = data.length - 128;
    if (data[tagStart] === 84 && data[tagStart + 1] === 65 && data[tagStart + 2] === 71) {
      const artistBytes = data.slice(tagStart + 33, tagStart + 63);
      const text = decodeId3Text(0, artistBytes).replace(/\0+$/g, "").trim();
      if (text)
        return text;
    }
  }
  return null;
}
var PresetPlayer = class {
  constructor() {
    this.ctx = null;
    this.active = [];
  }
  getCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended")
      void this.ctx.resume();
    return this.ctx;
  }
  register(node) {
    this.active.push(node);
    node.addEventListener("ended", () => {
      const i = this.active.indexOf(node);
      if (i >= 0)
        this.active.splice(i, 1);
    });
  }
  tone(freq, start, duration, type, gainPeak) {
    const ctx = this.getCtx();
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(1e-4, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
    this.register(osc);
  }
  sweep(fromFreq, toFreq, duration, type, gainPeak) {
    const ctx = this.getCtx();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t0 + duration);
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
    this.register(osc);
  }
  noiseBurst(duration, gainPeak) {
    const ctx = this.getCtx();
    const t0 = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++)
      channel[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
    src.connect(gain).connect(ctx.destination);
    src.start(t0);
    this.register(src);
  }
  play(name, volume) {
    const v = Math.max(1e-4, Math.min(1, volume));
    switch (name) {
      case "beep":
        this.tone(660, 0, 0.16, "square", 0.25 * v);
        break;
      case "coin":
        this.tone(988, 0, 0.08, "square", 0.22 * v);
        this.tone(1319, 0.08, 0.18, "square", 0.22 * v);
        break;
      case "pop":
        this.sweep(700, 180, 0.12, "sine", 0.3 * v);
        break;
      case "ding":
        this.tone(880, 0, 0.5, "sine", 0.3 * v);
        this.tone(1320, 0, 0.5, "sine", 0.12 * v);
        break;
      case "laser":
        this.sweep(1400, 180, 0.28, "sawtooth", 0.22 * v);
        break;
      case "drum":
        this.sweep(160, 50, 0.22, "sine", 0.5 * v);
        this.noiseBurst(0.06, 0.15 * v);
        break;
    }
  }
  stop() {
    for (const node of this.active) {
      try {
        node.stop();
      } catch (e) {
      }
    }
    this.active = [];
  }
  dispose() {
    this.stop();
    if (this.ctx)
      void this.ctx.close();
    this.ctx = null;
  }
};
var SoundersPlugin = class _SoundersPlugin extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = defaultSettings();
    this.currentAudio = null;
    this.currentRef = null;
    this.currentIndex = -1;
    this.presetPlayer = new PresetPlayer();
    this.currentUrl = null;
    this.ribbonEl = null;
    this.ribbonTooltipText = "";
    this.onPlaybackChange = null;
    this.history = [];
    this.historyPos = -1;
    this.cycle = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.ribbonEl = this.addRibbonIcon("volume-2", "Sounders", (evt) => {
      if (evt.button !== 0)
        return;
      if (this.settings.leftClickAction === "playpause")
        this.togglePlayPause();
      else
        void this.playNext();
    });
    this.ribbonEl.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      new SettingsModal(this.app, this).open();
    });
    this.addCommand({
      id: "play-next-sound",
      name: "Play next sound",
      callback: () => void this.playNext()
    });
    this.addCommand({
      id: "toggle-play-pause",
      name: "Play / pause",
      callback: () => this.togglePlayPause()
    });
    this.addCommand({
      id: "open-settings",
      name: "Open settings",
      callback: () => new SettingsModal(this.app, this).open()
    });
    this.addSettingTab(new SoundersSettingTab(this.app, this));
    this.updateRibbonTooltip();
  }
  onunload() {
    this.stopPlayback();
    this.presetPlayer.dispose();
  }
  setPlaybackListener(cb) {
    this.onPlaybackChange = cb;
  }
  notifyPlayback() {
    var _a;
    this.updateRibbonTooltip();
    (_a = this.onPlaybackChange) == null ? void 0 : _a.call(this);
  }
  getActivePlaylist() {
    var _a;
    return (_a = this.settings.playlists.find(
      (p) => p.id === this.settings.activePlaylistId
    )) != null ? _a : null;
  }
  resetNavigation() {
    this.history = [];
    this.historyPos = -1;
    this.cycle.clear();
    this.currentIndex = -1;
  }
  setActivePlaylist(id) {
    this.settings.activePlaylistId = id;
    this.resetNavigation();
    void this.saveSettings();
  }
  toggleShuffle() {
    this.settings.shuffle = !this.settings.shuffle;
    this.cycle.clear();
    void this.saveSettings();
    this.notifyPlayback();
  }
  cycleRepeatMode() {
    const order = ["auto", "one", "off"];
    const i = order.indexOf(this.settings.repeatMode);
    this.settings.repeatMode = order[(i + 1) % order.length];
    void this.saveSettings();
    this.notifyPlayback();
  }
  trackName(ref) {
    var _a;
    if (ref.displayName)
      return ref.displayName;
    if (ref.type === "preset")
      return (_a = PRESET_LABELS[ref.id]) != null ? _a : ref.id;
    const dot = ref.id.lastIndexOf(".");
    return dot > 0 ? ref.id.slice(0, dot) : ref.id;
  }
  async renameTrackDisplay(playlist, index, displayName) {
    const ref = playlist.sounds[index];
    if (!ref)
      return;
    const trimmed = displayName.trim();
    if (trimmed)
      ref.displayName = trimmed;
    else
      delete ref.displayName;
    await this.saveSettings();
    this.notifyPlayback();
  }
  async renameTrackArtist(playlist, index, artist) {
    const ref = playlist.sounds[index];
    if (!ref)
      return;
    const trimmed = artist.trim();
    if (trimmed)
      ref.artist = trimmed;
    else
      delete ref.artist;
    await this.saveSettings();
  }
  async renamePlaylist(id, name) {
    const pl = this.settings.playlists.find((p) => p.id === id);
    if (!pl)
      return;
    const trimmed = name.trim();
    if (trimmed)
      pl.name = trimmed;
    await this.saveSettings();
  }
  getNowPlayingLabel() {
    return this.currentRef ? this.trackName(this.currentRef) : "Nothing playing";
  }
  stopPlayback() {
    this.presetPlayer.stop();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    this.currentRef = null;
    this.notifyPlayback();
  }
  chooseNext() {
    const pl = this.getActivePlaylist();
    if (!pl || pl.sounds.length === 0)
      return -1;
    const n = pl.sounds.length;
    if (this.historyPos >= 0 && this.historyPos < this.history.length - 1) {
      this.historyPos++;
      return this.history[this.historyPos];
    }
    let idx;
    if (this.settings.shuffle && n > 1) {
      if (this.cycle.size >= n)
        this.cycle.clear();
      let pool = [];
      for (let i = 0; i < n; i++)
        if (!this.cycle.has(i) && i !== this.currentIndex)
          pool.push(i);
      if (pool.length === 0) {
        for (let i = 0; i < n; i++)
          if (!this.cycle.has(i))
            pool.push(i);
      }
      if (pool.length === 0) {
        this.cycle.clear();
        for (let i = 0; i < n; i++)
          if (i !== this.currentIndex)
            pool.push(i);
      }
      idx = pool[Math.floor(Math.random() * pool.length)];
      this.cycle.add(idx);
    } else {
      idx = this.currentIndex < 0 ? 0 : (this.currentIndex + 1) % n;
    }
    this.history.push(idx);
    if (this.history.length > 200)
      this.history.shift();
    this.historyPos = this.history.length - 1;
    return idx;
  }
  choosePrev() {
    const pl = this.getActivePlaylist();
    if (!pl || pl.sounds.length === 0)
      return -1;
    const n = pl.sounds.length;
    if (this.historyPos > 0) {
      this.historyPos--;
      return this.history[this.historyPos];
    }
    return this.currentIndex <= 0 ? n - 1 : this.currentIndex - 1;
  }
  async playNext() {
    const idx = this.chooseNext();
    if (idx < 0) {
      new import_obsidian.Notice("Sounders: the active playlist is empty. Right click to add sounds.");
      return;
    }
    const pl = this.getActivePlaylist();
    if (!pl)
      return;
    this.stopPlayback();
    this.currentIndex = idx;
    await this.playRef(pl.sounds[idx]);
  }
  async playPrevious() {
    const idx = this.choosePrev();
    if (idx < 0) {
      new import_obsidian.Notice("Sounders: the active playlist is empty. Right click to add sounds.");
      return;
    }
    const pl = this.getActivePlaylist();
    if (!pl)
      return;
    this.stopPlayback();
    this.currentIndex = idx;
    await this.playRef(pl.sounds[idx]);
  }
  async playAt(index) {
    const pl = this.getActivePlaylist();
    if (!pl || index < 0 || index >= pl.sounds.length)
      return;
    this.stopPlayback();
    this.currentIndex = index;
    this.history.push(index);
    if (this.history.length > 200)
      this.history.shift();
    this.historyPos = this.history.length - 1;
    if (this.settings.shuffle)
      this.cycle.add(index);
    await this.playRef(pl.sounds[index]);
  }
  togglePlayPause() {
    if (this.currentAudio) {
      if (this.currentAudio.paused)
        void this.currentAudio.play();
      else
        this.currentAudio.pause();
      this.notifyPlayback();
      return;
    }
    void this.playNext();
  }
  seek(time) {
    if (this.currentAudio && isFinite(this.currentAudio.duration)) {
      this.currentAudio.currentTime = Math.max(
        0,
        Math.min(this.currentAudio.duration, time)
      );
      this.notifyPlayback();
    }
  }
  onTrackEnded() {
    const mode = this.settings.repeatMode;
    if (mode === "one" && this.currentRef) {
      const ref = this.currentRef;
      this.stopPlayback();
      this.currentRef = ref;
      void this.playRef(ref);
    } else if (mode === "auto") {
      void this.playNext();
    } else {
      this.stopPlayback();
    }
  }
  async playRef(ref) {
    this.currentRef = ref;
    if (ref.type === "preset") {
      this.presetPlayer.play(ref.id, this.settings.volume);
      this.notifyPlayback();
      return;
    }
    const path = (0, import_obsidian.normalizePath)(`${this.soundsDir()}/${ref.id}`);
    if (!await this.app.vault.adapter.exists(path)) {
      new import_obsidian.Notice(`Sounders: file not found \u2014 ${ref.id}`);
      this.currentRef = null;
      this.notifyPlayback();
      return;
    }
    const buffer = await this.app.vault.adapter.readBinary(path);
    const url = URL.createObjectURL(new Blob([buffer]));
    this.currentUrl = url;
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, this.settings.volume));
    this.currentAudio = audio;
    const stateHandler = () => this.notifyPlayback();
    audio.addEventListener("loadedmetadata", stateHandler);
    audio.addEventListener("play", stateHandler);
    audio.addEventListener("playing", stateHandler);
    audio.addEventListener("pause", stateHandler);
    audio.addEventListener("timeupdate", () => {
      var _a;
      (_a = this.onPlaybackChange) == null ? void 0 : _a.call(this);
    });
    audio.addEventListener("ended", () => this.onTrackEnded());
    audio.play().catch(
      (e) => new import_obsidian.Notice("Sounders: playback failed \u2014 " + e.message)
    );
    this.notifyPlayback();
  }
  setRibbonTooltip(text) {
    if (!this.ribbonEl || this.ribbonTooltipText === text)
      return;
    this.ribbonTooltipText = text;
    this.ribbonEl.setAttribute("aria-label", text);
    (0, import_obsidian.setTooltip)(this.ribbonEl, text);
  }
  updateRibbonTooltip() {
    let text = "Sounders";
    const a = this.currentAudio;
    if (a && !a.paused && this.currentRef && this.currentRef.type === "file" && isFinite(a.duration) && a.duration > 5) {
      text = this.trackName(this.currentRef);
    }
    this.setRibbonTooltip(text);
  }
  soundsDir() {
    return (0, import_obsidian.normalizePath)(`${this.manifest.dir}/sounds`);
  }
  async ensureSoundsDir() {
    const dir = this.soundsDir();
    if (!await this.app.vault.adapter.exists(dir))
      await this.app.vault.adapter.mkdir(dir);
  }
  fileReferenced(filename) {
    return this.settings.playlists.some(
      (p) => p.sounds.some((s) => s.type === "file" && s.id === filename)
    );
  }
  async uniqueName(original) {
    const safe = original.replace(/[\\/:*?"<>|]/g, "_");
    const dot = safe.lastIndexOf(".");
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : "";
    let candidate = safe;
    let i = 1;
    while (this.fileReferenced(candidate) || await this.app.vault.adapter.exists(
      (0, import_obsidian.normalizePath)(`${this.soundsDir()}/${candidate}`)
    )) {
      candidate = `${base}_${i}${ext}`;
      i++;
    }
    return candidate;
  }
  static isAudioFile(name) {
    const dot = name.lastIndexOf(".");
    if (dot < 0)
      return false;
    return AUDIO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
  }
  static genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  async importFile(file) {
    const name = await this.uniqueName(file.name);
    const buf = await file.arrayBuffer();
    await this.app.vault.adapter.writeBinary(
      (0, import_obsidian.normalizePath)(`${this.soundsDir()}/${name}`),
      buf
    );
    const artist = parseArtist(buf);
    const ref = { type: "file", id: name };
    if (artist)
      ref.artist = artist;
    return ref;
  }
  pickAndAddSounds(onDone) {
    const input = createEl("input", {
      attr: { type: "file", accept: "audio/*", multiple: "true" }
    });
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      if (files.length === 0)
        return;
      let playlist = this.getActivePlaylist();
      if (!playlist) {
        playlist = { id: _SoundersPlugin.genId(), name: "My Sounds", sounds: [] };
        this.settings.playlists.push(playlist);
        this.settings.activePlaylistId = playlist.id;
      }
      await this.ensureSoundsDir();
      let added = 0;
      for (const file of files) {
        try {
          playlist.sounds.push(await this.importFile(file));
          added++;
        } catch (e) {
          new import_obsidian.Notice(
            `Sounders: failed to add ${file.name} \u2014 ${e.message}`
          );
        }
      }
      this.resetNavigation();
      await this.saveSettings();
      if (added > 0)
        new import_obsidian.Notice(`Sounders: added ${added} sound(s).`);
      onDone == null ? void 0 : onDone();
    });
    document.body.appendChild(input);
    input.click();
  }
  addFolderAsPlaylist(onDone) {
    const input = createEl("input", { attr: { type: "file" } });
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("multiple", "");
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const all = input.files ? Array.from(input.files) : [];
      input.remove();
      const files = all.filter((f) => _SoundersPlugin.isAudioFile(f.name));
      if (files.length === 0) {
        new import_obsidian.Notice("Sounders: no audio files found in that folder.");
        return;
      }
      const relative = files[0].webkitRelativePath;
      const folderName = relative && relative.includes("/") ? relative.split("/")[0] : "Imported";
      await this.ensureSoundsDir();
      const refs = [];
      for (const file of files) {
        try {
          refs.push(await this.importFile(file));
        } catch (e) {
          new import_obsidian.Notice(
            `Sounders: failed to add ${file.name} \u2014 ${e.message}`
          );
        }
      }
      if (refs.length === 0)
        return;
      const playlist = {
        id: _SoundersPlugin.genId(),
        name: folderName,
        sounds: refs
      };
      this.settings.playlists.push(playlist);
      this.settings.activePlaylistId = playlist.id;
      this.resetNavigation();
      await this.saveSettings();
      new import_obsidian.Notice(
        `Sounders: created playlist "${folderName}" with ${refs.length} sound(s).`
      );
      onDone == null ? void 0 : onDone();
    });
    document.body.appendChild(input);
    input.click();
  }
  async deleteFile(filename) {
    const path = (0, import_obsidian.normalizePath)(`${this.soundsDir()}/${filename}`);
    try {
      if (await this.app.vault.adapter.exists(path))
        await this.app.vault.adapter.remove(path);
    } catch (e) {
    }
  }
  async removeSoundAt(playlist, index) {
    const removed = playlist.sounds.splice(index, 1)[0];
    if (removed && removed.type === "file" && !this.fileReferenced(removed.id))
      await this.deleteFile(removed.id);
    this.resetNavigation();
    await this.saveSettings();
  }
  async reorderSound(playlist, from, to) {
    const arr = playlist.sounds;
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length)
      return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    this.history = [];
    this.historyPos = -1;
    this.cycle.clear();
    this.currentIndex = this.currentRef ? arr.indexOf(this.currentRef) : -1;
    await this.saveSettings();
  }
  async deletePlaylist(id) {
    var _a, _b;
    const idx = this.settings.playlists.findIndex((p) => p.id === id);
    if (idx < 0)
      return;
    const [removed] = this.settings.playlists.splice(idx, 1);
    for (const s of removed.sounds)
      if (s.type === "file" && !this.fileReferenced(s.id))
        await this.deleteFile(s.id);
    if (this.settings.activePlaylistId === id)
      this.settings.activePlaylistId = (_b = (_a = this.settings.playlists[0]) == null ? void 0 : _a.id) != null ? _b : "";
    this.resetNavigation();
    await this.saveSettings();
  }
  async loadSettings() {
    var _a, _b, _c;
    const data = await this.loadData();
    const base = defaultSettings();
    this.settings = {
      playlists: (data == null ? void 0 : data.playlists) && data.playlists.length > 0 ? data.playlists : base.playlists,
      activePlaylistId: (_a = data == null ? void 0 : data.activePlaylistId) != null ? _a : base.activePlaylistId,
      volume: typeof (data == null ? void 0 : data.volume) === "number" ? data.volume : base.volume,
      leftClickAction: (data == null ? void 0 : data.leftClickAction) === "playpause" ? "playpause" : "next",
      shuffle: (data == null ? void 0 : data.shuffle) === true,
      repeatMode: (data == null ? void 0 : data.repeatMode) === "one" || (data == null ? void 0 : data.repeatMode) === "off" ? data.repeatMode : "auto"
    };
    if (!this.getActivePlaylist())
      this.settings.activePlaylistId = (_c = (_b = this.settings.playlists[0]) == null ? void 0 : _b.id) != null ? _c : "";
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var SoundersUI = class {
  constructor(containerEl, plugin) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.interval = 0;
    this.seek = null;
    this.curTimeEl = null;
    this.durTimeEl = null;
    this.playPauseIconEl = null;
    this.nowPlayingEl = null;
    this.shuffleEl = null;
    this.repeatEl = null;
    this.vol = null;
    this.volPercentEl = null;
    this.controlsEl = null;
    this.controlsMidEl = null;
    this.controlsResizeObs = null;
    this.listEl = null;
    this.trackRows = [];
    this.searchQuery = "";
    this.searchVisible = false;
    this.dragFrom = null;
    this.dragAutoScrollDir = 0;
    this.dragAutoScrollRaf = 0;
    this.dragAutoScrollCleanup = null;
    this.scrubbing = false;
  }
  getListScrollParent() {
    if (!this.listEl)
      return null;
    let p = this.listEl.parentElement;
    while (p && p !== document.body) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight)
        return p;
      p = p.parentElement;
    }
    const modal = this.listEl.closest(".modal-content");
    if (modal && modal.scrollHeight > modal.clientHeight)
      return modal;
    const tab = this.listEl.closest(".vertical-tab-content");
    if (tab && tab.scrollHeight > tab.clientHeight)
      return tab;
    return document.documentElement;
  }
  startDragAutoScroll() {
    this.stopDragAutoScroll();
    const scrollEl = this.getListScrollParent();
    const zone = 48;
    const speed = 10;
    const onDragOver = (e) => {
      if (this.dragFrom === null || !scrollEl)
        return;
      const rect = scrollEl.getBoundingClientRect();
      const y = e.clientY;
      if (y < rect.top + zone) {
        this.dragAutoScrollDir = -1;
        if (this.listEl) {
          this.listEl.toggleClass("sounders-drag-scroll-top", true);
          this.listEl.removeClass("sounders-drag-scroll-bottom");
        }
      } else if (y > rect.bottom - zone) {
        this.dragAutoScrollDir = 1;
        if (this.listEl) {
          this.listEl.toggleClass("sounders-drag-scroll-bottom", true);
          this.listEl.removeClass("sounders-drag-scroll-top");
        }
      } else {
        this.dragAutoScrollDir = 0;
        if (this.listEl) {
          this.listEl.removeClass("sounders-drag-scroll-top");
          this.listEl.removeClass("sounders-drag-scroll-bottom");
        }
      }
    };
    document.addEventListener("dragover", onDragOver);
    const tick = () => {
      if (this.dragFrom !== null && this.dragAutoScrollDir && scrollEl)
        scrollEl.scrollTop += this.dragAutoScrollDir * speed;
      this.dragAutoScrollRaf = requestAnimationFrame(tick);
    };
    this.dragAutoScrollRaf = requestAnimationFrame(tick);
    this.dragAutoScrollCleanup = () => {
      document.removeEventListener("dragover", onDragOver);
      if (this.dragAutoScrollRaf) {
        cancelAnimationFrame(this.dragAutoScrollRaf);
        this.dragAutoScrollRaf = 0;
      }
      this.dragAutoScrollDir = 0;
      if (this.listEl) {
        this.listEl.removeClass("sounders-drag-scroll-top");
        this.listEl.removeClass("sounders-drag-scroll-bottom");
      }
    };
  }
  stopDragAutoScroll() {
    if (this.dragAutoScrollCleanup) {
      this.dragAutoScrollCleanup();
      this.dragAutoScrollCleanup = null;
    }
  }
  setupInlineEdit(el, getValue, onCommit, cancelClick) {
    el.addClass("sounders-editable");
    (0, import_obsidian.setTooltip)(el, "Double-click to rename");
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (cancelClick)
        cancelClick();
      if (el.querySelector(".sounders-inline-edit"))
        return;
      const input = createEl("input", {
        cls: "sounders-inline-edit",
        attr: { type: "text" }
      });
      input.value = getValue();
      const finish = async (save) => {
        input.removeEventListener("blur", onBlur);
        if (save)
          await onCommit(input.value);
        if (input.parentElement)
          input.remove();
        el.style.display = "";
      };
      const onBlur = () => void finish(true);
      el.style.display = "none";
      el.after(input);
      input.focus();
      input.select();
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void finish(true);
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          void finish(false);
        }
      });
      input.addEventListener("blur", onBlur);
      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("mousedown", (ev) => ev.stopPropagation());
    });
  }
  render() {
    this.dispose();
    const c = this.containerEl;
    c.empty();
    const rerender = () => this.render();
    const lc = new import_obsidian.Setting(c).setName("Left click action").setDesc("What the sidebar button does on left click.");
    lc.addExtraButton((b) => {
      b.setIcon("skip-forward").setTooltip("Next track").onClick(async () => {
        this.plugin.settings.leftClickAction = "next";
        await this.plugin.saveSettings();
        rerender();
      });
      if (this.plugin.settings.leftClickAction === "next")
        b.extraSettingsEl.addClass("sounders-active");
    });
    lc.addExtraButton((b) => {
      b.setIcon("play").setTooltip("Play / pause").onClick(async () => {
        this.plugin.settings.leftClickAction = "playpause";
        await this.plugin.saveSettings();
        rerender();
      });
      if (this.plugin.settings.leftClickAction === "playpause")
        b.extraSettingsEl.addClass("sounders-active");
    });
    new import_obsidian.Setting(c).setName("Playlist").setDesc("The active playlist used by the player.").addDropdown((dd) => {
      for (const pl of this.plugin.settings.playlists)
        dd.addOption(pl.id, pl.name);
      dd.setValue(this.plugin.settings.activePlaylistId);
      dd.onChange((value) => {
        this.plugin.setActivePlaylist(value);
        rerender();
      });
    }).addExtraButton(
      (btn) => btn.setIcon("trash").setTooltip("Delete this playlist").onClick(async () => {
        const id = this.plugin.settings.activePlaylistId;
        if (id)
          await this.plugin.deletePlaylist(id);
        rerender();
      })
    );
    this.renderPlayer(c);
    new import_obsidian.Setting(c).addButton(
      (btn) => btn.setButtonText("Add sounds").setCta().onClick(() => this.plugin.pickAndAddSounds(rerender))
    ).addButton(
      (btn) => btn.setButtonText("Add folder as playlist").onClick(() => this.plugin.addFolderAsPlaylist(rerender))
    );
    const active = this.plugin.getActivePlaylist();
    const header = c.createDiv({ cls: "sounders-list-header" });
    const listTitleEl = header.createEl("h3", {
      text: active ? active.name : "No playlist",
      cls: "sounders-list-title"
    });
    if (active) {
      this.setupInlineEdit(
        listTitleEl,
        () => active.name,
        async (value) => {
          await this.plugin.renamePlaylist(active.id, value);
          rerender();
        }
      );
    }
    const searchBtn = header.createDiv({ cls: "sounders-player-btn" });
    (0, import_obsidian.setIcon)(searchBtn, "search");
    (0, import_obsidian.setTooltip)(searchBtn, "Search tracks");
    const searchInput = c.createEl("input", {
      cls: "sounders-search",
      attr: { type: "text", placeholder: "Search tracks..." }
    });
    searchInput.value = this.searchQuery;
    searchInput.style.display = this.searchVisible ? "block" : "none";
    searchBtn.addEventListener("click", () => {
      this.searchVisible = !this.searchVisible;
      if (this.searchVisible) {
        searchInput.style.display = "block";
        searchInput.focus();
      } else {
        searchInput.style.display = "none";
        this.searchQuery = "";
        searchInput.value = "";
        this.renderTrackList();
      }
    });
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.renderTrackList();
    });
    this.listEl = c.createDiv({ cls: "sounders-list" });
    this.renderTrackList();
    this.plugin.setPlaybackListener(() => this.updatePlayer());
    this.interval = window.setInterval(() => this.updatePlayer(), 250);
    this.updatePlayer();
  }
  renderTrackList() {
    const list = this.listEl;
    if (!list)
      return;
    list.empty();
    this.trackRows = [];
    const active = this.plugin.getActivePlaylist();
    if (!active || active.sounds.length === 0) {
      list.createEl("p", {
        text: "This playlist has no sounds yet.",
        cls: "sounders-empty"
      });
      return;
    }
    const q = this.searchQuery.trim().toLowerCase();
    const draggable = q.length === 0;
    active.sounds.forEach((ref, index) => {
      var _a;
      const name = this.plugin.trackName(ref);
      const artist = (_a = ref.artist) != null ? _a : "";
      if (q && !name.toLowerCase().includes(q) && !artist.toLowerCase().includes(q))
        return;
      const subtitle = ref.type === "preset" ? "Built-in" : artist;
      const setting = new import_obsidian.Setting(list).setName(name);
      if (subtitle)
        setting.setDesc(subtitle);
      setting.addExtraButton((btn) => {
        btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
          await this.plugin.removeSoundAt(active, index);
          this.renderTrackList();
        });
        btn.extraSettingsEl.addEventListener(
          "click",
          (e) => e.stopPropagation()
        );
      });
      const el = setting.settingEl;
      el.addClass("sounders-track");
      if (index === this.plugin.currentIndex)
        el.addClass("sounders-track-active");
      this.trackRows.push({ index, el });
      let clickTimer = 0;
      const cancelPlayClick = () => {
        window.clearTimeout(clickTimer);
        clickTimer = 0;
      };
      el.addEventListener("click", (e) => {
        if (e.target.closest(".sounders-drag-handle"))
          return;
        if (e.target.closest(".setting-item-control"))
          return;
        if (e.target.closest(".sounders-inline-edit"))
          return;
        cancelPlayClick();
        clickTimer = window.setTimeout(() => void this.plugin.playAt(index), 220);
      });
      this.setupInlineEdit(
        setting.nameEl,
        () => this.plugin.trackName(ref),
        async (value) => {
          await this.plugin.renameTrackDisplay(active, index, value);
          this.renderTrackList();
          this.updatePlayer();
        },
        cancelPlayClick
      );
      if (ref.type !== "preset" && setting.descEl) {
        this.setupInlineEdit(
          setting.descEl,
          () => ref.artist || "",
          async (value) => {
            await this.plugin.renameTrackArtist(active, index, value);
            this.renderTrackList();
          },
          cancelPlayClick
        );
      }
      if (draggable) {
        const handle = createDiv({ cls: "sounders-drag-handle" });
        (0, import_obsidian.setIcon)(handle, "grip-vertical");
        (0, import_obsidian.setTooltip)(handle, "Drag to reorder");
        handle.setAttribute("draggable", "true");
        el.prepend(handle);
        handle.addEventListener("click", (e) => e.stopPropagation());
        handle.addEventListener("dragstart", (e) => {
          var _a2;
          this.dragFrom = index;
          (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData("text/plain", String(index));
          el.addClass("sounders-dragging");
          this.startDragAutoScroll();
        });
        handle.addEventListener(
          "dragend",
          () => {
            el.removeClass("sounders-dragging");
            this.dragFrom = null;
            this.stopDragAutoScroll();
          }
        );
        el.addEventListener("dragover", (e) => {
          e.preventDefault();
          el.addClass("sounders-dragover");
        });
        el.addEventListener(
          "dragleave",
          () => el.removeClass("sounders-dragover")
        );
        el.addEventListener("drop", async (e) => {
          e.preventDefault();
          el.removeClass("sounders-dragover");
          const from = this.dragFrom;
          this.dragFrom = null;
          if (from === null || from === index)
            return;
          await this.plugin.reorderSound(active, from, index);
          this.renderTrackList();
        });
      }
    });
  }
  createSlider(parent, extraCls, handlers) {
    const root = parent.createDiv({
      cls: "sounders-bar" + (extraCls ? " " + extraCls : "")
    });
    root.createDiv({ cls: "sounders-bar-track" });
    root.createDiv({ cls: "sounders-bar-fill" });
    const ghost = root.createDiv({ cls: "sounders-bar-ghost" });
    root.createDiv({ cls: "sounders-bar-knob" });
    let value = 0;
    let disabled = false;
    let dragging = false;
    const clamp = (n) => Math.max(0, Math.min(1, n));
    const fracAt = (e) => {
      const r = root.getBoundingClientRect();
      if (r.width <= 0)
        return 0;
      return clamp((e.clientX - r.left) / r.width);
    };
    const paint = () => {
      root.style.setProperty("--p", value * 100 + "%");
    };
    const paintGhost = (hover) => {
      const lo = Math.min(value, hover);
      const hi = Math.max(value, hover);
      ghost.style.left = lo * 100 + "%";
      ghost.style.width = (hi - lo) * 100 + "%";
    };
    const clearGhost = () => {
      ghost.style.width = "0";
    };
    root.addEventListener("pointerenter", () => {
      root.addClass("is-hovered");
    });
    root.addEventListener("pointerleave", () => {
      if (dragging)
        return;
      root.removeClass("is-hovered");
      clearGhost();
    });
    root.addEventListener("pointermove", (e) => {
      if (disabled)
        return;
      paintGhost(fracAt(e));
      if (dragging) {
        value = fracAt(e);
        paint();
        if (handlers.onScrub)
          handlers.onScrub(value);
      }
    });
    root.addEventListener("pointerdown", (e) => {
      if (disabled || e.button !== 0)
        return;
      dragging = true;
      root.addClass("is-hovered");
      try {
        root.setPointerCapture(e.pointerId);
      } catch (_) {
      }
      value = fracAt(e);
      paint();
      paintGhost(value);
      if (handlers.onScrub)
        handlers.onScrub(value);
    });
    const finish = (e) => {
      if (!dragging)
        return;
      dragging = false;
      try {
        root.releasePointerCapture(e.pointerId);
      } catch (_) {
      }
      value = fracAt(e);
      paint();
      if (handlers.onCommit)
        handlers.onCommit(value);
    };
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    return {
      el: root,
      setFraction(f) {
        if (dragging)
          return;
        value = clamp(f);
        paint();
      },
      setDisabled(on) {
        disabled = on;
        root.toggleClass("is-disabled", on);
      }
    };
  }
  layoutControlsGap() {
    const root = this.controlsEl;
    const mid = this.controlsMidEl;
    if (!root || !mid)
      return;
    const m = mid.clientWidth;
    if (m <= 0)
      return;
    const playR = ((this.playPauseIconEl == null ? void 0 : this.playPauseIconEl.offsetWidth) || 44) / 2;
    const sliderMin = 24;
    const leftSide = mid.querySelector(".sounders-controls-left");
    const rightBtns = mid.querySelector(".sounders-controls-btns");
    const volIcon = mid.querySelector(".sounders-vol-icon");
    const pick = (nodes, fallback) => {
      if (!nodes || nodes.length < 2)
        return fallback;
      return nodes[0].offsetWidth + nodes[1].offsetWidth;
    };
    const leftPair = pick(leftSide == null ? void 0 : leftSide.children, 46);
    const wNext = (rightBtns == null ? void 0 : rightBtns.children[0]) ? rightBtns.children[0].offsetWidth : 18;
    const wRepeat = (rightBtns == null ? void 0 : rightBtns.children[1]) ? rightBtns.children[1].offsetWidth : 28;
    const wVolIcon = (volIcon == null ? void 0 : volIcon.offsetWidth) || 16;
    const half = m / 2;
    const gLeft = (half - leftPair - playR) / 2;
    const gRight = (half - playR - wNext - wRepeat - wVolIcon - sliderMin) / 3.5;
    const g = Math.max(6, Math.min(18, Math.floor(Math.min(gLeft, gRight))));
    root.style.setProperty("--sounders-btn-gap", g + "px");
    root.style.setProperty("--sounders-vol-gap", g * 0.5 + "px");
    root.style.setProperty("--sounders-play-r", playR + "px");
  }
  renderPlayer(parent) {
    const player = parent.createDiv({ cls: "sounders-player" });
    this.nowPlayingEl = player.createDiv({ cls: "sounders-nowplaying" });
    this.curTimeEl = player.createSpan({
      cls: "sounders-edge sounders-edge-left",
      text: "0:00"
    });
    const seekDuration = () => {
      const a = this.plugin.currentAudio;
      return a && isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
    };
    this.seek = this.createSlider(player, "sounders-seek", {
      onScrub: (f) => {
        var _a;
        this.scrubbing = true;
        const t = f * seekDuration();
        this.plugin.seek(t);
        (_a = this.curTimeEl) == null ? void 0 : _a.setText(formatTime(t));
      },
      onCommit: (f) => {
        this.plugin.seek(f * seekDuration());
        this.scrubbing = false;
      }
    });
    this.durTimeEl = player.createSpan({
      cls: "sounders-edge sounders-edge-right",
      text: "0:00"
    });
    const controls = player.createDiv({ cls: "sounders-controls" });
    this.controlsEl = controls;
    const grid = controls.createDiv({ cls: "sounders-controls-grid" });
    grid.createDiv({ cls: "sounders-controls-anchor" });
    const mid = grid.createDiv({ cls: "sounders-controls-mid" });
    this.controlsMidEl = mid;
    const sideLeft = mid.createDiv({
      cls: "sounders-controls-side sounders-controls-left"
    });
    this.shuffleEl = sideLeft.createDiv({
      cls: "sounders-player-btn sounders-toggle"
    });
    (0, import_obsidian.setIcon)(this.shuffleEl, "shuffle");
    this.shuffleEl.addEventListener("click", () => this.plugin.toggleShuffle());
    const prev = sideLeft.createDiv({ cls: "sounders-player-btn" });
    (0, import_obsidian.setIcon)(prev, "skip-back");
    prev.setAttribute("aria-label", "Previous");
    prev.addEventListener("click", () => void this.plugin.playPrevious());
    const sideRight = mid.createDiv({
      cls: "sounders-controls-side sounders-controls-right"
    });
    const rightBtns = sideRight.createDiv({ cls: "sounders-controls-btns" });
    const next = rightBtns.createDiv({ cls: "sounders-player-btn" });
    (0, import_obsidian.setIcon)(next, "skip-forward");
    next.setAttribute("aria-label", "Next");
    next.addEventListener("click", () => void this.plugin.playNext());
    this.repeatEl = rightBtns.createDiv({
      cls: "sounders-player-btn sounders-toggle"
    });
    (0, import_obsidian.setIcon)(this.repeatEl, "repeat");
    this.repeatEl.addEventListener("click", () => this.plugin.cycleRepeatMode());
    const volIcon = rightBtns.createDiv({ cls: "sounders-vol-icon" });
    (0, import_obsidian.setIcon)(volIcon, "volume-2");
    const applyVolume = (v) => {
      var _a;
      this.plugin.settings.volume = v;
      if (this.plugin.currentAudio)
        this.plugin.currentAudio.volume = v;
      (_a = this.volPercentEl) == null ? void 0 : _a.setText(Math.round(v * 100) + "%");
    };
    this.vol = this.createSlider(sideRight, "sounders-vol", {
      onScrub: (f) => applyVolume(f),
      onCommit: (f) => {
        applyVolume(f);
        void this.plugin.saveSettings();
      }
    });
    this.volPercentEl = grid.createSpan({
      cls: "sounders-edge sounders-edge-right sounders-vol-percent",
      text: Math.round(this.plugin.settings.volume * 100) + "%"
    });
    const pp = controls.createDiv({
      cls: "sounders-player-btn sounders-playpause"
    });
    (0, import_obsidian.setIcon)(pp, "play");
    pp.setAttribute("aria-label", "Play / pause");
    pp.addEventListener("click", () => this.plugin.togglePlayPause());
    this.playPauseIconEl = pp;
    this.vol.setFraction(this.plugin.settings.volume);
    if (this.controlsResizeObs)
      this.controlsResizeObs.disconnect();
    this.controlsResizeObs = new ResizeObserver(() => this.layoutControlsGap());
    this.controlsResizeObs.observe(mid);
    requestAnimationFrame(() => this.layoutControlsGap());
  }
  updatePlayer() {
    var _a, _b, _c, _d;
    const audio = this.plugin.currentAudio;
    const playing = !!audio && !audio.paused;
    if (this.playPauseIconEl)
      (0, import_obsidian.setIcon)(this.playPauseIconEl, playing ? "pause" : "play");
    if (this.nowPlayingEl)
      this.nowPlayingEl.setText(this.plugin.getNowPlayingLabel());
    if (this.shuffleEl) {
      const on = this.plugin.settings.shuffle;
      this.shuffleEl.toggleClass("sounders-btn-on", on);
      (0, import_obsidian.setTooltip)(this.shuffleEl, on ? "Shuffle: on" : "Shuffle: off");
    }
    if (this.repeatEl) {
      const m = this.plugin.settings.repeatMode;
      (0, import_obsidian.setIcon)(this.repeatEl, m === "one" ? "repeat-1" : "repeat");
      this.repeatEl.toggleClass("sounders-btn-on", m !== "off");
      (0, import_obsidian.setTooltip)(
        this.repeatEl,
        m === "auto" ? "Autoplay: on" : m === "one" ? "Repeat current track" : "Autoplay: off"
      );
    }
    for (const row of this.trackRows)
      row.el.toggleClass(
        "sounders-track-active",
        row.index === this.plugin.currentIndex
      );
    if (!this.seek)
      return;
    if (audio && isFinite(audio.duration) && audio.duration > 0) {
      if (!this.scrubbing) {
        this.seek.setFraction(audio.currentTime / audio.duration);
        (_a = this.curTimeEl) == null ? void 0 : _a.setText(formatTime(audio.currentTime));
      }
      this.seek.setDisabled(false);
      (_b = this.durTimeEl) == null ? void 0 : _b.setText(formatTime(audio.duration));
    } else {
      this.seek.setDisabled(true);
      this.seek.setFraction(0);
      (_c = this.curTimeEl) == null ? void 0 : _c.setText("0:00");
      (_d = this.durTimeEl) == null ? void 0 : _d.setText("0:00");
    }
  }
  dispose() {
    this.stopDragAutoScroll();
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = 0;
    }
    if (this.controlsResizeObs) {
      this.controlsResizeObs.disconnect();
      this.controlsResizeObs = null;
    }
    this.plugin.setPlaybackListener(null);
  }
};
function setSoundersTitle(el) {
  if (!el)
    return;
  el.empty();
  el.addClass("sounders-title");
  el.createSpan({ text: "Sounders" });
  const byline = el.createEl("a", {
    cls: "sounders-byline",
    text: "by Razzdol :)",
    href: "https://github.com/Razzdol"
  });
  byline.setAttr("target", "_blank");
  byline.setAttr("rel", "noopener noreferrer");
  byline.addEventListener("click", (e) => {
    e.preventDefault();
    window.open("https://github.com/Razzdol");
  });
}
var SettingsModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.ui = null;
  }
  onOpen() {
    setSoundersTitle(this.titleEl);
    this.ui = new SoundersUI(this.contentEl, this.plugin);
    this.ui.render();
  }
  onClose() {
    var _a;
    (_a = this.ui) == null ? void 0 : _a.dispose();
    this.contentEl.empty();
  }
};
var SoundersSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.ui = null;
  }
  display() {
    var _a;
    setSoundersTitle(
      (_a = this.containerEl.parentElement) == null ? void 0 : _a.querySelector(".setting-item-name")
    );
    this.ui = new SoundersUI(this.containerEl, this.plugin);
    this.ui.render();
  }
  hide() {
    var _a;
    (_a = this.ui) == null ? void 0 : _a.dispose();
  }
};
