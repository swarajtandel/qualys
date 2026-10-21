/**
 * Qualys Tag Setup Dashboard - Interactive Client Application
 * Handles View Switching, Dynamic Catalog Management (Add/Edit/Remove),
 * Tag Selection Checkboxes, and Session-Only Live Progress Tracking.
 */

// 1. In-Memory Catalog State (Session only - no permanent storage)
let catalog = { parents: {}, platforms: [], skipped: [] };
let tagState = {}; // Keyed by tag name: { kind, parent, qql, criticality, selected: boolean, status: 'planned'|'running'|'created'|'reused'|'failed', failReason: null, id: null }
let currentFilter = "ALL";
let searchQuery = "";
let isProcessing = false;
let editingChildTag = null; // null if creating new, or { parent, name } if editing
let collapsedParents = new Set(); // Track collapsed parent tag sections

// DOM References - Navigation
const navItems = document.querySelectorAll(".nav-item");
const viewPanels = document.querySelectorAll(".view-panel");

// DOM References - Top Bar
const tagSearchInput = document.getElementById("tagSearchInput");
const connDot = document.getElementById("connDot");
const connStatus = document.getElementById("connStatus");
const avatarInitials = document.getElementById("avatarInitials");
const topUsername = document.getElementById("topUsername");
const topPlatform = document.getElementById("topPlatform");

// DOM References - Dashboard View
const platformSelect = document.getElementById("platformSelect");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const dryRunCheckbox = document.getElementById("dryRunCheckbox");
const testAuthBtn = document.getElementById("testAuthBtn");
const executeBtn = document.getElementById("executeBtn");
const exportReportBtn = document.getElementById("exportReportBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const refreshBtn = document.getElementById("refreshBtn");
const headerCheckbox = document.getElementById("headerCheckbox");

const statOverallParents = document.getElementById("statOverallParents");
const statOverallChildren = document.getElementById("statOverallChildren");
const statSelected = document.getElementById("statSelected");

const categoryPills = document.getElementById("categoryPills");
const executionBanner = document.getElementById("executionBanner");
const bannerToggleHeader = document.getElementById("bannerToggleHeader");
const bannerToggleIcon = document.getElementById("bannerToggleIcon");
const bannerSubtitle = document.getElementById("bannerSubtitle");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const statSuccessBadge = document.getElementById("statSuccessBadge");
const statReusedBadge = document.getElementById("statReusedBadge");
const statFailedBadge = document.getElementById("statFailedBadge");
const bannerCloseBtn = document.getElementById("bannerCloseBtn");
const bannerDetailsDrawer = document.getElementById("bannerDetailsDrawer");
const bannerDetailsTableBody = document.getElementById("bannerDetailsTableBody");
const tagTableBody = document.getElementById("tagTableBody");
const consoleLogs = document.getElementById("consoleLogs");
const logSummary = document.getElementById("logSummary");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// Activity Logs View DOM References
const logUserAccount = document.getElementById("logUserAccount");
const logUserPod = document.getElementById("logUserPod");
const logTotalCount = document.getElementById("logTotalCount");
const logSuccessCount = document.getElementById("logSuccessCount");
const logFailCount = document.getElementById("logFailCount");
const logSearchInput = document.getElementById("logSearchInput");
const logsDetailedFeed = document.getElementById("logsDetailedFeed");
const viewClearLogsBtn = document.getElementById("viewClearLogsBtn");
const viewCopyLogsBtn = document.getElementById("viewCopyLogsBtn");

// Retractable Console Drawer DOM
const retractableConsole = document.getElementById("retractableConsole");
const consoleToggleBar = document.getElementById("consoleToggleBar");
const toggleDrawerBtn = document.getElementById("toggleDrawerBtn");
const drawerArrow = document.getElementById("drawerArrow");
const drawerFailCounter = document.getElementById("drawerFailCounter");

// DOM References - Tags Catalog View
const catalogTableBody = document.getElementById("catalogTableBody");
const openNewParentModalBtn = document.getElementById("openNewParentModalBtn");
const openNewChildModalBtn = document.getElementById("openNewChildModalBtn");
const resetDefaultCatalogBtn = document.getElementById("resetDefaultCatalogBtn");

// DOM References - API Settings View
const apiPlatformsTableBody = document.getElementById("apiPlatformsTableBody");

// DOM References - Modals
const parentModal = document.getElementById("parentModal");
const parentModalTitle = document.getElementById("parentModalTitle");
const closeParentModalBtn = document.getElementById("closeParentModalBtn");
const cancelParentBtn = document.getElementById("cancelParentBtn");
const saveParentBtn = document.getElementById("saveParentBtn");
const newParentName = document.getElementById("newParentName");

const childModal = document.getElementById("childModal");
const closeChildModalBtn = document.getElementById("closeChildModalBtn");
const cancelChildBtn = document.getElementById("cancelChildBtn");
const saveChildBtn = document.getElementById("saveChildBtn");
const childModalTitle = document.getElementById("childModalTitle");
const childParentSelect = document.getElementById("childParentSelect");
const childTagName = document.getElementById("childTagName");
const childTagQql = document.getElementById("childTagQql");
const childTagCriticality = document.getElementById("childTagCriticality");

// -------------------------------------------------------------
// 2. VIEW SWITCHING (Dashboard, Tags Catalog, API Settings, Activity Logs)
// -------------------------------------------------------------
navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((n) => n.classList.remove("active"));
    item.classList.add("active");
    const targetViewId = item.getAttribute("data-view");

    viewPanels.forEach((panel) => {
      if (panel.id === targetViewId) {
        panel.classList.add("active-view");
      } else {
        panel.classList.remove("active-view");
      }
    });

    if (targetViewId === "tagsCatalogView") renderCatalogView();
    if (targetViewId === "apiSettingsView") renderApiSettingsView();
    if (targetViewId === "logsView") renderLogsView();
  });
});

// -------------------------------------------------------------
// 3. LOGGING & AUDIT TELEMETRY (IST TIMEZONE & STRUCTURED AUDIT)
// -------------------------------------------------------------
let logCount = 0;
let auditLogs = []; // Structured storage: [{ time, istTimestamp, user, pod, category, type, action, message }]
let currentLogCategoryFilter = "ALL";

function getIstTimestamp(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const formatted = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return formatted.replace(/\bam\b/gi, "AM").replace(/\bpm\b/gi, "PM") + " IST";
}

function getIstTime(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const formatted = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return formatted.replace(/\bam\b/gi, "AM").replace(/\bpm\b/gi, "PM") + " IST";
}

function resolveActionType(category, type, msg) {
  const m = msg.toLowerCase();
  if (m.includes("authenticating") || m.includes("connected") || m.includes("authentication")) return "Authentication";
  if (m.includes("renamed parent")) return "Parent Rename";
  if (m.includes("added new parent") || m.includes("create parent")) return "Parent Create";
  if (m.includes("deleted category") || m.includes("delete parent")) return "Parent Delete";
  if (m.includes("created new tag") || m.includes("create tag") || m.includes("created parent") || m.includes("created child")) return "Tag Create";
  if (m.includes("updated tag") || m.includes("edit tag")) return "Tag Edit";
  if (m.includes("removed tag") || m.includes("delete tag")) return "Tag Remove";
  if (m.includes("reuse")) return "Tag Reuse";
  if (m.includes("deploy") || m.includes("dry run")) return "Tag Deploy";
  if (m.includes("catalog loaded") || m.includes("fetching dynamic")) return "Catalog Load";
  if (m.includes("session progress reset")) return "Session Reset";
  if (category === "auth") return "Authentication";
  if (category === "tag") return "Tag Action";
  return capitalize(category || "Activity");
}

const expandedLogDetails = new Set();

window.toggleLogDetails = function(logId) {
  if (expandedLogDetails.has(logId)) {
    expandedLogDetails.delete(logId);
  } else {
    expandedLogDetails.add(logId);
  }
  renderLogsView();
};

function logToConsole(msg, type = "info") {
  const istTimeOnly = getIstTime(new Date());
  const user = (usernameInput && usernameInput.value.trim()) || "testq2st5";
  const pod = (platformSelect && platformSelect.value) || "US2";

  if (consoleLogs) {
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-time">[${istTimeOnly}]</span><span class="log-${type}">[${pod}] [${user}] ${escapeHtml(msg)}</span>`;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }
}

function recordAuditTask({ action, category = "general", type = "info", message, details = null }) {
  logCount++;
  if (logSummary) logSummary.textContent = `${logCount} tasks`;

  const now = new Date();
  const istTimestamp = getIstTimestamp(now);
  const istTimeOnly = getIstTime(now);
  const user = (usernameInput && usernameInput.value.trim()) || "testq2st5";
  const pod = (platformSelect && platformSelect.value) || "US2";
  const resolvedAction = action || resolveActionType(category, type, message);

  const taskEntry = {
    id: "task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    time: istTimeOnly,
    istTimestamp,
    user,
    pod,
    category,
    type,
    action: resolvedAction,
    message,
    details,
  };

  auditLogs.unshift(taskEntry);

  // Print summary to retractable console
  logToConsole(`[${resolvedAction}] ${message}`, type);

  // If looking at logs view, re-render table
  if (document.getElementById("logsView")?.classList.contains("active-view")) {
    renderLogsView();
  }
}

function log(msg, type = "info", category = "general", customAction = null) {
  recordAuditTask({ action: customAction, category, type, message: msg });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slug(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderCritBadge(criticality) {
  const c = parseInt(criticality, 10);
  if (isNaN(c) || c === null || c === undefined) return "";
  const critClass = c >= 1 && c <= 5 ? `crit-${c}` : "crit-1";
  return `<span class="crit-box ${critClass}">${c}</span>`;
}

clearLogsBtn.addEventListener("click", () => {
  consoleLogs.innerHTML = "";
  auditLogs = [];
  logCount = 0;
  logSummary.textContent = "Logs cleared";
  if (document.getElementById("logsView")?.classList.contains("active-view")) {
    renderLogsView();
  }
});

// -------------------------------------------------------------
// 4. USER CREDENTIAL & TOP BAR TRACKING
// -------------------------------------------------------------
usernameInput.addEventListener("input", updateTopBarUser);
platformSelect.addEventListener("change", updateTopBarUser);

function updateTopBarUser() {
  const user = usernameInput.value.trim();
  const plat = platformSelect.value;
  topUsername.textContent = user ? user : "No Account Selected";
  topPlatform.textContent = plat ? `Platform: ${plat}` : "Disconnected";
  avatarInitials.textContent = user ? user.substring(0, 2).toUpperCase() : "--";
}

// Password Visibility Toggle
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.title = isPassword ? "Hide password" : "Show password";
    
    // Toggle SVG icon between eye and eye-off
    if (isPassword) {
      togglePasswordBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      togglePasswordBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  });
}

// -------------------------------------------------------------
// 5. CATALOG DATA INITIALIZATION
// -------------------------------------------------------------
async function loadCatalog() {
  try {
    logToConsole("Fetching dynamic tag catalog from local proxy server...", "info");
    const res = await fetch("/api/catalog");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    catalog = await res.json();

    initTagState();
    renderPills();
    renderDashboardTable();
    updateDashboardStats();
    updateTopBarUser();
    recordAuditTask({
      action: "Catalog Load",
      category: "general",
      type: "info",
      message: `Loaded catalog with ${Object.keys(catalog.parents).length} parent categories and ${getTotalChildren()} dynamic tags.`,
      details: {
        parentsCount: Object.keys(catalog.parents).length,
        tagsCount: getTotalChildren(),
        categories: Object.keys(catalog.parents),
      },
    });
  } catch (err) {
    recordAuditTask({
      action: "Catalog Load",
      category: "general",
      type: "error",
      message: `Failed to fetch catalog: ${err.message}`,
      details: { error: err.message },
    });
  }
}

function getTotalChildren() {
  return Object.values(catalog.parents).reduce((acc, curr) => acc + curr.length, 0);
}

function initTagState() {
  tagState = {};
  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    tagState[parentName] = {
      kind: "parent",
      selected: true,
      status: "planned",
      failReason: null,
      id: null,
    };
    children.forEach((child) => {
      tagState[child.name] = {
        kind: "child",
        parent: parentName,
        qql: child.qql,
        criticality: child.criticality,
        selected: true,
        status: "planned",
        failReason: null,
        id: null,
      };
    });
  });
}

// -------------------------------------------------------------
// 6. DASHBOARD VIEW: PILLS & SELECTION TABLE
// -------------------------------------------------------------
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
      renderDashboardTable();
    });
    categoryPills.appendChild(btn);
  });

  categoryPills.querySelector('[data-cat="ALL"]').addEventListener("click", (e) => {
    document.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentFilter = "ALL";
    renderDashboardTable();
  });
}

tagSearchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderDashboardTable();
});

function renderDashboardTable() {
  tagTableBody.innerHTML = "";

  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    if (currentFilter !== "ALL" && currentFilter !== parentName) return;

    const matchingChildren = children.filter((c) => {
      if (!searchQuery) return true;
      return c.name.toLowerCase().includes(searchQuery) || c.qql.toLowerCase().includes(searchQuery);
    });

    if (matchingChildren.length === 0 && searchQuery && !parentName.toLowerCase().includes(searchQuery)) {
      return;
    }

    const pState = tagState[parentName] || { selected: true, status: "planned" };
    const isCollapsed = collapsedParents.has(parentName);

    // Parent Row (Clean, single-line, left-aligned, no clutter, no dash)
    const pRow = document.createElement("tr");
    pRow.className = "parent-row";
    pRow.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="parent-checkbox" data-parent="${escapeHtml(parentName)}" ${pState.selected ? "checked" : ""}>
      </td>
      <td class="tag-name-cell parent-tag-cell">
        <button type="button" class="parent-toggle-btn ${isCollapsed ? "collapsed" : ""}" data-toggle-parent="${escapeHtml(parentName)}" title="${isCollapsed ? "Expand tags" : "Collapse tags"}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <span class="parent-title-text">${escapeHtml(parentName)}</span>
      </td>
      <td></td>
      <td style="text-align: center;"></td>
    `;
    tagTableBody.appendChild(pRow);

    // Toggle collapse/expand button
    const toggleBtn = pRow.querySelector(".parent-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      if (collapsedParents.has(parentName)) {
        collapsedParents.delete(parentName);
      } else {
        collapsedParents.add(parentName);
      }
      renderDashboardTable();
    });

    // Parent Checkbox Handler (Toggles all children)
    const pCheckbox = pRow.querySelector(".parent-checkbox");
    pCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      tagState[parentName].selected = isChecked;
      children.forEach((c) => {
        if (tagState[c.name]) tagState[c.name].selected = isChecked;
      });
      renderDashboardTable();
      updateDashboardStats();
    });

    // Children Rows (Only render if not collapsed)
    if (!isCollapsed) {
      matchingChildren.forEach((child) => {
        const cState = tagState[child.name] || { selected: true, status: "planned" };
        const row = document.createElement("tr");
        row.innerHTML = `
          <td style="text-align: center;">
            <input type="checkbox" class="child-checkbox" data-name="${escapeHtml(child.name)}" ${cState.selected ? "checked" : ""}>
          </td>
          <td class="tag-name-cell sub-tag-cell">
            <span class="sub-tag-branch">↳</span>
            <span>${escapeHtml(child.name)}</span>
          </td>
          <td>
            <span class="qql-code" title="${escapeHtml(child.qql)}">${escapeHtml(child.qql)}</span>
          </td>
          <td style="text-align: center;">
            ${renderCritBadge(child.criticality)}
          </td>
        `;
        tagTableBody.appendChild(row);

        // Child Checkbox Handler
        const cCheckbox = row.querySelector(".child-checkbox");
        cCheckbox.addEventListener("change", (e) => {
          tagState[child.name].selected = e.target.checked;
          updateDashboardStats();
        });
      });
    }
  });

  updateDashboardStats();
}

// Select All / Deselect All Handlers
selectAllBtn.addEventListener("click", () => {
  Object.keys(tagState).forEach((key) => { tagState[key].selected = true; });
  renderDashboardTable();
});

deselectAllBtn.addEventListener("click", () => {
  Object.keys(tagState).forEach((key) => { tagState[key].selected = false; });
  renderDashboardTable();
});

headerCheckbox.addEventListener("change", (e) => {
  const checked = e.target.checked;
  Object.keys(tagState).forEach((key) => { tagState[key].selected = checked; });
  renderDashboardTable();
});

function updateDashboardStats() {
  const totalParents = Object.keys(catalog.parents).length;
  let totalChildren = 0;
  let selectedCount = 0;
  let failedCount = 0;

  Object.values(tagState).forEach((item) => {
    if (item.kind === "child") {
      totalChildren++;
      if (item.selected) selectedCount++;
    }
    if (item.status === "failed") failedCount++;
  });

  if (statOverallParents) statOverallParents.textContent = totalParents;
  if (statOverallChildren) statOverallChildren.textContent = totalChildren;
  if (statSelected) statSelected.textContent = selectedCount;

  if (drawerFailCounter) {
    if (failedCount > 0) {
      drawerFailCounter.style.display = "inline-block";
      drawerFailCounter.textContent = `${failedCount} Failures`;
    } else {
      drawerFailCounter.style.display = "none";
    }
  }
}

// Retractable Console Drawer Toggle
function toggleConsoleDrawer() {
  const isExpanded = retractableConsole.classList.toggle("expanded");
  drawerArrow.textContent = isExpanded ? "▼" : "▲";
  toggleDrawerBtn.innerHTML = `${drawerArrow.outerHTML} ${isExpanded ? "Collapse Console" : "Expand Console"}`;
}

consoleToggleBar.addEventListener("click", (e) => {
  // If clear button clicked, don't toggle
  if (e.target.closest("#clearLogsBtn")) return;
  toggleConsoleDrawer();
});

function updateTagStatus(name, status, label, failReason = null) {
  if (tagState[name]) {
    tagState[name].status = status;
    if (failReason) tagState[name].failReason = failReason;
  }
  const el = document.getElementById(`status-${slug(name)}`);
  if (el) {
    el.className = `badge-status ${status}`;
    el.textContent = label || capitalize(status);
    if (failReason) el.title = failReason;
  }
  updateDashboardStats();
}

// Helper to get active credentials safely
function getCredentials() {
  const platEl = document.getElementById("platformSelect");
  const userEl = document.getElementById("usernameInput");
  const passEl = document.getElementById("passwordInput");

  const platform = platEl ? platEl.value : "US2";
  const username = userEl ? userEl.value.trim() : "";
  const password = passEl ? passEl.value : "";
  return { platform, username, password };
}

// -------------------------------------------------------------
// 7. AUTHENTICATION & CONNECTION TESTING
// -------------------------------------------------------------
testAuthBtn.addEventListener("click", async () => {
  const { platform, username, password } = getCredentials();

  if (!username) {
    alert("Please provide an API Username.");
    return;
  }
  if (!password) {
    alert("Please enter the API Password in the input field.");
    const passInputEl = document.getElementById("passwordInput");
    if (passInputEl) passInputEl.focus();
    return;
  }

  testAuthBtn.disabled = true;
  connDot.className = "status-dot active";
  connStatus.textContent = "Verifying...";
  logToConsole(`Authenticating account '${username}' with Qualys API 2.0 on POD ${platform}...`, "info");

  try {
    const res = await fetch("/api/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, username, password }),
    });
    const result = await res.json();
    if (result.success) {
      connDot.style.background = "#22c55e";
      connStatus.textContent = `Connected (${platform})`;
      recordAuditTask({
        action: "Authentication",
        category: "auth",
        type: "success",
        message: `Authenticated account '${username}' successfully on POD ${platform} (API 2.0 verified)`,
        details: {
          username,
          platform,
          protocol: "HTTP Basic Authentication",
          apiVersion: "Qualys API 2.0 (REST/XML)",
          status: "Connected",
        },
      });
      alert(`Success! Successfully authenticated with Qualys ${platform} for user '${username}'.`);
    } else {
      connDot.style.background = "#ef4444";
      connStatus.textContent = "Auth Failed";
      const reason = result.error || result.message;
      recordAuditTask({
        action: "Authentication",
        category: "auth",
        type: "error",
        message: `Authentication failed for account '${username}' on POD ${platform}: ${reason}`,
        details: {
          username,
          platform,
          error: reason,
        },
      });
      alert(`Authentication failed: ${reason}`);
    }
  } catch (err) {
    connDot.style.background = "#ef4444";
    connStatus.textContent = "Network Error";
    recordAuditTask({
      action: "Authentication",
      category: "auth",
      type: "error",
      message: `Connection error reaching POD ${platform} for account '${username}': ${err.message}`,
      details: {
        username,
        platform,
        error: err.message,
      },
    });
    alert(`Could not reach API server: ${err.message}`);
  } finally {
    testAuthBtn.disabled = false;
  }
});

// -------------------------------------------------------------
// 8. EXECUTION ORCHESTRATOR (Selected Tags Only)
// -------------------------------------------------------------
executeBtn.addEventListener("click", async () => {
  if (isProcessing) return;

  const { platform, username, password } = getCredentials();
  const isDryRun = dryRunCheckbox.checked;

  if (!isDryRun && (!username || !password)) {
    alert("Enter API username and password to execute tag creation in target account.");
    return;
  }

  // Count active tags
  const activeChildren = [];
  const activeParents = new Set();

  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    children.forEach((child) => {
      if (tagState[child.name] && tagState[child.name].selected) {
        activeChildren.push(child);
        activeParents.add(parentName);
      }
    });
  });

  if (activeChildren.length === 0) {
    alert("No tags are selected! Please select at least one tag to deploy.");
    return;
  }

  if (!isDryRun) {
    const confirmed = confirm(
      `Deploy ${activeChildren.length} selected tags under ${activeParents.size} parent categories into Qualys ${platform} account '${username}'?\n\nExisting tags will be safely reused without modifying existing rules.`
    );
    if (!confirmed) return;
  }

  isProcessing = true;
  executeBtn.disabled = true;
  testAuthBtn.disabled = true;

  let createdCount = 0;
  let reusedCount = 0;
  let failedCount = 0;
  let bannerOperationResults = []; // [{ type: 'Parent'|'Dynamic Tag', name, parent, criticality, outcome: 'created'|'reused'|'failed', details }]

  if (executionBanner) {
    executionBanner.style.display = "flex";
    if (bannerToggleIcon) {
      bannerToggleIcon.textContent = "▼";
      bannerToggleIcon.classList.remove("expanded");
    }
    if (bannerSubtitle) bannerSubtitle.textContent = `Deploying ${activeChildren.length} tags across ${activeParents.size} categories...`;
    if (bannerDetailsDrawer) bannerDetailsDrawer.classList.remove("open");
  }

  function refreshBannerStats() {
    if (statSuccessBadge) statSuccessBadge.textContent = `✓ ${createdCount} Created`;
    if (statReusedBadge) statReusedBadge.textContent = `⟳ ${reusedCount} Reused`;
    if (statFailedBadge) {
      if (failedCount > 0) {
        statFailedBadge.style.display = "inline-flex";
        statFailedBadge.textContent = `⚠ ${failedCount} Failed`;
      } else {
        statFailedBadge.style.display = "none";
      }
    }
  }
  refreshBannerStats();

  const totalSteps = activeParents.size + activeChildren.length;
  let done = 0;

  logToConsole(`[SESSION START] Deploying ${activeChildren.length} tags [Mode: ${isDryRun ? "DRY RUN (Simulation)" : "LIVE"} on ${platform}] for user '${username}'...`, isDryRun ? "warning" : "info");

  const parentIds = {};

  try {
    // 1. Process Required Parents
    for (const parentName of activeParents) {
      if (progressText) progressText.textContent = `${parentName}`;
      if (bannerSubtitle) bannerSubtitle.textContent = `Processing parent container...`;
      updateTagStatus(parentName, "running", "Checking...");

      if (isDryRun) {
        await sleep(20);
        parentIds[parentName] = `DRY_PARENT_${slug(parentName)}`;
        updateTagStatus(parentName, "planned", "Simulated");
        reusedCount++;
        refreshBannerStats();
        bannerOperationResults.push({
          type: "Parent",
          name: parentName,
          parent: "Root",
          criticality: "—",
          outcome: "reused",
          details: "Dry Run: Simulated existing root parent tag"
        });
        logToConsole(`[DRY RUN] Parent validated: ${parentName}`, "info");
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
          reusedCount++;
          refreshBannerStats();
          bannerOperationResults.push({
            type: "Parent",
            name: parentName,
            parent: "Root",
            criticality: "—",
            outcome: "reused",
            details: `Existing Tag ID: ${findData.existing.id}`
          });
          logToConsole(`REUSE Parent: ${parentName} (ID: ${findData.existing.id})`, "success");
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
            createdCount++;
            refreshBannerStats();
            bannerOperationResults.push({
              type: "Parent",
              name: parentName,
              parent: "Root",
              criticality: "—",
              outcome: "created",
              details: `Newly Created Tag ID: ${createData.result.tagId}`
            });
            logToConsole(`CREATED Parent: ${parentName} (ID: ${createData.result.tagId})`, "success");
          } else {
            const reason = createData.result?.message || createData.error || "Creation failed";
            updateTagStatus(parentName, "failed", "Failed", reason);
            failedCount++;
            refreshBannerStats();
            bannerOperationResults.push({
              type: "Parent",
              name: parentName,
              parent: "Root",
              criticality: "—",
              outcome: "failed",
              details: reason
            });
            logToConsole(`FAILED Parent: ${parentName} - Reason: ${reason}`, "error");
          }
        }
      }
      done++;
      updateProgress(done, totalSteps);
    }

    // 2. Process Selected Children
    for (const child of activeChildren) {
      const parentName = tagState[child.name].parent;
      const parentId = parentIds[parentName];

      if (progressText) progressText.textContent = `${child.name}`;
      if (bannerSubtitle) bannerSubtitle.textContent = `Under: ${parentName}`;
      updateTagStatus(child.name, "running", "Deploying...");

      if (isDryRun) {
        await sleep(15);
        updateTagStatus(child.name, "planned", "Simulated");
        createdCount++;
        refreshBannerStats();
        bannerOperationResults.push({
          type: "Dynamic Tag",
          name: child.name,
          parent: parentName,
          criticality: child.criticality,
          outcome: "created",
          details: `Dry Run: Rule validated [${child.qql}]`
        });
        logToConsole(`[DRY RUN] Child validated: ${child.name}`, "info");
      } else {
        if (!parentId) {
          const reason = `Parent tag '${parentName}' is unavailable`;
          updateTagStatus(child.name, "failed", "Failed", reason);
          failedCount++;
          refreshBannerStats();
          bannerOperationResults.push({
            type: "Dynamic Tag",
            name: child.name,
            parent: parentName,
            criticality: child.criticality,
            outcome: "failed",
            details: reason
          });
          logToConsole(`FAILED Child '${child.name}' - Reason: ${reason}`, "error");
        } else {
          // Check if exists
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
            reusedCount++;
            refreshBannerStats();
            bannerOperationResults.push({
              type: "Dynamic Tag",
              name: child.name,
              parent: parentName,
              criticality: child.criticality,
              outcome: "reused",
              details: `Preserved existing Tag ID: ${findData.existing.id}`
            });
            logToConsole(`REUSE Child: ${child.name} (ID: ${findData.existing.id})`, "success");
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
              createdCount++;
              refreshBannerStats();
              bannerOperationResults.push({
                type: "Dynamic Tag",
                name: child.name,
                parent: parentName,
                criticality: child.criticality,
                outcome: "created",
                details: `Created Tag ID: ${createData.result.tagId}`
              });
              logToConsole(`CREATED Child: ${child.name} (ID: ${createData.result.tagId})`, "success");
            } else {
              const reason = createData.result?.message || createData.error || "Tag rule error or API rejected";
              updateTagStatus(child.name, "failed", "Failed", reason);
              failedCount++;
              refreshBannerStats();
              bannerOperationResults.push({
                type: "Dynamic Tag",
                name: child.name,
                parent: parentName,
                criticality: child.criticality,
                outcome: "failed",
                details: reason
              });
              logToConsole(`FAILED Child '${child.name}' - Reason: ${reason}`, "error");
            }
          }
        }
      }
      done++;
      updateProgress(done, totalSteps);
    }

    // Finished Deployment: Set icon to non-rotating downward pointing triangle ▼
    if (bannerToggleIcon) {
      bannerToggleIcon.textContent = "▼";
      bannerToggleIcon.classList.remove("expanded");
    }
    if (progressText) progressText.textContent = failedCount > 0 ? `Completed with ${failedCount} failure(s) (Click to expand)` : "Deployment Completed Successfully (Click to expand)";
    if (bannerSubtitle) {
      bannerSubtitle.textContent = `${done} total items processed (${createdCount} created, ${reusedCount} reused, ${failedCount} failed) — Click to view details`;
    }
    renderBannerBreakdownTable(bannerOperationResults);

    // Record exactly 1 summary log for the task
    const pctSuccess = totalSteps > 0 ? Math.round(((createdCount + reusedCount) / totalSteps) * 100) : 100;
    const taskAction = isDryRun ? "Dry Run" : "Tag Deployment";
    const summaryMsg = isDryRun
      ? `Dry run was run for ${activeChildren.length} tags and ${activeParents.size} parent tags (${pctSuccess}% successful: ${createdCount} simulated, ${reusedCount} reused, ${failedCount} failed)`
      : `Deployment was run for ${activeChildren.length} tags and ${activeParents.size} parent tags (${pctSuccess}% successful: ${createdCount} created, ${reusedCount} reused, ${failedCount} failed)`;

    recordAuditTask({
      action: taskAction,
      category: "tag",
      type: failedCount > 0 ? (createdCount + reusedCount > 0 ? "warning" : "error") : "success",
      message: summaryMsg,
      details: {
        mode: isDryRun ? "Dry Run (Simulation)" : "Live Deployment",
        parentsProcessed: activeParents.size,
        tagsProcessed: activeChildren.length,
        totalItems: done,
        successRate: `${pctSuccess}%`,
        createdCount,
        reusedCount,
        failedCount,
        items: bannerOperationResults,
      },
    });
  } catch (err) {
    if (bannerToggleIcon) {
      bannerToggleIcon.textContent = "▼";
      bannerToggleIcon.classList.remove("expanded");
    }
    if (progressText) progressText.textContent = "Execution Interrupted";
    if (bannerSubtitle) bannerSubtitle.textContent = err.message;
    recordAuditTask({
      action: isDryRun ? "Dry Run" : "Tag Deployment",
      category: "tag",
      type: "error",
      message: `Execution interrupted: ${err.message}`,
      details: {
        mode: isDryRun ? "Dry Run (Simulation)" : "Live Deployment",
        error: err.message,
        processedBeforeError: done,
        createdCount,
        reusedCount,
        failedCount,
        items: bannerOperationResults,
      },
    });
  } finally {
    isProcessing = false;
    executeBtn.disabled = false;
    testAuthBtn.disabled = false;
  }
});

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  if (progressPercent) progressPercent.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------
// 9. VIEW 2: TAGS CATALOG (Add, Edit, Remove Parents & Tags)
// -------------------------------------------------------------
function renderCatalogView() {
  catalogTableBody.innerHTML = "";

  Object.entries(catalog.parents).forEach(([parentName, children]) => {
    const isCollapsed = collapsedParents.has(parentName);

    // Parent row with collapse/dropdown toggle and actions
    const pRow = document.createElement("tr");
    pRow.className = "parent-row";
    pRow.innerHTML = `
      <td class="tag-name-cell parent-tag-cell">
        <button type="button" class="parent-toggle-btn ${isCollapsed ? "collapsed" : ""}" data-toggle-catalog="${escapeHtml(parentName)}" title="${isCollapsed ? "Expand tags" : "Collapse tags"}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <span class="parent-title-text">${escapeHtml(parentName)}</span>
      </td>
      <td style="color:#64748b; font-size:11px;">Parent Category (${children.length} dynamic tags)</td>
      <td style="text-align:center;"></td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn-action-icon" title="Edit Parent Category" onclick="openEditParentModal('${escapeJsString(parentName)}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Edit
        </button>
        <button class="btn-action-icon delete" title="Delete Category and all its child tags" onclick="deleteParentCategory('${escapeJsString(parentName)}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </td>
    `;
    catalogTableBody.appendChild(pRow);

    // Toggle collapse/expand button in catalog
    const toggleBtn = pRow.querySelector(".parent-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      if (collapsedParents.has(parentName)) {
        collapsedParents.delete(parentName);
      } else {
        collapsedParents.add(parentName);
      }
      renderCatalogView();
    });

    // Sub-tags inside this parent (hidden if collapsed, no parent name repeated)
    if (!isCollapsed) {
      children.forEach((child, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="tag-name-cell sub-tag-cell">
            <span class="sub-tag-branch">↳</span>
            <span style="font-weight:500;">${escapeHtml(child.name)}</span>
          </td>
          <td><span class="qql-code">${escapeHtml(child.qql)}</span></td>
          <td style="text-align:center;">${renderCritBadge(child.criticality)}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn-action-icon" title="Edit tag" onclick="openEditChildModal('${escapeJsString(parentName)}', ${index})">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Edit
            </button>
            <button class="btn-action-icon delete" title="Delete tag" onclick="deleteChildTag('${escapeJsString(parentName)}', ${index})">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </td>
        `;
        catalogTableBody.appendChild(row);
      });
    }
  });
}

function escapeJsString(str) {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Modal: Add / Edit Parent Tag
let editingParentName = null;

openNewParentModalBtn.addEventListener("click", () => {
  editingParentName = null;
  if (parentModalTitle) parentModalTitle.textContent = "Create Parent Tag";
  if (saveParentBtn) saveParentBtn.textContent = "Add Parent Tag";
  newParentName.value = "";
  parentModal.classList.add("open");
  newParentName.focus();
});

window.openEditParentModal = function(parentName) {
  editingParentName = parentName;
  if (parentModalTitle) parentModalTitle.textContent = "Edit Parent Tag";
  if (saveParentBtn) saveParentBtn.textContent = "Save Changes";
  newParentName.value = parentName;
  parentModal.classList.add("open");
  newParentName.focus();
};

closeParentModalBtn.addEventListener("click", () => parentModal.classList.remove("open"));
cancelParentBtn.addEventListener("click", () => parentModal.classList.remove("open"));

saveParentBtn.addEventListener("click", () => {
  const name = newParentName.value.trim();
  if (!name) {
    alert("Please enter a Parent Tag Name.");
    return;
  }

  if (editingParentName !== null) {
    // Edit / Rename Mode
    if (name === editingParentName) {
      parentModal.classList.remove("open");
      return;
    }
    if (catalog.parents[name]) {
      alert("A parent category with this name already exists.");
      return;
    }

    const children = catalog.parents[editingParentName] || [];
    delete catalog.parents[editingParentName];
    catalog.parents[name] = children;

    const oldParentState = tagState[editingParentName];
    delete tagState[editingParentName];
    tagState[name] = oldParentState || { kind: "parent", selected: true, status: "planned", failReason: null, id: null };

    children.forEach((c) => {
      if (tagState[c.name]) {
        tagState[c.name].parent = name;
      }
    });

    if (collapsedParents.has(editingParentName)) {
      collapsedParents.delete(editingParentName);
      collapsedParents.add(name);
    }
    if (currentFilter === editingParentName) {
      currentFilter = name;
    }

    parentModal.classList.remove("open");
    renderPills();
    renderCatalogView();
    renderDashboardTable();
    recordAuditTask({
      action: "Parent Rename",
      category: "tag",
      type: "info",
      message: `Renamed parent category '${editingParentName}' to '${name}' (${children.length} dynamic tags preserved)`,
      details: {
        mode: "edit",
        parentName: name,
        changes: [{ field: "Parent Name", from: editingParentName, to: name }],
        affectedTagsCount: children.length,
        affectedTags: children.map((c) => c.name),
      },
    });
  } else {
    // Create Mode
    if (catalog.parents[name]) {
      alert("A parent category with this name already exists.");
      return;
    }

    catalog.parents[name] = [];
    tagState[name] = { kind: "parent", selected: true, status: "planned", failReason: null, id: null };

    parentModal.classList.remove("open");
    renderPills();
    renderCatalogView();
    renderDashboardTable();
    recordAuditTask({
      action: "Parent Create",
      category: "tag",
      type: "success",
      message: `Created new parent category '${name}'`,
      details: {
        mode: "create",
        parentName: name,
        childCount: 0,
      },
    });
  }
});

// Modal: Add / Edit Child Tag
openNewChildModalBtn.addEventListener("click", () => {
  editingChildTag = null;
  childModalTitle.textContent = "Create Dynamic Child Tag";
  childTagName.value = "";
  childTagQql.value = "";
  childTagCriticality.value = "3";
  populateChildParentSelect();
  childModal.classList.add("open");
});

function populateChildParentSelect(selectedParent = null) {
  childParentSelect.innerHTML = "";
  Object.keys(catalog.parents).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    if (selectedParent === p) opt.selected = true;
    childParentSelect.appendChild(opt);
  });
}

closeChildModalBtn.addEventListener("click", () => childModal.classList.remove("open"));
cancelChildBtn.addEventListener("click", () => childModal.classList.remove("open"));

window.openEditChildModal = function(parentName, index) {
  const child = catalog.parents[parentName][index];
  if (!child) return;

  editingChildTag = { parent: parentName, index, originalName: child.name };
  childModalTitle.textContent = "Edit Dynamic Tag";
  populateChildParentSelect(parentName);
  childTagName.value = child.name;
  childTagQql.value = child.qql;
  childTagCriticality.value = String(child.criticality);
  childModal.classList.add("open");
};

window.deleteChildTag = function(parentName, index) {
  const child = catalog.parents[parentName][index];
  if (!child) return;
  if (!confirm(`Are you sure you want to remove '${child.name}' from the catalog?`)) return;

  const deletedChild = { ...child };
  delete tagState[child.name];
  catalog.parents[parentName].splice(index, 1);
  renderCatalogView();
  renderDashboardTable();
  recordAuditTask({
    action: "Tag Remove",
    category: "tag",
    type: "warning",
    message: `Deleted dynamic tag '${deletedChild.name}' from parent category '${parentName}'`,
    details: {
      mode: "delete",
      tagName: deletedChild.name,
      parentName: parentName,
      qql: deletedChild.qql,
      criticality: deletedChild.criticality,
    },
  });
};

window.deleteParentCategory = function(parentName) {
  if (!confirm(`Are you sure you want to delete category '${parentName}' and all tags within it?`)) return;

  const deletedChildren = catalog.parents[parentName] ? [...catalog.parents[parentName]] : [];
  if (catalog.parents[parentName]) {
    catalog.parents[parentName].forEach((child) => delete tagState[child.name]);
    delete tagState[parentName];
    delete catalog.parents[parentName];
  }

  renderPills();
  renderCatalogView();
  renderDashboardTable();
  recordAuditTask({
    action: "Parent Delete",
    category: "tag",
    type: "warning",
    message: `Deleted parent category '${parentName}' and ${deletedChildren.length} dynamic tags`,
    details: {
      mode: "delete",
      parentName: parentName,
      deletedTagsCount: deletedChildren.length,
      deletedTags: deletedChildren.map((c) => c.name),
    },
  });
};

saveChildBtn.addEventListener("click", () => {
  const parentName = childParentSelect.value;
  const name = childTagName.value.trim();
  const qql = childTagQql.value.trim();
  const crit = parseInt(childTagCriticality.value, 10);

  if (!parentName || !name || !qql) {
    alert("Please fill in Parent Category, Tag Name, and QQL Rule.");
    return;
  }

  if (editingChildTag) {
    // Edit mode
    const oldChild = catalog.parents[editingChildTag.parent][editingChildTag.index];
    const changes = [];
    if (editingChildTag.originalName !== name) {
      changes.push({ field: "Tag Name", from: editingChildTag.originalName, to: name });
    }
    if (editingChildTag.parent !== parentName) {
      changes.push({ field: "Parent Category", from: editingChildTag.parent, to: parentName });
    }
    if (oldChild.qql !== qql) {
      changes.push({ field: "QQL Dynamic Rule", from: oldChild.qql, to: qql });
    }
    if (oldChild.criticality !== crit) {
      changes.push({ field: "Criticality Score", from: String(oldChild.criticality), to: String(crit) });
    }

    if (editingChildTag.parent !== parentName) {
      // Moved to different parent
      catalog.parents[editingChildTag.parent].splice(editingChildTag.index, 1);
      catalog.parents[parentName].push({ name, qql, criticality: crit });
    } else {
      oldChild.name = name;
      oldChild.qql = qql;
      oldChild.criticality = crit;
    }

    if (editingChildTag.originalName !== name) {
      delete tagState[editingChildTag.originalName];
    }
    tagState[name] = { kind: "child", parent: parentName, qql, criticality: crit, selected: true, status: "planned", id: null };

    const changeCountStr = changes.length > 0 ? `${changes.length} change${changes.length === 1 ? "" : "s"} made` : "no field changes";
    recordAuditTask({
      action: "Tag Edit",
      category: "tag",
      type: "success",
      message: `Updated tag '${name}' (${changeCountStr})`,
      details: {
        mode: "edit",
        tagName: name,
        parentName: parentName,
        changes: changes,
        qql: qql,
        criticality: crit,
      },
    });
  } else {
    // Create mode
    catalog.parents[parentName].push({ name, qql, criticality: crit });
    tagState[name] = { kind: "child", parent: parentName, qql, criticality: crit, selected: true, status: "planned", id: null };
    recordAuditTask({
      action: "Tag Create",
      category: "tag",
      type: "success",
      message: `Created new dynamic tag '${name}' under parent category '${parentName}'`,
      details: {
        mode: "create",
        tagName: name,
        parentName: parentName,
        qql: qql,
        criticality: crit,
      },
    });
  }

  childModal.classList.remove("open");
  renderCatalogView();
  renderDashboardTable();
});

resetDefaultCatalogBtn.addEventListener("click", () => {
  if (confirm("Reset catalog back to initial 58 dynamic tags and 9 parents?")) {
    loadCatalog();
  }
});

// -------------------------------------------------------------
// 11. VIEW 4: API SETTINGS VIEW
// -------------------------------------------------------------
function renderApiSettingsView() {
  apiPlatformsTableBody.innerHTML = "";
  const baseUrls = {
    "US1": "https://qualysapi.qualys.com",
    "US2": "https://qualysapi.qg2.apps.qualys.com",
    "US3": "https://qualysapi.qg3.apps.qualys.com",
    "US4": "https://qualysapi.qg4.apps.qualys.com",
    "UK": "https://qualysapi.qg1.apps.qualys.co.uk",
    "EU1": "https://qualysapi.qualys.eu",
    "EU2": "https://qualysapi.qg2.apps.qualys.eu",
    "EU3": "https://qualysapi.qg3.apps.qualys.it",
    "IN": "https://qualysapi.qg1.apps.qualys.in",
    "CA": "https://qualysapi.qg1.apps.qualys.ca",
    "AE": "https://qualysapi.qg1.apps.qualys.ae",
    "AU": "https://qualysapi.qg1.apps.qualys.com.au",
    "KSA": "https://qualysapi.qg1.apps.qualysksa.com",
  };

  Object.entries(baseUrls).forEach(([pod, url]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(pod)}</strong></td>
      <td><span class="qql-code" style="color:#0369a1;">${escapeHtml(url)}</span></td>
    `;
    apiPlatformsTableBody.appendChild(row);
  });
}

// -------------------------------------------------------------
// 12. EXPORT SESSION REPORT
// -------------------------------------------------------------
if (exportReportBtn) {
  exportReportBtn.addEventListener("click", () => {
    const report = {
      sessionTimestamp: new Date().toISOString(),
      account: {
        platform: platformSelect.value,
        username: usernameInput.value.trim(),
      },
      dryRun: dryRunCheckbox.checked,
      tagOperations: Object.entries(tagState)
        .filter(([_, item]) => item.selected)
        .map(([name, item]) => ({
          name,
          kind: item.kind,
          parent: item.parent || null,
          qql: item.qql || null,
          criticality: item.criticality || null,
          status: item.status,
          failureReason: item.failReason,
        })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qualys-session-report-${platformSelect.value}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

refreshBtn.addEventListener("click", () => {
  if (confirm("Reset current session progress and reload clean tags?")) {
    initTagState();
    renderDashboardTable();
    recordAuditTask({
      action: "Session Reset",
      category: "general",
      type: "info",
      message: "Session progress and live tag statuses reset to default.",
      details: { mode: "reset" },
    });
  }
});

// -------------------------------------------------------------
// 13. EXECUTION BANNER BREAKDOWN & COLLAPSIBLE CONTROLS
// -------------------------------------------------------------
let lastBannerResults = [];
let bannerDetailsFilter = "ALL";

function renderBannerBreakdownTable(results = lastBannerResults) {
  lastBannerResults = results || [];
  if (!bannerDetailsTableBody) return;
  bannerDetailsTableBody.innerHTML = "";

  const filtered = lastBannerResults.filter((item) => {
    if (bannerDetailsFilter === "ALL") return true;
    return item.outcome === bannerDetailsFilter;
  });

  if (filtered.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="6" style="text-align:center; color:#94a3b8; padding:14px;">No items match the '${escapeHtml(bannerDetailsFilter)}' filter.</td>`;
    bannerDetailsTableBody.appendChild(emptyRow);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("tr");
    const outcomeBadgeClass = item.outcome === "created" ? "created" : (item.outcome === "reused" ? "reused" : "failed");
    const outcomeLabel = item.outcome === "created" ? "Created" : (item.outcome === "reused" ? "Reused" : "Failed");
    const critDisplay = item.criticality !== undefined && item.criticality !== null && item.criticality !== "—" ? item.criticality : "—";
    const typeBadgeStyle = item.type === "Parent" 
      ? "background:#fef3c7; color:#92400e; font-weight:600;" 
      : "background:#e0e7ff; color:#3730a3; font-weight:600;";

    row.innerHTML = `
      <td><span class="crit-badge" style="${typeBadgeStyle}">${escapeHtml(item.type)}</span></td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.parent || "Root")}</td>
      <td style="text-align:center;">${item.type === "Parent" ? "" : renderCritBadge(item.criticality)}</td>
      <td style="text-align:center;"><span class="badge-status ${outcomeBadgeClass}">${outcomeLabel}</span></td>
      <td style="font-size:11px; color:#475569;">${escapeHtml(item.details || "—")}</td>
    `;
    bannerDetailsTableBody.appendChild(row);
  });
}

// Collapsible Banner Toggle (expands/collapses details drawer)
function toggleBannerDetails() {
  if (!bannerDetailsDrawer) return;
  const isCurrentlyOpen = bannerDetailsDrawer.classList.contains("open");
  if (isCurrentlyOpen) {
    bannerDetailsDrawer.classList.remove("open");
    if (bannerToggleIcon) bannerToggleIcon.classList.remove("expanded");
  } else {
    bannerDetailsDrawer.classList.add("open");
    if (bannerToggleIcon) bannerToggleIcon.classList.add("expanded");
    renderBannerBreakdownTable();
  }
}

if (bannerToggleHeader) {
  bannerToggleHeader.addEventListener("click", toggleBannerDetails);
}
if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (executionBanner) executionBanner.style.display = "none";
  });
}

// Drawer outcome filter pills
document.querySelectorAll("#bannerDetailsDrawer .drawer-filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#bannerDetailsDrawer .drawer-filter-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    bannerDetailsFilter = pill.getAttribute("data-filter");
    renderBannerBreakdownTable();
  });
});

// -------------------------------------------------------------
// 14. VIEW 5: ACTIVITY LOGS AUDIT TRAIL
// -------------------------------------------------------------
function renderLogsView() {
  const { platform, username } = getCredentials();
  const activeUser = username || "testq2st5";
  const activePod = platform || "US2";

  if (logUserAccount) {
    logUserAccount.textContent = activeUser;
  }
  if (logUserPod) {
    logUserPod.textContent = activePod;
  }

  const total = auditLogs.length;
  const successes = auditLogs.filter((l) => l.type === "success").length;
  const failures = auditLogs.filter((l) => l.type === "error").length;

  if (logTotalCount) logTotalCount.textContent = total;
  if (logSuccessCount) logSuccessCount.textContent = successes;
  if (logFailCount) logFailCount.textContent = failures;

  if (!logsDetailedFeed) return;
  logsDetailedFeed.innerHTML = "";

  const query = (logSearchInput?.value || "").toLowerCase().trim();

  const filteredLogs = auditLogs.filter((entry) => {
    // Category filter
    if (currentLogCategoryFilter !== "ALL") {
      if (currentLogCategoryFilter === "error") {
        if (entry.type !== "error" && entry.type !== "warning") return false;
      } else if (entry.category !== currentLogCategoryFilter) {
        return false;
      }
    }
    // Search keyword
    if (query) {
      const matchText = `${entry.istTimestamp} ${entry.user} ${entry.pod} ${entry.action} ${entry.category} ${entry.type} ${entry.message}`.toLowerCase();
      if (!matchText.includes(query)) return false;
    }
    return true;
  });

  if (filteredLogs.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="6" style="text-align:center; padding: 40px 16px; color: #64748b;">
        <p style="font-size: 13px; font-weight: 600; margin-bottom: 4px; color:#475569;">No Activity Logs Found</p>
        <p style="font-size: 11px; margin: 0;">Any configuration changes, deployments, or API actions in this session will be recorded here.</p>
      </td>
    `;
    logsDetailedFeed.appendChild(tr);
    return;
  }

  filteredLogs.forEach((entry) => {
    const row = document.createElement("tr");

    // Action badge styling
    let badgeClass = "general";
    const actLower = (entry.action || "").toLowerCase();
    if (entry.category === "tag" || actLower.includes("tag") || actLower.includes("parent")) {
      badgeClass = "tag";
    } else if (entry.category === "auth" || actLower.includes("auth")) {
      badgeClass = "auth";
    } else if (entry.type === "error") {
      badgeClass = "error";
    }

    // Status badge class and label
    let statusBadgeClass = "planned";
    let statusText = "Info";
    if (entry.type === "success") {
      statusBadgeClass = "created";
      statusText = "Success";
    } else if (entry.type === "error") {
      statusBadgeClass = "failed";
      statusText = "Failed";
    } else if (entry.type === "warning") {
      statusBadgeClass = "running";
      statusText = "Warning";
    }

    const userInitials = entry.user && entry.user.length >= 2 ? entry.user.substring(0, 2).toUpperCase() : "US";
    const isExpanded = expandedLogDetails.has(entry.id);

    if (entry.details) {
      row.classList.add("log-row-expandable");
      row.title = isExpanded ? "Click to collapse details" : "Click to view changes & operational breakdown";
      row.addEventListener("click", () => toggleLogDetails(entry.id));
    }

    row.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 11px; color: #334155; font-weight: 500; white-space: nowrap;">
        ${escapeHtml(entry.istTimestamp)}
      </td>
      <td style="white-space: nowrap;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="user-avatar-small">${escapeHtml(userInitials)}</div>
          <strong style="color: #0f172a; font-weight: 600; font-size: 11.5px;">${escapeHtml(entry.user)}</strong>
        </div>
      </td>
      <td style="text-align: center; white-space: nowrap;">
        <span class="pod-chip">${escapeHtml(entry.pod)}</span>
      </td>
      <td style="white-space: nowrap;">
        <span class="action-type-badge ${badgeClass}">${escapeHtml(entry.action)}</span>
      </td>
      <td style="font-size: 12px; color: #1e293b; line-height: 1.45;">
        <div style="font-weight: 500; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span>${escapeHtml(entry.message)}</span>
          ${entry.details ? `<span style="font-size: 10px; color: #94a3b8; flex-shrink: 0;" title="${isExpanded ? 'Collapse' : 'Expand'}">${isExpanded ? "▲" : "▼"}</span>` : ""}
        </div>
      </td>
      <td style="text-align: center; white-space: nowrap;">
        <span class="badge-status ${statusBadgeClass}">${escapeHtml(statusText)}</span>
      </td>
    `;
    logsDetailedFeed.appendChild(row);

    // If expanded, render the details row right beneath the task row
    if (isExpanded && entry.details) {
      const detailRow = document.createElement("tr");
      detailRow.className = "log-details-row";
      detailRow.innerHTML = `
        <td colspan="6" class="log-details-cell">
          ${renderTaskDetailsHtml(entry)}
        </td>
      `;
      logsDetailedFeed.appendChild(detailRow);
    }
  });
}

function renderTaskDetailsHtml(entry) {
  if (!entry || !entry.details) return "";

  // 1. Tag Edits & Parent Renames with Before -> After Diffs
  if (entry.details.changes && entry.details.changes.length > 0) {
    const targetLabel = entry.details.tagName || entry.details.parentName || "Item";
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Changes Made to '${escapeHtml(targetLabel)}'
          </div>
          <span style="font-size:11px; color:#64748b; font-weight:500;">${entry.details.changes.length} field change${entry.details.changes.length === 1 ? "" : "s"}</span>
        </div>
        <div class="log-diff-grid">
          ${entry.details.changes
            .map(
              (c) => `
            <div class="log-diff-item">
              <span class="log-diff-field">${escapeHtml(c.field)}</span>
              <div class="log-diff-values">
                <span class="diff-chip-old">${escapeHtml(String(c.from))}</span>
                <span class="diff-arrow">→</span>
                <span class="diff-chip-new">${escapeHtml(String(c.to))}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // 2. Item Creation (Dynamic Tag or Parent Category)
  if (entry.details.mode === "create") {
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Created Item Configuration
          </div>
          <span style="font-size:11px; color:#16a34a; font-weight:600;">✓ Ready for Deployment</span>
        </div>
        <div class="log-diff-grid">
          ${entry.details.tagName ? `<div class="log-diff-item"><span class="log-diff-field">Tag Name</span><div><strong style="color:#0f172a;">${escapeHtml(entry.details.tagName)}</strong></div></div>` : ""}
          ${entry.details.parentName ? `<div class="log-diff-item"><span class="log-diff-field">Parent Category</span><div>${escapeHtml(entry.details.parentName)}</div></div>` : ""}
          ${entry.details.qql ? `<div class="log-diff-item"><span class="log-diff-field">QQL Dynamic Rule</span><div><span class="qql-code">${escapeHtml(entry.details.qql)}</span></div></div>` : ""}
          ${entry.details.criticality !== undefined ? `<div class="log-diff-item"><span class="log-diff-field">Criticality</span><div>${renderCritBadge(entry.details.criticality)}</div></div>` : ""}
        </div>
      </div>
    `;
  }

  // 3. Item Deletion (Tag or Parent)
  if (entry.details.mode === "delete") {
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Deleted Item Information
          </div>
          <span style="font-size:11px; color:#dc2626; font-weight:600;">Removed from Catalog</span>
        </div>
        <div class="log-diff-grid">
          ${entry.details.tagName ? `<div class="log-diff-item"><span class="log-diff-field">Tag Name</span><div><span class="diff-chip-old">${escapeHtml(entry.details.tagName)}</span></div></div>` : ""}
          ${entry.details.parentName ? `<div class="log-diff-item"><span class="log-diff-field">Parent Category</span><div>${escapeHtml(entry.details.parentName)}</div></div>` : ""}
          ${entry.details.qql ? `<div class="log-diff-item"><span class="log-diff-field">QQL Rule</span><div><span class="qql-code" style="text-decoration:line-through;">${escapeHtml(entry.details.qql)}</span></div></div>` : ""}
          ${entry.details.deletedTags ? `
            <div class="log-diff-item">
              <span class="log-diff-field">Removed Tags (${entry.details.deletedTagsCount})</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${entry.details.deletedTags.map((t) => `<span class="diff-chip-old">${escapeHtml(t)}</span>`).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // 4. Dry Run or Live Deployment Itemized Breakdown
  if (entry.details.items && Array.isArray(entry.details.items)) {
    const isDry = (entry.details.mode || "").toLowerCase().includes("dry");
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            ${escapeHtml(entry.details.mode || "Execution")} Breakdown (${entry.details.totalItems || entry.details.items.length} items processed)
          </div>
          <span style="font-size:11px; color:#475569; font-weight:600;">${entry.details.parentsProcessed || 0} Parents · ${entry.details.tagsProcessed || 0} Dynamic Tags</span>
        </div>
        <div class="log-kpi-bar">
          <span class="log-kpi-chip created">✓ ${entry.details.createdCount || 0} ${isDry ? "Simulated" : "Created"}</span>
          <span class="log-kpi-chip reused">⟳ ${entry.details.reusedCount || 0} Reused</span>
          ${entry.details.failedCount > 0 ? `<span class="log-kpi-chip failed">⚠ ${entry.details.failedCount} Failed</span>` : ""}
          <span class="log-kpi-chip rate">Success Rate: ${entry.details.successRate || "100%"}</span>
        </div>
        <div class="log-breakdown-table-wrap">
          <table class="log-breakdown-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Parent Category</th>
                <th style="text-align:center;">Criticality</th>
                <th style="text-align:center;">Outcome</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${entry.details.items
                .map(
                  (item) => `
                <tr>
                  <td><span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; ${item.type === "Parent" ? "background:#fef3c7; color:#92400e;" : "background:#e0e7ff; color:#3730a3;"}">${escapeHtml(item.type)}</span></td>
                  <td><strong>${escapeHtml(item.name)}</strong></td>
                  <td>${escapeHtml(item.parent || "Root")}</td>
                  <td style="text-align:center;">${item.type === "Parent" ? "—" : renderCritBadge(item.criticality)}</td>
                  <td style="text-align:center;"><span class="badge-status ${item.outcome === "created" ? "created" : item.outcome === "reused" ? "reused" : "failed"}">${capitalize(item.outcome)}</span></td>
                  <td style="font-size:11px; color:#475569;">${escapeHtml(item.details || "—")}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 5. Authentication Telemetry
  if (entry.category === "auth" || entry.details.protocol || entry.details.apiVersion) {
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            API Authentication Telemetry
          </div>
        </div>
        <div class="log-diff-grid">
          <div class="log-diff-item"><span class="log-diff-field">Account</span><div><strong>${escapeHtml(entry.details.username || entry.user)}</strong></div></div>
          <div class="log-diff-item"><span class="log-diff-field">Target POD</span><div><span class="pod-chip">${escapeHtml(entry.details.platform || entry.pod)}</span></div></div>
          ${entry.details.apiVersion ? `<div class="log-diff-item"><span class="log-diff-field">API Version</span><div>${escapeHtml(entry.details.apiVersion)}</div></div>` : ""}
          ${entry.details.protocol ? `<div class="log-diff-item"><span class="log-diff-field">Protocol</span><div>${escapeHtml(entry.details.protocol)}</div></div>` : ""}
          ${entry.details.status ? `<div class="log-diff-item"><span class="log-diff-field">Connection Status</span><div><span class="badge-status created">${escapeHtml(entry.details.status)}</span></div></div>` : ""}
          ${entry.details.error ? `<div class="log-diff-item"><span class="log-diff-field">Failure Diagnostic</span><div style="color:#dc2626; font-weight:600;">${escapeHtml(entry.details.error)}</div></div>` : ""}
        </div>
      </div>
    `;
  }

  // 6. Catalog Initialization Telemetry
  if (entry.details.parentsCount !== undefined) {
    return `
      <div class="log-subdetails-box">
        <div class="log-subdetails-header">
          <div class="log-subdetails-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Catalog Initialization Telemetry
          </div>
        </div>
        <div class="log-diff-grid">
          <div class="log-diff-item"><span class="log-diff-field">Parent Categories</span><div><strong>${entry.details.parentsCount} categories</strong></div></div>
          <div class="log-diff-item"><span class="log-diff-field">Dynamic Tags</span><div><strong>${entry.details.tagsCount} dynamic tags</strong></div></div>
          ${entry.details.categories ? `
            <div class="log-diff-item">
              <span class="log-diff-field">Categories</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${entry.details.categories.map((cat) => `<span class="diff-chip-new" style="background:#f1f5f9; color:#334155; border-color:#cbd5e1;">${escapeHtml(cat)}</span>`).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // 7. Generic Fallback
  return `
    <div class="log-subdetails-box">
      <pre style="font-family:var(--font-mono); font-size:11px; margin:0; white-space:pre-wrap;">${escapeHtml(JSON.stringify(entry.details, null, 2))}</pre>
    </div>
  `;
}

// Activity Logs Filter Pills
document.querySelectorAll(".log-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".log-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLogCategoryFilter = btn.getAttribute("data-type");
    renderLogsView();
  });
});

if (logSearchInput) {
  logSearchInput.addEventListener("input", () => {
    renderLogsView();
  });
}

if (viewClearLogsBtn) {
  viewClearLogsBtn.addEventListener("click", () => {
    if (confirm("Clear all recorded session activity logs?")) {
      auditLogs = [];
      logCount = 0;
      if (consoleLogs) consoleLogs.innerHTML = "";
      if (logSummary) logSummary.textContent = "Logs cleared";
      renderLogsView();
    }
  });
}

if (viewCopyLogsBtn) {
  viewCopyLogsBtn.addEventListener("click", () => {
    if (auditLogs.length === 0) {
      alert("No activity logs to copy.");
      return;
    }
    const formatted = auditLogs
      .map(
        (l) =>
          `[${l.istTimestamp}] [USER: ${l.user}] [POD: ${l.pod}] [ACTION: ${l.action}] [STATUS: ${l.type.toUpperCase()}] ${l.message}`
      )
      .join("\n");
    navigator.clipboard.writeText(formatted).then(() => {
      const originalHtml = viewCopyLogsBtn.innerHTML;
      viewCopyLogsBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        viewCopyLogsBtn.innerHTML = originalHtml;
      }, 2000);
    });
  });
}

// INITIALIZE
loadCatalog();
