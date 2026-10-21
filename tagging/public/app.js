/**
 * Qualys Tag Setup Dashboard - Cloudflare Client
 * Designed for single-page viewport fitting and real-time execution.
 */

let catalog = { parents: {}, platforms: [], skipped: [] };
let tagState = {};
let isProcessing = false;
let logCount = 0;
let currentFilter = "ALL";
let searchQuery = "";

// DOM Elements
const platformSelect = document.getElementById("platformSelect");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const dryRunCheckbox = document.getElementById("dryRunCheckbox");
const testAuthBtn = document.getElementById("testAuthBtn");
const executeBtn = document.getElementById("executeBtn");
const exportReportBtn = document.getElementById("exportReportBtn");
const refreshBtn = document.getElementById("refreshBtn");
const tagSearchInput = document.getElementById("tagSearchInput");

const statPlanned = document.getElementById("statPlanned");
const statCreated = document.getElementById("statCreated");
const statReused = document.getElementById("statReused");
const statFailed = document.getElementById("statFailed");

const inlineProgress = document.getElementById("inlineProgress");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");

const tagTableBody = document.getElementById("tagTableBody");
const categoryPills = document.getElementById("categoryPills");
const consoleLogs = document.getElementById("consoleLogs");
const logSummary = document.getElementById("logSummary");

const connDot = document.getElementById("connDot");
const connStatus = document.getElementById("connStatus");
const topUsername = document.getElementById("topUsername");

// Logging
function log(msg, type = "info") {
  logCount++;
  logSummary.textContent = `${logCount} events logged`;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-${type}">${escapeHtml(msg)}</span>`;
  consoleLogs.appendChild(line);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slug(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// Update Top Username
usernameInput.addEventListener("input", (e) => {
  topUsername.textContent = e.target.value.trim() || "Tenant User";
});

// Search input
tagSearchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderTable();
});

// Load Catalog
async function loadCatalog() {
  try {
    log("Fetching dynamic tag catalog and platform POD list...", "info");
    const res = await fetch("/api/catalog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    catalog = await res.json();

    // Fill Platform Select
    platformSelect.innerHTML = "";
    catalog.platforms.forEach((plat) => {
      const opt = document.createElement("option");
      opt.value = plat;
      opt.textContent = `${plat}`;
      if (plat === "US2") opt.selected = true;
      platformSelect.appendChild(opt);
    });

    renderPills();
    initTagState();
    renderTable();
    updateStats();
    log(`Loaded ${Object.keys(catalog.parents).length} categories with ${getTotalChildren()} dynamic tags.`, "success");
  } catch (err) {
    log(`Failed to fetch catalog from /api/catalog: ${err.message}. Using built-in rules.`, "warning");
    initFallbackCatalog();
  }
}

function getTotalChildren() {
  return Object.values(catalog.parents).reduce((acc, curr) => acc + curr.length, 0);
}

function initTagState() {
  tagState = {};
  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    tagState[parentName] = { kind: "parent", status: "planned", id: null };
    children.forEach((child) => {
      tagState[child.name] = {
        kind: "child",
        parent: parentName,
        qql: child.qql,
        criticality: child.criticality,
        status: "planned",
        id: null,
      };
    });
  });
}

function renderPills() {
  categoryPills.innerHTML = `<button class="pill-btn active" data-cat="ALL">All Categories</button>`;
  Object.keys(catalog.parents).forEach((parentName) => {
    const btn = document.createElement("button");
    btn.className = "pill-btn";
    btn.setAttribute("data-cat", parentName);
    btn.textContent = parentName.replace("OS Version: ", "").replace("Lifecycle: ", "");
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = parentName;
      renderTable();
    });
    categoryPills.appendChild(btn);
  });

  categoryPills.querySelector('[data-cat="ALL"]').addEventListener("click", (e) => {
    document.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentFilter = "ALL";
    renderTable();
  });
}

function renderTable() {
  tagTableBody.innerHTML = "";

  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    if (currentFilter !== "ALL" && currentFilter !== parentName) return;

    // Filter children by search query
    const matchingChildren = children.filter((c) => {
      if (!searchQuery) return true;
      return c.name.toLowerCase().includes(searchQuery) || c.qql.toLowerCase().includes(searchQuery);
    });

    if (matchingChildren.length === 0 && searchQuery && !parentName.toLowerCase().includes(searchQuery)) {
      return;
    }

    // Render Parent Row
    const pRow = document.createElement("tr");
    pRow.className = "parent-row";
    const pState = tagState[parentName] || { status: "planned" };
    pRow.innerHTML = `
      <td colspan="2" class="tag-name-cell">
        <span>📁</span>
        <strong>${escapeHtml(parentName)}</strong>
        <span style="font-size:10px; color:#64748b; font-weight:normal; margin-left:6px;">(STATIC Parent Tag)</span>
      </td>
      <td style="text-align: center; color: #94a3b8;">—</td>
      <td style="text-align: right;">
        <span class="badge-status ${pState.status}" id="status-${slug(parentName)}">${capitalize(pState.status)}</span>
      </td>
    `;
    tagTableBody.appendChild(pRow);

    // Render Children Rows
    matchingChildren.forEach((child) => {
      const cState = tagState[child.name] || { status: "planned" };
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="tag-name-cell" style="padding-left: 28px;">
          <span style="color:#94a3b8;">↳</span>
          <span>${escapeHtml(child.name)}</span>
        </td>
        <td>
          <span class="qql-code" title="${escapeHtml(child.qql)}">${escapeHtml(child.qql)}</span>
        </td>
        <td style="text-align: center;">
          <span class="crit-badge">Crit ${child.criticality}</span>
        </td>
        <td style="text-align: right;">
          <span class="badge-status ${cState.status}" id="status-${slug(child.name)}">${capitalize(cState.status)}</span>
        </td>
      `;
      tagTableBody.appendChild(row);
    });
  });
}

function updateTagStatus(name, status, label) {
  if (tagState[name]) {
    tagState[name].status = status;
  }
  const el = document.getElementById(`status-${slug(name)}`);
  if (el) {
    el.className = `badge-status ${status}`;
    el.textContent = label || capitalize(status);
  }
  updateStats();
}

function updateStats() {
  let planned = 0;
  let created = 0;
  let reused = 0;
  let failed = 0;

  Object.values(tagState).forEach((item) => {
    if (item.status === "created") created++;
    else if (item.status === "reused") reused++;
    else if (item.status === "failed") failed++;
    else planned++;
  });

  statPlanned.textContent = planned;
  statCreated.textContent = created;
  statReused.textContent = reused;
  statFailed.textContent = failed;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Test Connection
testAuthBtn.addEventListener("click", async () => {
  const platform = platformSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert("Please provide both API Username and Password.");
    return;
  }

  testAuthBtn.disabled = true;
  connDot.className = "status-dot active";
  connStatus.textContent = "Verifying...";
  log(`Validating credentials with Qualys API 2.0 (${platform})...`, "info");

  try {
    const res = await fetch("/api/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, username, password }),
    });
    const result = await res.json();
    if (result.success) {
      connDot.style.background = "#22c55e";
      connStatus.textContent = "Connected";
      log(`Authentication Successful on Qualys ${platform}!`, "success");
      alert(`Success: Connected to Qualys ${platform} API.`);
    } else {
      connDot.style.background = "#ef4444";
      connStatus.textContent = "Auth Failed";
      log(`Authentication Failed: ${result.error || result.message}`, "error");
      alert(`Authentication failed: ${result.error || result.message}`);
    }
  } catch (err) {
    connDot.style.background = "#ef4444";
    connStatus.textContent = "Network Error";
    log(`Network error: ${err.message}`, "error");
    alert(`Could not reach API relay: ${err.message}`);
  } finally {
    testAuthBtn.disabled = false;
  }
});

// Execute Setup (Dry-run or Live)
executeBtn.addEventListener("click", async () => {
  if (isProcessing) return;

  const platform = platformSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const isDryRun = dryRunCheckbox.checked;

  if (!isDryRun && (!username || !password)) {
    alert("Enter API username and password to execute live tag creation.");
    return;
  }

  if (!isDryRun) {
    const confirmed = confirm(`Are you sure you want to execute LIVE tag creation on Qualys ${platform}?\n\nThis will create tags inside your tenant.`);
    if (!confirmed) return;
  }

  isProcessing = true;
  executeBtn.disabled = true;
  testAuthBtn.disabled = true;
  inlineProgress.style.display = "flex";

  const totalSteps = Object.keys(catalog.parents).length + getTotalChildren();
  let done = 0;

  log(`Beginning execution [Mode: ${isDryRun ? "DRY RUN (Simulation)" : "LIVE"} on ${platform}]...`, isDryRun ? "warning" : "info");

  const parentIds = {};

  try {
    // 1. Process Parents
    for (const parentName of Object.keys(catalog.parents)) {
      progressText.textContent = `${parentName}`;
      updateTagStatus(parentName, "running", "Checking...");

      if (isDryRun) {
        await sleep(25);
        parentIds[parentName] = `DRY_PARENT_${slug(parentName)}`;
        updateTagStatus(parentName, "planned", "Simulated");
        log(`[DRY RUN] Parent: ${parentName}`, "info");
      } else {
        const findRes = await fetch("/api/tag-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform, username, password,
            action: "find",
            payload: { name: parentName },
          }),
        });
        const findData = await findRes.json();

        if (findData.existing && findData.existing.id) {
          parentIds[parentName] = findData.existing.id;
          updateTagStatus(parentName, "reused", "Reused");
          log(`REUSE Parent: ${parentName} (ID: ${findData.existing.id})`, "success");
        } else {
          const createRes = await fetch("/api/tag-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform, username, password,
              action: "create",
              payload: { name: parentName, ruleType: "STATIC" },
            }),
          });
          const createData = await createRes.json();
          if (createData.success && createData.result.tagId) {
            parentIds[parentName] = createData.result.tagId;
            updateTagStatus(parentName, "created", "Created");
            log(`CREATED Parent: ${parentName} (ID: ${createData.result.tagId})`, "success");
          } else {
            updateTagStatus(parentName, "failed", "Failed");
            log(`FAILED Parent: ${parentName} - ${createData.result?.message || createData.error}`, "error");
          }
        }
      }
      done++;
      updateProgress(done, totalSteps);
    }

    // 2. Process Children
    for (const [parentName, children] of Object.entries(catalog.parents)) {
      const parentId = parentIds[parentName];

      for (const child of children) {
        progressText.textContent = `${child.name}`;
        updateTagStatus(child.name, "running", "Processing...");

        if (isDryRun) {
          await sleep(20);
          updateTagStatus(child.name, "planned", "Simulated");
          log(`[DRY RUN] Dynamic Child: ${child.name}`, "info");
        } else {
          if (!parentId) {
            updateTagStatus(child.name, "failed", "No Parent");
            log(`SKIPPED child ${child.name}: parent tag missing`, "error");
          } else {
            const findRes = await fetch("/api/tag-action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform, username, password,
                action: "find",
                payload: { name: child.name },
              }),
            });
            const findData = await findRes.json();

            if (findData.existing && findData.existing.id) {
              updateTagStatus(child.name, "reused", "Reused");
              log(`REUSE Child: ${child.name} (ID: ${findData.existing.id})`, "success");
            } else {
              const createRes = await fetch("/api/tag-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  platform, username, password,
                  action: "create",
                  payload: {
                    name: child.name,
                    ruleType: "GLOBAL_ASSET_VIEW",
                    parentId: parentId,
                    ruleText: child.qql,
                    criticality: child.criticality,
                  },
                }),
              });
              const createData = await createRes.json();
              if (createData.success && createData.result.tagId) {
                updateTagStatus(child.name, "created", "Created");
                log(`CREATED Child: ${child.name} (ID: ${createData.result.tagId})`, "success");
              } else {
                updateTagStatus(child.name, "failed", "Failed");
                log(`FAILED Child: ${child.name} - ${createData.result?.message || createData.error}`, "error");
              }
            }
          }
        }
        done++;
        updateProgress(done, totalSteps);
      }
    }

    log(`Batch Execution Finished. Processed ${done} tags.`, "success");
  } catch (err) {
    log(`Execution error: ${err.message}`, "error");
  } finally {
    isProcessing = false;
    executeBtn.disabled = false;
    testAuthBtn.disabled = false;
    progressText.textContent = "Finished";
  }
});

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  progressPercent.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export JSON Report
exportReportBtn.addEventListener("click", () => {
  const report = {
    exportedAt: new Date().toISOString(),
    platform: platformSelect.value,
    mode: dryRunCheckbox.checked ? "dry-run" : "live",
    tags: tagState,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualys-tag-setup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

refreshBtn.addEventListener("click", loadCatalog);

// Start
loadCatalog();
