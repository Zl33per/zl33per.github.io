(function () {
  "use strict";

  const MAX_PER_TEAM = 10;
  const STORAGE_KEY = "frisbee_tactics_v1";
  const EXPORT_FORMAT = "frisbee-tactic-v1";
  const PLAYBACK_SPEED_KEY = "frisbee_playback_speed_v1";
  const SAMPLE_MS = 40;

  const field = document.getElementById("field");
  const entitiesLayer = document.getElementById("entitiesLayer");
  const statusText = document.getElementById("statusText");
  const branchHint = document.getElementById("branchHint");
  const recDot = document.getElementById("recDot");

  const btnRecord = document.getElementById("btnRecord");
  const btnFork = document.getElementById("btnFork");
  const btnEndBranch = document.getElementById("btnEndBranch");
  const btnSave = document.getElementById("btnSave");
  const btnPlay = document.getElementById("btnPlay");
  const btnStopPlay = document.getElementById("btnStopPlay");
  const btnLibrary = document.getElementById("btnLibrary");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const importFile = document.getElementById("importFile");

  const addRed = document.getElementById("addRed");
  const removeRed = document.getElementById("removeRed");
  const addBlue = document.getElementById("addBlue");
  const removeBlue = document.getElementById("removeBlue");

  const libraryPanel = document.getElementById("libraryPanel");
  const libraryBackdrop = document.getElementById("libraryBackdrop");
  const tacticList = document.getElementById("tacticList");
  const libraryEmpty = document.getElementById("libraryEmpty");

  const saveModal = document.getElementById("saveModal");
  const saveNameInput = document.getElementById("saveNameInput");
  const saveCancel = document.getElementById("saveCancel");
  const saveConfirm = document.getElementById("saveConfirm");

  const playModal = document.getElementById("playModal");
  const playPathInput = document.getElementById("playPathInput");
  const playStepMode = document.getElementById("playStepMode");
  const playCancel = document.getElementById("playCancel");
  const playStart = document.getElementById("playStart");
  const playSpeedSlider = document.getElementById("playSpeedSlider");
  const playSpeedLabel = document.getElementById("playSpeedLabel");

  const forkOverlay = document.getElementById("forkOverlay");
  const forkChoiceButtons = document.getElementById("forkChoiceButtons");

  const discSvg =
    '<svg class="disc-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#c7c7cc" stroke-width="1.2"/><path d="M8 16c2.5-4 13.5-4 16 0-2.5 4-13.5 4-16 0z" fill="none" stroke="#ff9500" stroke-width="1.4"/><ellipse cx="16" cy="16" rx="10" ry="4" fill="none" stroke="#34c759" stroke-width="1"/></svg>';

  let redNumbers = [];
  let blueNumbers = [];
  let recording = false;
  let recordTimer = null;
  let rootNode = null;
  let currentNode = null;
  let lastTacticTree = null;
  let currentTacticName = "";

  let playing = false;
  let playAbort = null;
  let playStepModeActive = false;
  let playPathQueue = [];

  function createNode(parent) {
    return {
      frames: [],
      forkIndex: null,
      branches: Object.create(null),
      nextBranchId: 1,
      parent: parent || null,
    };
  }

  function cloneNodeData(n) {
    return {
      frames: n.frames.map((f) => JSON.parse(JSON.stringify(f))),
      forkIndex: n.forkIndex,
      branches: {},
      nextBranchId: n.nextBranchId,
      parent: null,
    };
  }

  function deepCloneTree(node, parent) {
    const c = cloneNodeData(node);
    c.parent = parent;
    for (const k of Object.keys(node.branches)) {
      c.branches[k] = deepCloneTree(node.branches[k], c);
    }
    return c;
  }

  function serializeTree(node) {
    const o = {
      frames: node.frames,
      forkIndex: node.forkIndex,
      nextBranchId: node.nextBranchId,
      branches: {},
    };
    for (const k of Object.keys(node.branches)) {
      o.branches[k] = serializeTree(node.branches[k]);
    }
    return o;
  }

  function sanitizeFilename(name) {
    const s = String(name || "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .trim();
    return s || "tactic";
  }

  function isValidTacticPayload(data) {
    if (!data || typeof data !== "object") return false;
    if (data.format != null && data.format !== EXPORT_FORMAT) return false;
    const tree = data.tree;
    if (!tree || typeof tree !== "object" || !Array.isArray(tree.frames)) return false;
    return true;
  }

  function deserializeTree(data, parent) {
    const n = createNode(parent);
    n.frames = data.frames || [];
    n.forkIndex = data.forkIndex == null ? null : data.forkIndex;
    n.nextBranchId = data.nextBranchId || 1;
    for (const k of Object.keys(data.branches || {})) {
      n.branches[k] = deserializeTree(data.branches[k], n);
    }
    return n;
  }

  function pctToStyle(xPct, yPct) {
    return { left: xPct + "%", top: yPct + "%" };
  }

  function getFieldRect() {
    return field.getBoundingClientRect();
  }

  function clientToPct(clientX, clientY) {
    const r = getFieldRect();
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    };
  }

  function elementPct(el) {
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    return { x: left, y: top };
  }

  function captureState() {
    const discEl = entitiesLayer.querySelector('[data-kind="disc"]');
    const state = {
      disc: elementPct(discEl),
      red: {},
      blue: {},
    };
    entitiesLayer.querySelectorAll('[data-kind="red"]').forEach((el) => {
      const n = el.dataset.num;
      state.red[n] = elementPct(el);
    });
    entitiesLayer.querySelectorAll('[data-kind="blue"]').forEach((el) => {
      const n = el.dataset.num;
      state.blue[n] = elementPct(el);
    });
    return state;
  }

  function applyState(state) {
    const discEl = entitiesLayer.querySelector('[data-kind="disc"]');
    if (discEl && state.disc) Object.assign(discEl.style, pctToStyle(state.disc.x, state.disc.y));
    for (const k of Object.keys(state.red || {})) {
      const el = entitiesLayer.querySelector(`[data-kind="red"][data-num="${k}"]`);
      if (el) Object.assign(el.style, pctToStyle(state.red[k].x, state.red[k].y));
    }
    for (const k of Object.keys(state.blue || {})) {
      const el = entitiesLayer.querySelector(`[data-kind="blue"][data-num="${k}"]`);
      if (el) Object.assign(el.style, pctToStyle(state.blue[k].x, state.blue[k].y));
    }
  }

  function ensureDisc() {
    if (entitiesLayer.querySelector('[data-kind="disc"]')) return;
    const el = document.createElement("div");
    el.className = "entity entity--disc";
    el.dataset.kind = "disc";
    el.innerHTML = discSvg;
    Object.assign(el.style, pctToStyle(50, 50));
    bindDrag(el);
    entitiesLayer.appendChild(el);
  }

  function addPlayer(team) {
    const nums = team === "red" ? redNumbers : blueNumbers;
    if (nums.length >= MAX_PER_TEAM) return;
    let n = 1;
    while (nums.includes(n)) n++;
    nums.push(n);
    nums.sort((a, b) => a - b);
    const el = document.createElement("div");
    el.className = "entity " + (team === "red" ? "entity--red" : "entity--blue");
    el.dataset.kind = team;
    el.dataset.num = String(n);
    el.textContent = String(n);
    const y = 12 + (nums.length - 1) * 8;
    const x = team === "red" ? 12 : 88;
    Object.assign(el.style, pctToStyle(x, y));
    bindDrag(el);
    entitiesLayer.appendChild(el);
    updateStatus();
  }

  function removePlayer(team) {
    const nums = team === "red" ? redNumbers : blueNumbers;
    if (!nums.length) return;
    const last = nums[nums.length - 1];
    nums.pop();
    const el = entitiesLayer.querySelector(`[data-kind="${team}"][data-num="${last}"]`);
    if (el) el.remove();
    updateStatus();
  }

  function rebuildEntitiesFromState(state) {
    entitiesLayer.querySelectorAll('[data-kind="red"],[data-kind="blue"]').forEach((e) => e.remove());
    redNumbers = [];
    blueNumbers = [];
    const rk = Object.keys(state.red || {})
      .map(Number)
      .sort((a, b) => a - b);
    const bk = Object.keys(state.blue || {})
      .map(Number)
      .sort((a, b) => a - b);
    rk.forEach((n) => {
      redNumbers.push(n);
      const el = document.createElement("div");
      el.className = "entity entity--red";
      el.dataset.kind = "red";
      el.dataset.num = String(n);
      el.textContent = String(n);
      bindDrag(el);
      entitiesLayer.appendChild(el);
    });
    bk.forEach((n) => {
      blueNumbers.push(n);
      const el = document.createElement("div");
      el.className = "entity entity--blue";
      el.dataset.kind = "blue";
      el.dataset.num = String(n);
      el.textContent = String(n);
      bindDrag(el);
      entitiesLayer.appendChild(el);
    });
    ensureDisc();
    applyState(state);
  }

  function firstFrameOfTree(node) {
    if (node && node.frames && node.frames.length) return node.frames[0];
    return null;
  }

  function bindDrag(el) {
    let ptrId = null;
    const onMove = (e) => {
      if (e.pointerId !== ptrId || playing) return;
      const p = clientToPct(e.clientX, e.clientY);
      Object.assign(el.style, pctToStyle(p.x, p.y));
    };
    const onUp = (e) => {
      if (e.pointerId !== ptrId) return;
      ptrId = null;
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointerdown", (e) => {
      if (playing) return;
      e.preventDefault();
      ptrId = e.pointerId;
      el.setPointerCapture(ptrId);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  }

  function updateExportImportUi() {
    const hasTactic = !!(lastTacticTree && lastTacticTree.frames && lastTacticTree.frames.length);
    btnExport.disabled = !hasTactic || playing || recording;
    btnImport.disabled = playing || recording;
  }

  function setPlayingUi(on) {
    playing = on;
    entitiesLayer.querySelectorAll(".entity").forEach((el) => {
      el.classList.toggle("playing", on);
    });
    btnRecord.disabled = on;
    btnFork.disabled = on || !recording;
    btnEndBranch.disabled = on || !recording;
    btnSave.disabled = on || !recording;
    addRed.disabled = on;
    removeRed.disabled = on;
    addBlue.disabled = on;
    removeBlue.disabled = on;
    btnStopPlay.disabled = !on;
    updateExportImportUi();
  }

  function updateStatus() {
    const r = redNumbers.length;
    const b = blueNumbers.length;
    if (recording) {
      statusText.textContent = `录制中 · 红${r} 蓝${b}`;
    } else if (playing) {
      statusText.textContent = "播放中";
    } else {
      statusText.textContent = `编辑模式 · 红${r} 蓝${b}`;
    }
  }

  function updateBranchHint() {
    if (!recording || !currentNode) {
      branchHint.textContent = "";
      return;
    }
    const pid = currentNode.parent;
    if (pid && pid.forkIndex != null) {
      const keys = Object.keys(pid.branches).map(Number).sort((a, b) => a - b);
      const idx = keys.findIndex((k) => pid.branches[k] === currentNode);
      branchHint.textContent =
        idx >= 0 ? `当前分叉下：第 ${keys[idx]} 条分支` : "";
    } else {
      branchHint.textContent = currentNode.parent ? "" : "主路径录制中（未分叉）";
    }
  }

  function tickRecord() {
    if (!recording || !currentNode || playing) return;
    const st = captureState();
    currentNode.frames.push(st);
  }

  function startRecording() {
    ensureDisc();
    if (!redNumbers.length && !blueNumbers.length) {
      addPlayer("red");
      addPlayer("blue");
    } else {
      ensureDisc();
    }
    recording = true;
    rootNode = createNode(null);
    currentNode = rootNode;
    recDot.classList.add("on");
    btnRecord.textContent = "停止录制";
    btnFork.disabled = false;
    btnEndBranch.disabled = true;
    btnSave.disabled = false;
    recordTimer = setInterval(tickRecord, SAMPLE_MS);
    tickRecord();
    updateStatus();
    updateBranchHint();
  }

  function stopRecording() {
    recording = false;
    recDot.classList.remove("on");
    btnRecord.textContent = "录制";
    btnFork.disabled = true;
    btnEndBranch.disabled = true;
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
    lastTacticTree = deepCloneTree(rootNode, null);
    btnPlay.disabled = !lastTacticTree || !lastTacticTree.frames.length;
    currentTacticName = "";
    updateStatus();
    branchHint.textContent = lastTacticTree
      ? "录制已停止，可保存或播放"
      : "";
    updateExportImportUi();
  }

  function onFork() {
    if (!recording || !currentNode || playing) return;
    if (currentNode.frames.length < 1) {
      branchHint.textContent = "请先拖动队员产生至少一帧再设分叉";
      return;
    }
    currentNode.forkIndex = currentNode.frames.length - 1;
    const bid = currentNode.nextBranchId++;
    const child = createNode(currentNode);
    currentNode.branches[String(bid)] = child;
    currentNode = child;
    btnEndBranch.disabled = false;
    branchHint.textContent = `已设分叉，正在录制第 ${bid} 条分支`;
    updateBranchHint();
  }

  function onEndBranch() {
    if (!recording || playing) return;
    const parent = currentNode.parent;
    if (!parent || parent.forkIndex == null) {
      branchHint.textContent = "当前不在分支上，无法结束分叉";
      return;
    }
    const bid = parent.nextBranchId++;
    const sibling = createNode(parent);
    parent.branches[String(bid)] = sibling;
    currentNode = sibling;
    const snap = parent.frames[parent.forkIndex];
    if (snap) applyState(snap);
    tickRecord();
    branchHint.textContent = `已结束上一分支，开始录制第 ${bid} 条分支`;
    updateBranchHint();
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLibrary(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function openSaveModal() {
    if (!lastTacticTree || !lastTacticTree.frames.length) return;
    saveNameInput.value = currentTacticName || "未命名战术";
    saveModal.hidden = false;
    saveNameInput.focus();
  }

  function closeSaveModal() {
    saveModal.hidden = true;
  }

  function confirmSave() {
    const name = (saveNameInput.value || "").trim() || "未命名战术";
    const list = loadLibrary().filter((t) => t.name !== name);
    list.push({
      name,
      savedAt: Date.now(),
      tree: serializeTree(lastTacticTree),
    });
    list.sort((a, b) => b.savedAt - a.savedAt);
    saveLibrary(list);
    currentTacticName = name;
    closeSaveModal();
    branchHint.textContent = `已保存「${name}」`;
    updateExportImportUi();
  }

  function exportTacticJson() {
    if (!lastTacticTree || !lastTacticTree.frames.length) return;
    const payload = {
      format: EXPORT_FORMAT,
      name: currentTacticName || "未命名战术",
      savedAt: Date.now(),
      tree: serializeTree(lastTacticTree),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilename(payload.name) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    branchHint.textContent = `已导出「${payload.name}.json」`;
  }

  function applyImportedTactic(data) {
    const treeData = data.tree;
    lastTacticTree = deserializeTree(treeData, null);
    currentTacticName = (data.name && String(data.name).trim()) || "导入的战术";
    btnPlay.disabled = !lastTacticTree.frames.length;
    const first = firstFrameOfTree(lastTacticTree);
    if (first) rebuildEntitiesFromState(first);
    branchHint.textContent = `已导入「${currentTacticName}」`;
    updateExportImportUi();
  }

  function importTacticFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        if (!isValidTacticPayload(data)) {
          throw new Error(
            "不是有效的战术 JSON（需包含 tree，且 tree.frames 为数组；可选 format: frisbee-tactic-v1）"
          );
        }
        if (!data.tree.frames.length) {
          throw new Error("战术数据为空");
        }
        applyImportedTactic(data);
      } catch (err) {
        const msg = err instanceof SyntaxError ? "JSON 解析失败" : err.message || String(err);
        window.alert("导入失败：" + msg);
      }
    };
    reader.onerror = () => window.alert("读取文件失败");
    reader.readAsText(file, "utf-8");
  }

  function syncPlaybackSpeedLabel() {
    const v = parseFloat(playSpeedSlider.value);
    const n = Number.isFinite(v) ? v : 1;
    const rounded = Math.round(n * 100) / 100;
    playSpeedLabel.textContent = rounded + "×";
  }

  function loadPlaybackSpeedPreference() {
    try {
      const raw = localStorage.getItem(PLAYBACK_SPEED_KEY);
      if (raw == null) return;
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v >= 0.25 && v <= 2.5) {
        playSpeedSlider.value = String(v);
      }
    } catch {}
    syncPlaybackSpeedLabel();
  }

  function renderLibrary() {
    const list = loadLibrary();
    tacticList.innerHTML = "";
    libraryEmpty.style.display = list.length ? "none" : "block";
    const fmt = (t) => {
      const d = new Date(t);
      return d.toLocaleString();
    };
    list.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="name"></span><span class="meta"></span><span class="row-actions"></span>`;
      li.querySelector(".name").textContent = item.name;
      li.querySelector(".meta").textContent = fmt(item.savedAt);
      const actions = li.querySelector(".row-actions");
      const bPlay = document.createElement("button");
      bPlay.type = "button";
      bPlay.className = "btn btn--primary btn-mini";
      bPlay.textContent = "播放";
      bPlay.addEventListener("click", () => {
        libraryPanel.hidden = true;
        lastTacticTree = deserializeTree(item.tree, null);
        currentTacticName = item.name;
        btnPlay.disabled = false;
        updateExportImportUi();
        openPlayModal();
      });
      const bDel = document.createElement("button");
      bDel.type = "button";
      bDel.className = "btn btn--secondary btn-mini";
      bDel.textContent = "删除";
      bDel.addEventListener("click", () => {
        const next = loadLibrary().filter((x) => x.name !== item.name);
        saveLibrary(next);
        renderLibrary();
      });
      actions.appendChild(bPlay);
      actions.appendChild(bDel);
      tacticList.appendChild(li);
    });
  }

  function openPlayModal() {
    playPathInput.value = "";
    playStepMode.checked = false;
    loadPlaybackSpeedPreference();
    playModal.hidden = false;
  }

  function closePlayModal() {
    playModal.hidden = true;
  }

  function parsePath(str) {
    if (!str || !String(str).trim()) return [];
    return String(str)
      .trim()
      .split(/[.\s]+/)
      .filter(Boolean)
      .map((x) => parseInt(x, 10))
      .filter((n) => !isNaN(n) && n >= 1);
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
      const t = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort);
    });
  }

  async function animateFrames(frames, signal, frameMs) {
    const ms = frameMs != null && frameMs > 0 ? frameMs : SAMPLE_MS;
    if (!frames.length) return;
    applyState(frames[0]);
    for (let i = 1; i < frames.length; i++) {
      await sleep(ms, signal);
      if (signal.aborted) return;
      applyState(frames[i]);
    }
  }

  async function playNodeDepthFirst(node, pathQueue, signal, frameMs) {
    if (!node || !node.frames.length) return;
    const fi = node.forkIndex;
    if (fi == null) {
      await animateFrames(node.frames, signal, frameMs);
      return;
    }
    const head = node.frames.slice(0, fi + 1);
    await animateFrames(head, signal, frameMs);
    if (signal.aborted) return;
    const keys = Object.keys(node.branches).map(Number).sort((a, b) => a - b);
    if (!keys.length) return;
    let choice;
    if (playStepModeActive) {
      choice = await waitForkChoice(keys, signal);
    } else {
      choice = pathQueue.length ? pathQueue.shift() : keys[0];
      if (!keys.includes(choice)) choice = keys[0];
    }
    const next = node.branches[String(choice)];
    if (next) await playNodeDepthFirst(next, pathQueue, signal, frameMs);
  }

  function waitForkChoice(keys, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
      forkOverlay.hidden = false;
      forkChoiceButtons.innerHTML = "";
      const clean = () => {
        forkOverlay.hidden = true;
        forkChoiceButtons.innerHTML = "";
      };
      keys.forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn--primary";
        b.textContent = String(k);
        b.addEventListener("click", () => {
          clean();
          resolve(k);
        });
        forkChoiceButtons.appendChild(b);
      });
      const onAbort = () => {
        clean();
        reject(new DOMException("aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function runPlayback() {
    if (!lastTacticTree) return;
    const first = firstFrameOfTree(lastTacticTree);
    if (first) rebuildEntitiesFromState(first);
    const ac = new AbortController();
    playAbort = ac;
    setPlayingUi(true);
    closePlayModal();
    updateStatus();
    playStepModeActive = playStepMode.checked;
    playPathQueue = parsePath(playPathInput.value);
    const speed = parseFloat(playSpeedSlider.value);
    const sp = Number.isFinite(speed) && speed > 0 ? speed : 1;
    const frameMs = SAMPLE_MS / sp;
    try {
      await playNodeDepthFirst(lastTacticTree, playPathQueue, ac.signal, frameMs);
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
    setPlayingUi(false);
    branchHint.textContent = currentTacticName ? `战术「${currentTacticName}」播放结束` : "播放结束";
    updateStatus();
    playAbort = null;
  }

  function stopPlayback() {
    if (playAbort) playAbort.abort();
    forkOverlay.hidden = true;
  }

  btnRecord.addEventListener("click", () => {
    if (playing) return;
    if (recording) stopRecording();
    else startRecording();
  });

  btnFork.addEventListener("click", onFork);
  btnEndBranch.addEventListener("click", onEndBranch);

  btnSave.addEventListener("click", () => {
    if (recording) {
      branchHint.textContent = "请先停止录制再保存";
      return;
    }
    openSaveModal();
  });

  saveCancel.addEventListener("click", closeSaveModal);
  saveConfirm.addEventListener("click", confirmSave);

  btnExport.addEventListener("click", () => exportTacticJson());
  btnImport.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const f = importFile.files && importFile.files[0];
    importFile.value = "";
    if (f) importTacticFromFile(f);
  });

  playSpeedSlider.addEventListener("input", () => {
    syncPlaybackSpeedLabel();
    try {
      localStorage.setItem(PLAYBACK_SPEED_KEY, playSpeedSlider.value);
    } catch {}
  });

  btnLibrary.addEventListener("click", () => {
    renderLibrary();
    libraryPanel.hidden = false;
  });
  libraryBackdrop.addEventListener("click", () => {
    libraryPanel.hidden = true;
  });

  btnPlay.addEventListener("click", () => {
    if (!lastTacticTree || playing) return;
    openPlayModal();
  });
  playCancel.addEventListener("click", closePlayModal);
  playStart.addEventListener("click", () => {
    runPlayback();
  });

  btnStopPlay.addEventListener("click", stopPlayback);

  addRed.addEventListener("click", () => addPlayer("red"));
  removeRed.addEventListener("click", () => removePlayer("red"));
  addBlue.addEventListener("click", () => addPlayer("blue"));
  removeBlue.addEventListener("click", () => removePlayer("blue"));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!saveModal.hidden) closeSaveModal();
      if (!playModal.hidden) closePlayModal();
      if (!libraryPanel.hidden) libraryPanel.hidden = true;
    }
  });

  ensureDisc();
  updateStatus();
  btnPlay.disabled = true;
  loadPlaybackSpeedPreference();
  updateExportImportUi();
})();
