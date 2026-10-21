export const BASE_URLS = {
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

export const PARENTS = {
  "OS: Operating Systems": [
    { name: "OS: Windows Server", qql: "operatingSystem.category1:`Windows` and operatingSystem.category2:`Server`", criticality: 4 },
    { name: "OS: Windows Client", qql: "operatingSystem.category1:`Windows` and operatingSystem.category2:`Client`", criticality: 2 },
    { name: "OS: Linux Server", qql: "operatingSystem.category1:`Linux` and operatingSystem.category2:`Server`", criticality: 4 },
    { name: "OS: Linux Client", qql: "operatingSystem.category1:`Linux` and operatingSystem.category2:`Client`", criticality: 2 },
    { name: "OS: Network OS", qql: "operatingSystem.category1:`Network Operating System`", criticality: 3 },
  ],
  "Type: Asset Types": [
    { name: "Type: Servers", qql: "operatingSystem.category2:`Server` or hardware.category2:`Server`", criticality: 4 },
    { name: "Type: Database Servers", qql: "software:(category1:`Databases` and component:`Server`) and (hardware.category2:`Server` or operatingSystem.category2:`Server`)", criticality: 4 },
    { name: "Type: Domain Controllers", qql: "compute.domainRole:`Primary Domain Controller`", criticality: 5 },
    { name: "Type: Clients/Workstations", qql: "operatingSystem.category2:`Client` or hardware.category2:`Desktop`", criticality: 2 },
    { name: "Type: Network Devices", qql: "hardware.category1:`Networking Device` or hardware.category1:`Network Security Device`", criticality: 3 },
    { name: "Type: Printers", qql: "hardware.category1:`Printers`", criticality: 1 },
  ],
  "OS Version: Windows Client": [
    { name: "OS Version: Windows 11", qql: "operatingSystem.name:`Microsoft Windows 11`", criticality: 3 },
    { name: "OS Version: Windows 10", qql: "operatingSystem.name:`Microsoft Windows 10`", criticality: 3 },
    { name: "OS Version: Windows 8.1", qql: "operatingSystem.name:`Microsoft Windows 8.1`", criticality: 3 },
    { name: "OS Version: Windows 7", qql: "operatingSystem.name:`Microsoft Windows 7`", criticality: 3 },
  ],
  "OS Version: Windows Server": [
    { name: "OS Version: Windows Server 2025", qql: "operatingSystem.name:`Microsoft Windows Server 2025`", criticality: 3 },
    { name: "OS Version: Windows Server 2022", qql: "operatingSystem.name:`Microsoft Windows Server 2022`", criticality: 3 },
    { name: "OS Version: Windows Server 2019", qql: "operatingSystem.name:`Microsoft Windows Server 2019`", criticality: 3 },
    { name: "OS Version: Windows Server 2016", qql: "operatingSystem.name:`Microsoft Windows Server 2016`", criticality: 3 },
    { name: "OS Version: Windows Server 2012 R2", qql: "operatingSystem.name:`Microsoft Windows Server 2012 R2`", criticality: 3 },
    { name: "OS Version: Windows Server 2012", qql: "operatingSystem.name:`Microsoft Windows Server 2012`", criticality: 3 },
    { name: "OS Version: Windows Server 2008 R2", qql: "operatingSystem.name:`Microsoft Windows Server 2008 R2`", criticality: 3 },
  ],
  "OS Version: Linux": [
    { name: "OS Version: Ubuntu", qql: "operatingSystem.name:`Ubuntu`", criticality: 3 },
    { name: "OS Version: Red Hat Enterprise Linux", qql: "operatingSystem.name:`Red Hat Enterprise Linux`", criticality: 3 },
    { name: "OS Version: SUSE Linux Enterprise Server", qql: "operatingSystem.name:`SUSE Linux Enterprise Server`", criticality: 3 },
    { name: "OS Version: Debian", qql: "operatingSystem.name:`Debian`", criticality: 3 },
    { name: "OS Version: Oracle Linux", qql: "operatingSystem.name:`Oracle Linux`", criticality: 3 },
    { name: "OS Version: Amazon Linux", qql: "operatingSystem.name:`Amazon Linux`", criticality: 3 },
  ],
  "Lifecycle: OS Support Status": [
    { name: "Lifecycle: OS End-of-Life", qql: "operatingSystem.lifecycle.stage:`EOL`", criticality: 4 },
    { name: "Lifecycle: OS End-of-Life / End-of-Support", qql: "operatingSystem.lifecycle.stage:`EOL/EOS`", criticality: 4 },
    { name: "Lifecycle: OS Lifecycle Unknown", qql: "operatingSystem.lifecycle.stage:`Unknown`", criticality: 3 },
  ],
  "Lifecycle: Hardware Support Status": [
    { name: "Lifecycle: Hardware End of Sale", qql: "hardware.lifecycle.stage:`EOS`", criticality: 3 },
    { name: "Lifecycle: Hardware Obsolete", qql: "hardware.lifecycle.stage:`OBS`", criticality: 4 },
    { name: "Lifecycle: Hardware Lifecycle Unknown", qql: "hardware.lifecycle.stage:`Unknown`", criticality: 3 },
  ],
  "Cloud: Provider / Discovery Source": [
    { name: "Cloud: AWS / EC2", qql: "asset.inventory:(source: EC2)", criticality: 3 },
    { name: "Cloud: Azure", qql: "asset.inventory:(source: Azure)", criticality: 3 },
    { name: "Cloud: Google Cloud", qql: "asset.inventory:(source: GCP)", criticality: 3 },
    { name: "Cloud: Oracle Cloud (OCI)", qql: "asset.inventory:(source: OCI)", criticality: 3 },
  ],
  "Discovery: Asset Source": [
    { name: "Discovery: API", qql: "asset.inventory:(source: API)", criticality: 3 },
    { name: "Discovery: Active Directory", qql: "asset.inventory:(source: `Active Directory`)", criticality: 3 },
    { name: "Discovery: Appliance", qql: "asset.inventory:(source: Appliance)", criticality: 3 },
    { name: "Discovery: Azure", qql: "asset.inventory:(source: Azure)", criticality: 3 },
    { name: "Discovery: BMC Helix", qql: "asset.inventory:(source: `BMC Helix`)", criticality: 3 },
    { name: "Discovery: CAPS", qql: "asset.inventory:(source: CAPS)", criticality: 3 },
    { name: "Discovery: CMDB", qql: "asset.inventory:(source: CMDB)", criticality: 3 },
    { name: "Discovery: Cloud Agent", qql: "asset.inventory:(source: `Cloud Agent`)", criticality: 3 },
    { name: "Discovery: EASM", qql: "asset.inventory:(source: EASM)", criticality: 3 },
    { name: "Discovery: EC2", qql: "asset.inventory:(source: EC2)", criticality: 3 },
    { name: "Discovery: GCP", qql: "asset.inventory:(source: GCP)", criticality: 3 },
    { name: "Discovery: ICS OCA", qql: "asset.inventory:(source: `ICS OCA`)", criticality: 3 },
    { name: "Discovery: IP Scanner", qql: "asset.inventory:(source: `IP Scanner`)", criticality: 3 },
    { name: "Discovery: Malware Domain", qql: "asset.inventory:(source: `Malware Domain`)", criticality: 3 },
    { name: "Discovery: OCA", qql: "asset.inventory:(source: OCA)", criticality: 3 },
    { name: "Discovery: OCI", qql: "asset.inventory:(source: OCI)", criticality: 3 },
    { name: "Discovery: Passive Sensor", qql: "asset.inventory:(source: `Passive Sensor`)", criticality: 3 },
    { name: "Discovery: ServiceNow", qql: "asset.inventory:(source: ServiceNow)", criticality: 3 },
    { name: "Discovery: VMWare vSphere", qql: "asset.inventory:(source: `VMWare vSphere`)", criticality: 3 },
    { name: "Discovery: Webhook", qql: "asset.inventory:(source: Webhook)", criticality: 3 },
  ],
};

export const SKIPPED_RULES = [
  { name: "Discovery: API Based Scan", qql: "asset.inventory:(source: `API Based Scan`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: IBM", qql: "asset.inventory:(source: `IBM`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: LDAP", qql: "asset.inventory:(source: `LDAP`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: Mobility Scanner", qql: "asset.inventory:(source: `Mobility Scanner`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: SCANNER", qql: "asset.inventory:(source: `SCANNER`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: Snapshot Based Scan", qql: "asset.inventory:(source: `Snapshot Based Scan`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
  { name: "Discovery: VMware ESXi", qql: "asset.inventory:(source: `VMware ESXi`)", reason: "Skipped in strict mode: source value is not in documented Asset Inventory source list." },
];

export function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
    }
  });
}

export function makeTagXml({ name, ruleType = "STATIC", parentId = null, ruleText = null, criticality = null }) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<ServiceRequest>\n  <data>\n    <Tag>\n      <name>${escapeXml(name)}</name>\n      <ruleType>${escapeXml(ruleType)}</ruleType>\n`;
  if (parentId) xml += `      <parentTagId>${escapeXml(String(parentId))}</parentTagId>\n`;
  if (ruleText) xml += `      <ruleText>${escapeXml(ruleText)}</ruleText>\n`;
  if (criticality !== null && criticality !== undefined) xml += `      <criticalityScore>${escapeXml(String(criticality))}</criticalityScore>\n`;
  xml += `    </Tag>\n  </data>\n</ServiceRequest>`;
  return xml;
}

export function makeSearchXml(name) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<ServiceRequest>\n  <filters>\n    <Criteria field="name" operator="EQUALS">${escapeXml(name)}</Criteria>\n  </filters>\n</ServiceRequest>`;
}

export function parseXmlTagResponse(xmlText) {
  const codeMatch = xmlText.match(/<responseCode>(.*?)<\/responseCode>/);
  const responseCode = codeMatch ? codeMatch[1].trim() : null;
  const idMatch = xmlText.match(/<id>(\d+)<\/id>/);
  const tagId = idMatch ? idMatch[1] : null;
  const errMatch = xmlText.match(/<responseErrorDetails>(.*?)<\/responseErrorDetails>/) ||
                   xmlText.match(/<responseErrorMessage>(.*?)<\/responseErrorMessage>/);
  const message = errMatch ? errMatch[1] : responseCode;

  return {
    success: responseCode === "SUCCESS",
    responseCode,
    tagId,
    message: message || "Unknown response",
  };
}

export function parseXmlSearchResults(xmlText, targetName) {
  const tagBlocks = xmlText.split(/<Tag>/g).slice(1);
  for (const block of tagBlocks) {
    const nameMatch = block.match(/<name>(.*?)<\/name>/);
    const idMatch = block.match(/<id>(\d+)<\/id>/);
    const ruleTypeMatch = block.match(/<ruleType>(.*?)<\/ruleType>/);
    if (nameMatch && nameMatch[1] === targetName) {
      return {
        id: idMatch ? idMatch[1] : null,
        name: nameMatch[1],
        ruleType: ruleTypeMatch ? ruleTypeMatch[1] : null,
      };
    }
  }
  return null;
}

export function corsHeaders(req) {
  const origin = req ? req.headers.get("Origin") || "*" : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  };
}

export function jsonResponse(data, status = 200, req = null) {
  const headers = {
    "Content-Type": "application/json",
    ...corsHeaders(req),
  };
  return new Response(JSON.stringify(data), { status, headers });
}
