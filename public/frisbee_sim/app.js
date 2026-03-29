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
  const playPathHint = document.getElementById("playPathHint");

  // btnExitForkUp is kept in HTML but hidden via JS - we no longer use it
  const btnExitForkUp = document.getElementById("btnExitForkUp");
  const btnPausePlay = document.getElementById("btnPausePlay");
  const btnRewindOne = document.getElementById("btnRewindOne");

  const forkOverlay = document.getElementById("forkOverlay");
  const forkBadge = document.getElementById("forkBadge");
  const forkQuestion = document.getElementById("forkQuestion");
  const forkOptionsHint = document.getElementById("forkOptionsHint");
  const forkChoiceButtons = document.getElementById("forkChoiceButtons");

  // Hide the "exit fork up" button - functionality is now automatic
  if (btnExitForkUp) btnExitForkUp.hidden = true;

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
  // Track whether the current lastTacticTree has been saved
  let tacticSaved = false;

  let playing = false;
  let playFinished = false; // true after playback ends naturally (not stopped)
  let playAbort = null;
  let playStepModeActive = false;
  let playPathQueue = [];
  let playbackPaused = false;
  let activeScrub = null;

  function createNode(parent) {
    return {
      frames: [],
      forkIndex: null,
      branches: Object.create(null),
      nextBranchId: 1,
      parent: parent || null,
      hasMoved: false,
    };
  }

  function cloneNodeData(n) {
    return {
      frames: n.frames.map((f) => JSON.parse(JSON.stringify(f))),
      forkIndex: n.forkIndex,
      branches: {},
      nextBranchId: n.nextBranchId,
      parent: null,
      hasMoved: n.hasMoved || false,
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

  function findNearestAncestorFork(node) {
    while (node) {
      if (node.forkIndex != null) return node;
      node = node.parent;
    }
    return null;
  }

  function findBranchKey(host, child) {
    if (!host || !host.branches) return null;
    return Object.keys(host.branches).find((key) => host.branches[key] === child) || null;
  }

  function isBranchFreshEmpty(node) {
    return node && node.frames && node.frames.length > 0 && !node.hasMoved;
  }

  function recordActiveScrubFrame(frame) {
    if (!activeScrub || !activeScrub.timeline) return;
    activeScrub.timeline.push(JSON.parse(JSON.stringify(frame)));
    activeScrub.displayIdx = activeScrub.timeline.length - 1;
    activeScrub.nextIdx = activeScrub.displayIdx + 1;
    if (activeScrub.timeline.length === 1) updatePlaybackControls();
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

  function buildTimelineFromPath(root, pathDigits) {
    const out = [];
    let n = root;
    let qi = 0;
    const path = pathDigits || [];
    if (!n || !n.frames.length) return { ok: false, error: "战术为空", timeline: [] };
    while (n) {
      if (n.forkIndex == null) {
        for (const f of n.frames) out.push(JSON.parse(JSON.stringify(f)));
        if (qi < path.length) {
          return { ok: false, error: "路径过长：按该路径已无更多分叉", timeline: [] };
        }
        return { ok: true, timeline: out };
      }
      const head = n.frames.slice(0, n.forkIndex + 1);
      for (const f of head) out.push(JSON.parse(JSON.stringify(f)));
      const c = path[qi];
      if (c == null) {
        return {
          ok: false,
          error: `路径不足：此处起至少还需 ${qi + 1} 段数字（当前第 ${qi + 1} 个分叉）`,
          timeline: [],
        };
      }
      const keys = Object.keys(n.branches).map(Number);
      if (!keys.includes(c)) {
        const opts = keys.sort((a, b) => a - b).join("、");
        return {
          ok: false,
          error: `第 ${qi + 1} 个分叉处不存在分支 ${c}，可选：${opts}`,
          timeline: [],
        };
      }
      n = n.branches[String(c)];
      if (!n || !n.frames.length) {
        return { ok: false, error: `分支 ${c} 无有效片段`, timeline: [] };
      }
      qi++;
    }
    return { ok: false, error: "路径与战术树不匹配", timeline: [] };
  }

  function updatePlayPathHint() {
    if (!playPathHint) return;
    if (!lastTacticTree || !lastTacticTree.frames.length) {
      playPathHint.textContent = "";
      return;
    }
    const segments = parsePath(playPathInput.value);
    const lines = [];
    let node = lastTacticTree;
    let si = 0;
    while (node && node.forkIndex != null && Object.keys(node.branches).length) {
      const keys = Object.keys(node.branches)
        .map(Number)
        .sort((a, b) => a - b);
      const minK = keys[0];
      const maxK = keys[keys.length - 1];
      const nth = si + 1;
      const chosen = segments[si];
      let line = `第${nth}个分叉：编号 ${minK}～${maxK}（共 ${keys.length} 条）`;
      if (chosen != null) {
        line += keys.includes(chosen)
          ? `，已按 ${chosen} 继续推演`
          : ` — 警告：「${chosen}」不在可选范围内`;
      }
      lines.push(line);
      if (chosen == null || !keys.includes(chosen)) break;
      node = node.branches[String(chosen)];
      si++;
    }
    if (!lines.length) {
      playPathHint.textContent =
        lastTacticTree.forkIndex == null
          ? "本战术无分叉，可不填路径。"
          : "从第一个分叉起，将逐条显示各层允许的分支编号范围。";
    } else {
      playPathHint.textContent = lines.join(" ");
    }
    const stepOn = playStepMode && playStepMode.checked;
    const tryBuild = buildTimelineFromPath(lastTacticTree, segments);
    if (!stepOn && tryBuild.ok && tryBuild.timeline.length) {
      playPathHint.textContent +=
        " 当前设置可预演完整时间轴：播放中可暂停，并用「回退」回到先前帧。";
    } else if (lastTacticTree.forkIndex != null && (stepOn || !tryBuild.ok)) {
      playPathHint.textContent +=
        " 分步或点选分叉时仅支持暂停；要可回退到任意帧，请填齐各层分支数字并取消强制分步。";
    }
  }

  function bindDrag(el) {
    let ptrId = null;
    const onMove = (e) => {
      if (e.pointerId !== ptrId || playing) return;
      const p = clientToPct(e.clientX, e.clientY);
      Object.assign(el.style, pctToStyle(p.x, p.y));
      if (recording && currentNode) currentNode.hasMoved = true;
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

  function updatePlaybackControls() {
    if (!btnPausePlay) return;
    // Allow pause/rewind controls when playing OR when finished (scrub still available)
    const activeOrFinished = playing || playFinished;
    btnPausePlay.disabled = !playing; // pause only makes sense while playing
    const scrub = activeScrub && activeScrub.timeline && activeScrub.timeline.length;
    // Rewind buttons: enabled when scrub data exists (even after playback ends)
    btnRewindOne.disabled = !scrub;
    btnPausePlay.textContent = playbackPaused ? "继续" : "暂停";
    // Stop button: only enabled while playing
    btnStopPlay.disabled = !playing;
  }

  function setPlayingUi(on) {
    playing = on;
    entitiesLayer.querySelectorAll(".entity").forEach((el) => {
      el.classList.toggle("playing", on);
    });
    btnRecord.disabled = on;
    btnFork.disabled = on || !recording;
    btnEndBranch.disabled = on || !recording;
    btnSave.disabled = on || !lastTacticTree || !lastTacticTree.frames.length;
    addRed.disabled = on;
    removeRed.disabled = on;
    addBlue.disabled = on;
    removeBlue.disabled = on;
    btnStopPlay.disabled = !on;
    if (!on) {
      playbackPaused = false;
      // Do NOT clear activeScrub here - keep it so rewind works after finish
    }
    updatePlaybackControls();
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

  // Ask user whether to save unsaved tactic, return promise resolving to:
  // "save" | "discard" | "cancel"
  function askSaveUnsaved() {
    return new Promise((resolve) => {
      const name = currentTacticName || "未命名战术";
      const result = window.confirm(
        `当前战术「${name}」尚未保存，是否保存？\n\n确定 = 保存后继续\n取消 = 不保存，直接丢弃`
      );
      resolve(result ? "save" : "discard");
    });
  }

  async function startRecording() {
    // If there's an unsaved tactic, ask user
    const hasTactic = !!(lastTacticTree && lastTacticTree.frames && lastTacticTree.frames.length);
    if (hasTactic && !tacticSaved) {
      const choice = await askSaveUnsaved();
      if (choice === "save") {
        // Open save modal and wait for it to complete before starting recording
        openSaveModal(true);
        return; // recording will be started after save is confirmed/cancelled
      }
      // discard: clear tactic and proceed
    }
    doStartRecording();
  }

  // pendingRecordAfterSave flag: if true, start recording after save modal closes
  let pendingRecordAfterSave = false;

  function openSaveModal(pendingRecord) {
    if (!lastTacticTree || !lastTacticTree.frames.length) return;
    pendingRecordAfterSave = !!pendingRecord;
    saveNameInput.value = currentTacticName || "未命名战术";
    saveModal.hidden = false;
    saveNameInput.focus();
  }

  function closeSaveModal() {
    saveModal.hidden = true;
    if (pendingRecordAfterSave) {
      pendingRecordAfterSave = false;
      doStartRecording();
    }
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
    tacticSaved = true;
    branchHint.textContent = `已保存「${name}」`;
    updateExportImportUi();
    closeSaveModal();
  }

  function doStartRecording() {
    ensureDisc();
    if (!redNumbers.length && !blueNumbers.length) {
      addPlayer("red");
      addPlayer("blue");
    } else {
      ensureDisc();
    }
    // Clear any previous tactic state
    lastTacticTree = null;
    tacticSaved = false;
    playFinished = false;
    activeScrub = null;
    btnPlay.disabled = true;

    recording = true;
    rootNode = createNode(null);
    currentNode = rootNode;
    recDot.classList.add("on");
    btnRecord.textContent = "停止录制";
    btnRecord.innerHTML = '<span class="rec-dot on" id="recDot"></span>停止录制';
    // Re-grab recDot reference since we replaced innerHTML
    const newRecDot = document.getElementById("recDot");

    btnFork.disabled = false;
    btnEndBranch.disabled = true;
    btnSave.disabled = false;
    recordTimer = setInterval(tickRecord, SAMPLE_MS);
    tickRecord();
    updateStatus();
    updateBranchHint();
    updatePlaybackControls();
    updateExportImportUi();
  }

  function stopRecording() {
    recording = false;
    const rd = document.getElementById("recDot");
    if (rd) rd.classList.remove("on");
    btnRecord.textContent = "录制";
    btnRecord.innerHTML = '<span class="rec-dot" id="recDot"></span>录制';

    btnFork.disabled = true;
    btnEndBranch.disabled = true;
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
    lastTacticTree = deepCloneTree(rootNode, null);
    tacticSaved = false;
    btnPlay.disabled = !lastTacticTree || !lastTacticTree.frames.length;
    currentTacticName = "";
    updateStatus();
    branchHint.textContent = lastTacticTree
      ? "录制已停止，可保存或播放"
      : "";
    updateExportImportUi();
    updatePlaybackControls();
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

  /**
   * End current branch and automatically move up to the nearest ancestor
   * that still has an open fork (i.e., the parent fork node), creating a
   * new sibling branch there.
   *
   * Behavior:
   * - If current node is a child of a fork node (parent.forkIndex != null),
   *   create a new sibling branch under the same parent (same as before).
   * - If the current node IS a fork node (it has been forked itself and we
   *   called "结束该分叉" while sitting at a child), we walk up the parent
   *   chain to find the nearest ancestor fork, and create a new branch there.
   *   This means: ending a sub-fork automatically pops up to the parent fork.
   */
  function onEndBranch() {
    if (!recording || playing) return;

    const parent = currentNode.parent;
    if (!parent || parent.forkIndex == null) {
      branchHint.textContent = "当前不在分支上，无法结束分叉";
      return;
    }

    const forkHost = parent;

    // If the current branch has not been changed since it was created,
    // treat this as an intent to exit the current fork and move up one level.
    if (isBranchFreshEmpty(currentNode)) {
      const branchKey = findBranchKey(forkHost, currentNode);
      if (branchKey != null) delete forkHost.branches[branchKey];
      if (!Object.keys(forkHost.branches).length) {
        forkHost.forkIndex = null;
        forkHost.nextBranchId = 1;
      }
      const upperForkHost = findNearestAncestorFork(forkHost.parent);
      if (!upperForkHost) {
        branchHint.textContent = "已到最外层分叉，无法继续结束父分叉";
        return;
      }
      const bid = upperForkHost.nextBranchId++;
      const sibling = createNode(upperForkHost);
      upperForkHost.branches[String(bid)] = sibling;
      currentNode = sibling;
      const snap = upperForkHost.frames[upperForkHost.forkIndex];
      if (snap) applyState(snap);
      tickRecord();
      branchHint.textContent = `已结束父分叉，开始录制第 ${bid} 条分支`;
      updateBranchHint();
      return;
    }

    const bid = forkHost.nextBranchId++;
    const sibling = createNode(forkHost);
    forkHost.branches[String(bid)] = sibling;
    currentNode = sibling;
    const snap = forkHost.frames[forkHost.forkIndex];
    if (snap) applyState(snap);
    tickRecord();

    const grandparent = forkHost.parent;
    const isNested = grandparent && grandparent.forkIndex != null;
    if (isNested) {
      branchHint.textContent = `已结束子分叉，回到上层：开始录制第 ${bid} 条分支（再次点击"结束该分叉"可继续向上层）`;
    } else {
      branchHint.textContent = `已结束上一分支，开始录制第 ${bid} 条分支`;
    }
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
    tacticSaved = true; // imported = treat as saved
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
        tacticSaved = true;
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
    updatePlayPathHint();
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

  async function animateFrames(frames, signal, frameMs, recordScrub = false) {
    const ms = frameMs != null && frameMs > 0 ? frameMs : SAMPLE_MS;
    if (!frames.length) return;
    if (recordScrub) recordActiveScrubFrame(frames[0]);
    applyState(frames[0]);
    for (let i = 1; i < frames.length; i++) {
      while (playbackPaused) await sleep(80, signal);
      if (signal.aborted) return;
      await sleep(ms, signal);
      if (signal.aborted) return;
      while (playbackPaused) await sleep(80, signal);
      if (signal.aborted) return;
      applyState(frames[i]);
      if (recordScrub) recordActiveScrubFrame(frames[i]);
    }
  }

  async function playTimelineWithScrub(scrub, signal, frameMs) {
    const tl = scrub.timeline;
    if (!tl.length) return;
    scrub.displayIdx = 0;
    scrub.nextIdx = 1;
    applyState(tl[0]);
    while (scrub.nextIdx < tl.length) {
      while (playbackPaused) await sleep(80, signal);
      if (signal.aborted) return;
      await sleep(frameMs, signal);
      if (signal.aborted) return;
      while (playbackPaused) await sleep(80, signal);
      if (signal.aborted) return;
      applyState(tl[scrub.nextIdx]);
      scrub.displayIdx = scrub.nextIdx;
      scrub.nextIdx++;
    }
    // Playback reached the end naturally - mark as finished but keep scrub
    scrub.displayIdx = tl.length - 1;
  }

  async function playNodeDepthFirst(node, pathQueue, signal, frameMs, ctx) {
    if (!ctx) ctx = { forkIndex: 0 };
    if (!node || !node.frames.length) return;
    const fi = node.forkIndex;
    if (fi == null) {
      await animateFrames(node.frames, signal, frameMs, true);
      return;
    }
    const head = node.frames.slice(0, fi + 1);
    await animateFrames(head, signal, frameMs, true);
    if (signal.aborted) return;
    const keys = Object.keys(node.branches).map(Number).sort((a, b) => a - b);
    if (!keys.length) return;
    ctx.forkIndex += 1;
    const forkNum = ctx.forkIndex;
    let choice;
    if (playStepModeActive) {
      choice = await waitForkChoice(keys, signal, forkNum);
    } else if (pathQueue.length > 0) {
      choice = pathQueue.shift();
      if (!keys.includes(choice)) choice = keys[0];
    } else {
      // 默认连续播放时，自动选择第 1 条分支
      choice = keys[0];
    }
    const next = node.branches[String(choice)];
    if (next) await playNodeDepthFirst(next, pathQueue, signal, frameMs, ctx);
  }

  function waitForkChoice(keys, signal, forkNumber) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
      forkOverlay.hidden = false;
      if (forkBadge) forkBadge.textContent = `第 ${forkNumber} 个分叉`;
      if (forkQuestion) forkQuestion.textContent = "请选择要走哪一条分支？";
      if (forkOptionsHint) {
        forkOptionsHint.textContent =
          keys.length > 1
            ? `本处共有 ${keys.length} 条分支，可选编号：${keys.join("、")}`
            : `本处仅有 1 条分支`;
      }
      forkChoiceButtons.innerHTML = "";
      const clean = () => {
        forkOverlay.hidden = true;
        forkChoiceButtons.innerHTML = "";
        if (forkOptionsHint) forkOptionsHint.textContent = "";
      };
      keys.forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "fork-choice-btn";
        b.setAttribute("aria-label", `选择分支 ${k}`);
        b.innerHTML = `<span class="fork-choice-btn__num">${k}</span><span class="fork-choice-btn__label">分支 ${k}</span>`;
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
    const pathDigits = parsePath(playPathInput.value);
    const step = playStepMode.checked;
    let useTimeline = false;
    let timeline = null;
    if (!step) {
      if (pathDigits.length > 0) {
        const built = buildTimelineFromPath(lastTacticTree, pathDigits);
        if (!built.ok) {
          window.alert(built.error);
          return;
        }
        timeline = built.timeline;
        useTimeline = timeline.length > 0;
      } else {
        const built0 = buildTimelineFromPath(lastTacticTree, []);
        if (built0.ok && built0.timeline.length) {
          timeline = built0.timeline;
          useTimeline = true;
        }
      }
    }
    const first = firstFrameOfTree(lastTacticTree);
    if (first) rebuildEntitiesFromState(first);
    const ac = new AbortController();
    playAbort = ac;
    playbackPaused = false;
    playFinished = false;
    // Prepare scrub timeline for playback
    activeScrub = null;
    closePlayModal();
    setPlayingUi(true);
    updateStatus();
    playStepModeActive = step;
    playPathQueue = pathDigits.slice();
    const speed = parseFloat(playSpeedSlider.value);
    const sp = Number.isFinite(speed) && speed > 0 ? speed : 1;
    const frameMs = SAMPLE_MS / sp;
    try {
      if (useTimeline && timeline) {
        activeScrub = { timeline };
        updatePlaybackControls();
        await playTimelineWithScrub(activeScrub, ac.signal, frameMs);
      } else {
        activeScrub = { timeline: [], displayIdx: 0, nextIdx: 1 };
        updatePlaybackControls();
        await playNodeDepthFirst(lastTacticTree, playPathQueue, ac.signal, frameMs, {
          forkIndex: 0,
        });
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
    // Determine if we finished naturally vs. were stopped
    const wasAborted = ac.signal.aborted;
    playbackPaused = false;
    setPlayingUi(false);

    if (!wasAborted && activeScrub && activeScrub.timeline) {
      // Natural finish: keep scrub so rewind buttons remain usable
      playFinished = true;
      branchHint.textContent = currentTacticName
        ? `战术「${currentTacticName}」播放结束 · 可使用回退按钮回看`
        : "播放结束 · 可使用回退按钮回看";
    } else {
      // Stopped manually: clear scrub
      activeScrub = null;
      playFinished = false;
      branchHint.textContent = currentTacticName ? `战术「${currentTacticName}」已停止` : "已停止";
    }
    updateStatus();
    playAbort = null;
    updatePlaybackControls();
  }

  function stopPlayback() {
    if (playAbort) playAbort.abort();
    forkOverlay.hidden = true;
    activeScrub = null;
    playFinished = false;
    playbackPaused = false;
    updatePlaybackControls();
  }

  // ---- Event listeners ----

  btnRecord.addEventListener("click", () => {
    if (playing) return;
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  btnFork.addEventListener("click", onFork);
  btnEndBranch.addEventListener("click", onEndBranch);

  // btnExitForkUp is hidden; keep listener harmless
  if (btnExitForkUp) btnExitForkUp.addEventListener("click", () => {});

  btnPausePlay.addEventListener("click", () => {
    if (!playing) return;
    playbackPaused = !playbackPaused;
    updatePlaybackControls();
  });

  btnRewindOne.addEventListener("click", () => {
    if (!activeScrub || !activeScrub.timeline) return;
    if (activeScrub.displayIdx === undefined) activeScrub.displayIdx = activeScrub.timeline.length - 1;
    // Pause if currently playing
    if (playing) playbackPaused = true;
    if (activeScrub.displayIdx <= 0) return;
    activeScrub.displayIdx -= 1;
    activeScrub.nextIdx = activeScrub.displayIdx + 1;
    applyState(activeScrub.timeline[activeScrub.displayIdx]);
    updatePlaybackControls();
  });

  playPathInput.addEventListener("input", updatePlayPathHint);
  playStepMode.addEventListener("change", updatePlayPathHint);

  btnSave.addEventListener("click", () => {
    if (recording) {
      branchHint.textContent = "请先停止录制再保存";
      return;
    }
    openSaveModal(false);
  });

  saveCancel.addEventListener("click", () => {
    if (pendingRecordAfterSave) {
      // User cancelled save dialog that appeared before recording — discard tactic and start fresh
      pendingRecordAfterSave = false;
      saveModal.hidden = true;
      doStartRecording();
    } else {
      closeSaveModal();
    }
  });
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
      if (!saveModal.hidden) {
        if (pendingRecordAfterSave) {
          pendingRecordAfterSave = false;
          saveModal.hidden = true;
          doStartRecording();
        } else {
          closeSaveModal();
        }
      }
      if (!playModal.hidden) closePlayModal();
      if (!libraryPanel.hidden) libraryPanel.hidden = true;
    }
  });

  ensureDisc();
  updateStatus();
  btnPlay.disabled = true;
  loadPlaybackSpeedPreference();
  updateExportImportUi();
  updatePlaybackControls();
})();
