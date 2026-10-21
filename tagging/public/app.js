/**
 * Qualys Tag Setup Dashboard - Cloudflare Workers Client
 */

let catalog = { parents: {}, platforms: [], skipped: [] };
let tagState = {};
let isProcessing = false;

// DOM Elements
const platformSelect = document.getElementById("platformSelect");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const dryRunCheckbox = document.getElementById("dryRunCheckbox");
const testAuthBtn = document.getElementById("testAuthBtn");
const executeBtn = document.getElementById("executeBtn");
const exportReportBtn = document.getElementById("exportReportBtn");

const statPlanned = document.getElementById("statPlanned");
const statCreated = document.getElementById("statCreated");
const statReused = document.getElementById("statReused");
const statFailed = document.getElementById("statFailed");

const progressContainer = document.getElementById("progressContainer");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");

const tagTree = document.getElementById("tagTree");
const consoleLogs = document.getElementById("consoleLogs");
const tabFilter = document.getElementById("tabFilter");

// Logging helper
function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${escapeHtml(msg)}</span>`;
  consoleLogs.appendChild(entry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Fetch Catalog from Worker
async function loadCatalog() {
  try {
    log("Loading tag catalog and platform definitions from edge worker...", "info");
    const res = await fetch("/api/catalog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    catalog = await res.json();

    // Populate Platform Dropdown
    platformSelect.innerHTML = "";
    catalog.platforms.forEach((plat) => {
      const opt = document.createElement("option");
      opt.value = plat;
      opt.textContent = `${plat}`;
      if (plat === "US2") opt.selected = true;
      platformSelect.appendChild(opt);
    });

    renderTabs();
    renderTagTree();
    updateStats();
    log(`Loaded ${Object.keys(catalog.parents).length} parent categories with ${getTotalChildren()} tags.`, "success");
  } catch (err) {
    log(`Failed to fetch catalog: ${err.message}. Using offline fallback.`, "warning");
    initFallbackCatalog();
  }
}

function getTotalChildren() {
  return Object.values(catalog.parents).reduce((acc, curr) => acc + curr.length, 0);
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

function renderTabs() {
  tabFilter.innerHTML = `<button class="tab-btn active" data-parent="ALL">All Categories</button>`;
  Object.keys(catalog.parents).forEach((parentName) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.setAttribute("data-parent", parentName);
    btn.textContent = parentName.replace("OS Version: ", "").replace("Lifecycle: ", "");
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterTree(parentName);
    });
    tabFilter.appendChild(btn);
  });

  tabFilter.querySelector('[data-parent="ALL"]').addEventListener("click", (e) => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    filterTree("ALL");
  });
}

function filterTree(selectedParent) {
  const groups = document.querySelectorAll(".parent-group");
  groups.forEach((group) => {
    if (selectedParent === "ALL" || group.getAttribute("data-parent-name") === selectedParent) {
      group.style.display = "block";
    } else {
      group.style.display = "none";
    }
  });
}

function renderTagTree() {
  tagTree.innerHTML = "";
  tagState = {};

  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    const group = document.createElement("div");
    group.className = "parent-group";
    group.setAttribute("data-parent-name", parentName);

    // Parent item state
    tagState[parentName] = { kind: "parent", status: "planned", id: null };

    const header = document.createElement("div");
    header.className = "parent-title-row";
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span>📁 ${escapeHtml(parentName)}</span>
        <span class="parent-badge">STATIC Parent</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="status-badge status-planned" id="status-${slug(parentName)}">Planned</span>
      </div>
    `;
    group.appendChild(header);

    children.forEach((child) => {
      tagState[child.name] = {
        kind: "child",
        parent: parentName,
        qql: child.qql,
        criticality: child.criticality,
        status: "planned",
        id: null,
      };

      const row = document.createElement("div");
      row.className = "child-row";
      row.innerHTML = `
        <div class="child-name">↳ ${escapeHtml(child.name)}</div>
        <div class="child-qql" title="${escapeHtml(child.qql)}">${escapeHtml(child.qql)}</div>
        <div style="text-align:center;"><span class="crit-badge">Crit ${child.criticality}</span></div>
        <div style="text-align:right;"><span class="status-badge status-planned" id="status-${slug(child.name)}">Planned</span></div>
      `;
      group.appendChild(row);
    });

    tagTree.appendChild(group);
  });
}

function slug(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

function updateTagStatus(name, status, label) {
  if (tagState[name]) {
    tagState[name].status = status;
  }
  const el = document.getElementById(`status-${slug(name)}`);
  if (el) {
    el.className = `status-badge status-${status}`;
    el.textContent = label || capitalize(status);
  }
  updateStats();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Test Connection Handler
testAuthBtn.addEventListener("click", async () => {
  const platform = platformSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert("Please enter your Qualys username and password.");
    return;
  }

  testAuthBtn.disabled = true;
  testAuthBtn.innerHTML = `Connecting...`;
  log(`Verifying credentials with Qualys on ${platform}...`, "info");

  try {
    const res = await fetch("/api/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, username, password }),
    });
    const result = await res.json();
    if (result.success) {
      log(`Authentication SUCCESSFUL: Connected to Qualys ${platform} API.`, "success");
      alert(`Success! Successfully authenticated with Qualys ${platform}.`);
    } else {
      log(`Authentication FAILED: ${result.error || result.message}`, "error");
      alert(`Authentication failed: ${result.error || result.message}`);
    }
  } catch (err) {
    log(`Network or Worker Error: ${err.message}`, "error");
    alert(`Could not contact Cloudflare Worker: ${err.message}`);
  } finally {
    testAuthBtn.disabled = false;
    testAuthBtn.innerHTML = `Test Connection`;
  }
});

// Run Setup Handler (Dry-run or Live)
executeBtn.addEventListener("click", async () => {
  if (isProcessing) return;

  const platform = platformSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const isDryRun = dryRunCheckbox.checked;

  if (!isDryRun && (!username || !password)) {
    alert("Please enter Qualys credentials to run live execution.");
    return;
  }

  if (!isDryRun) {
    const confirmed = confirm(`Are you sure you want to execute LIVE tag creation on Qualys ${platform}?\n\nThis will create missing parent and child tags in your tenant.`);
    if (!confirmed) return;
  }

  isProcessing = true;
  executeBtn.disabled = true;
  testAuthBtn.disabled = true;
  progressContainer.style.display = "block";

  const totalSteps = Object.keys(catalog.parents).length + getTotalChildren();
  let completedSteps = 0;

  log(`Starting execution [Mode: ${isDryRun ? "DRY RUN (Simulation)" : "LIVE"} on ${platform}]...`, isDryRun ? "warning" : "info");

  const parentIds = {};

  try {
    // Phase 1: Process Parent Tags
    for (const parentName of Object.keys(catalog.parents)) {
      progressText.textContent = `Processing parent: ${parentName}`;
      updateTagStatus(parentName, "running", "Checking...");

      if (isDryRun) {
        await sleep(30);
        parentIds[parentName] = `DRY_PARENT_${slug(parentName)}`;
        updateTagStatus(parentName, "planned", "Planned");
        log(`[DRY RUN] Plan parent: ${parentName}`, "info");
      } else {
        // Find existing or create
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
          // Create parent tag
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

      completedSteps++;
      updateProgress(completedSteps, totalSteps);
    }

    // Phase 2: Process Child Tags
    for (const [parentName, children] of Object.entries(catalog.parents)) {
      const parentId = parentIds[parentName];

      for (const child of children) {
        progressText.textContent = `Processing: ${child.name}`;
        updateTagStatus(child.name, "running", "Processing...");

        if (isDryRun) {
          await sleep(20);
          updateTagStatus(child.name, "planned", "Simulated");
          log(`[DRY RUN] Plan child: ${child.name} under ${parentName}`, "info");
        } else {
          if (!parentId) {
            updateTagStatus(child.name, "failed", "No Parent");
            log(`SKIPPED child ${child.name}: Parent tag unavailable`, "error");
          } else {
            // Check if child already exists
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
              // Create dynamic child
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

        completedSteps++;
        updateProgress(completedSteps, totalSteps);
      }
    }

    log(`Batch execution complete! Reviewed ${completedSteps} tags.`, "success");
  } catch (err) {
    log(`Execution interrupted: ${err.message}`, "error");
  } finally {
    isProcessing = false;
    executeBtn.disabled = false;
    testAuthBtn.disabled = false;
    progressText.textContent = "Done";
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

// Export Report JSON
exportReportBtn.addEventListener("click", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    platform: platformSelect.value,
    mode: dryRunCheckbox.checked ? "dry-run" : "live",
    tags: tagState,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualys-tags-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Initialization
loadCatalog();
