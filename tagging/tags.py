import getpass
import json
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

# ----------------------------- SETTINGS ---------------------------------
# Start in dry-run mode. Review the report before setting this to False.
DRY_RUN = True
REQUEST_TIMEOUT = 45
REPORT_PATH = Path("qualys_tag_setup_report.json")
API_VERSION = "2.0"

print("Options: US1, US2, US3, US4, UK, EU1, EU2, EU3, IN, CA, AE, AU, KSA")
platform = input("What platform is your account on? ").strip().upper()

base_urls = {
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
}

if platform not in base_urls:
    raise SystemExit("Invalid platform selection. Exiting.")

base_url = base_urls[platform].rstrip("/")
username = input("Enter your username: ").strip()
password = getpass.getpass("Enter your password: ")

# --------------------------- TAG DEFINITIONS -----------------------------
# Every dynamic child rule uses GLOBAL_ASSET_VIEW (Asset Inventory).
# Queries are included only when the field/value syntax is supported by the
# documented Qualys Asset Inventory tag-rule reference.
PARENTS = {
    "OS: Operating Systems": [
        ("OS: Windows Server",
         "operatingSystem.category1:`Windows` and operatingSystem.category2:`Server`", 4),
        ("OS: Windows Client",
         "operatingSystem.category1:`Windows` and operatingSystem.category2:`Client`", 2),
        ("OS: Linux Server",
         "operatingSystem.category1:`Linux` and operatingSystem.category2:`Server`", 4),
        ("OS: Linux Client",
         "operatingSystem.category1:`Linux` and operatingSystem.category2:`Client`", 2),
        ("OS: Network OS",
         "operatingSystem.category1:`Network Operating System`", 3),
    ],
    "Type: Asset Types": [
        ("Type: Servers",
         "operatingSystem.category2:`Server` or hardware.category2:`Server`", 4),
        ("Type: Database Servers",
         "software:(category1:`Databases` and component:`Server`) and (hardware.category2:`Server` or operatingSystem.category2:`Server`)", 4),
        ("Type: Domain Controllers",
         "compute.domainRole:`Primary Domain Controller`", 5),
        ("Type: Clients/Workstations",
         "operatingSystem.category2:`Client` or hardware.category2:`Desktop`", 2),
        ("Type: Network Devices",
         "hardware.category1:`Networking Device` or hardware.category1:`Network Security Device`", 3),
        ("Type: Printers",
         "hardware.category1:`Printers`", 1),
    ],
    "OS Version: Windows Client": [
        ("OS Version: Windows 11", 'operatingSystem.name:`Microsoft Windows 11`', 3),
        ("OS Version: Windows 10", 'operatingSystem.name:`Microsoft Windows 10`', 3),
        ("OS Version: Windows 8.1", 'operatingSystem.name:`Microsoft Windows 8.1`', 3),
        ("OS Version: Windows 7", 'operatingSystem.name:`Microsoft Windows 7`', 3),
    ],
    "OS Version: Windows Server": [
        ("OS Version: Windows Server 2025", 'operatingSystem.name:`Microsoft Windows Server 2025`', 3),
        ("OS Version: Windows Server 2022", 'operatingSystem.name:`Microsoft Windows Server 2022`', 3),
        ("OS Version: Windows Server 2019", 'operatingSystem.name:`Microsoft Windows Server 2019`', 3),
        ("OS Version: Windows Server 2016", 'operatingSystem.name:`Microsoft Windows Server 2016`', 3),
        ("OS Version: Windows Server 2012 R2", 'operatingSystem.name:`Microsoft Windows Server 2012 R2`', 3),
        ("OS Version: Windows Server 2012", 'operatingSystem.name:`Microsoft Windows Server 2012`', 3),
        ("OS Version: Windows Server 2008 R2", 'operatingSystem.name:`Microsoft Windows Server 2008 R2`', 3),
    ],
    "OS Version: Linux": [
        ("OS Version: Ubuntu", 'operatingSystem.name:`Ubuntu`', 3),
        ("OS Version: Red Hat Enterprise Linux", 'operatingSystem.name:`Red Hat Enterprise Linux`', 3),
        ("OS Version: SUSE Linux Enterprise Server", 'operatingSystem.name:`SUSE Linux Enterprise Server`', 3),
        ("OS Version: Debian", 'operatingSystem.name:`Debian`', 3),
        ("OS Version: Oracle Linux", 'operatingSystem.name:`Oracle Linux`', 3),
        ("OS Version: Amazon Linux", 'operatingSystem.name:`Amazon Linux`', 3),
    ],
    "Lifecycle: OS Support Status": [
        ("Lifecycle: OS End-of-Life", 'operatingSystem.lifecycle.stage:`EOL`', 4),
        ("Lifecycle: OS End-of-Life / End-of-Support", 'operatingSystem.lifecycle.stage:`EOL/EOS`', 4),
        ("Lifecycle: OS Lifecycle Unknown", 'operatingSystem.lifecycle.stage:`Unknown`', 3),
    ],
    "Lifecycle: Hardware Support Status": [
        ("Lifecycle: Hardware End of Sale", 'hardware.lifecycle.stage:`EOS`', 3),
        # Qualys uses OBS for obsolete; Unknown is also a valid lifecycle stage.
        ("Lifecycle: Hardware Obsolete", 'hardware.lifecycle.stage:`OBS`', 4),
        ("Lifecycle: Hardware Lifecycle Unknown", 'hardware.lifecycle.stage:`Unknown`', 3),
    ],
    "Cloud: Provider / Discovery Source": [
        ("Cloud: AWS / EC2", 'asset.inventory:(source: EC2)', 3),
        ("Cloud: Azure", 'asset.inventory:(source: Azure)', 3),
        ("Cloud: Google Cloud", 'asset.inventory:(source: GCP)', 3),
        ("Cloud: Oracle Cloud (OCI)", 'asset.inventory:(source: OCI)', 3),
    ],
    "Discovery: Asset Source": [
        # Documented source values only. Unsupported candidates are reported below.
        ("Discovery: API", 'asset.inventory:(source: API)', 3),
        ("Discovery: Active Directory", 'asset.inventory:(source: `Active Directory`)', 3),
        ("Discovery: Appliance", 'asset.inventory:(source: Appliance)', 3),
        ("Discovery: Azure", 'asset.inventory:(source: Azure)', 3),
        ("Discovery: BMC Helix", 'asset.inventory:(source: `BMC Helix`)', 3),
        ("Discovery: CAPS", 'asset.inventory:(source: CAPS)', 3),
        ("Discovery: CMDB", 'asset.inventory:(source: CMDB)', 3),
        ("Discovery: Cloud Agent", 'asset.inventory:(source: `Cloud Agent`)', 3),
        ("Discovery: EASM", 'asset.inventory:(source: EASM)', 3),
        ("Discovery: EC2", 'asset.inventory:(source: EC2)', 3),
        ("Discovery: GCP", 'asset.inventory:(source: GCP)', 3),
        ("Discovery: ICS OCA", 'asset.inventory:(source: `ICS OCA`)', 3),
        ("Discovery: IP Scanner", 'asset.inventory:(source: `IP Scanner`)', 3),
        ("Discovery: Malware Domain", 'asset.inventory:(source: `Malware Domain`)', 3),
        ("Discovery: OCA", 'asset.inventory:(source: OCA)', 3),
        ("Discovery: OCI", 'asset.inventory:(source: OCI)', 3),
        ("Discovery: Passive Sensor", 'asset.inventory:(source: `Passive Sensor`)', 3),
        ("Discovery: ServiceNow", 'asset.inventory:(source: ServiceNow)', 3),
        ("Discovery: VMWare vSphere", 'asset.inventory:(source: `VMWare vSphere`)', 3),
        ("Discovery: Webhook", 'asset.inventory:(source: Webhook)', 3),
    ],
}

# User-requested candidates omitted because their values are not in the
# documented Asset Inventory source list.
SKIPPED_RULES = [
    *[
        {
            "name": f"Discovery: {name}",
            "qql": f"asset.inventory:(source: `{value}`)",
            "reason": "Skipped in strict mode: source value is not in the documented Asset Inventory source list."
        }
        for name, value in [
            ("API Based Scan", "API Based Scan"),
            ("IBM", "IBM"),
            ("LDAP", "LDAP"),
            ("Mobility Scanner", "Mobility Scanner"),
            ("SCANNER", "SCANNER"),
            ("Snapshot Based Scan", "Snapshot Based Scan"),
            ("VMware ESXi", "VMware ESXi"),
        ]
    ],
]

# ------------------------------ API HELPERS ------------------------------

session = requests.Session()
session.auth = (username, password)
session.headers.update({
    "X-Requested-With": "Python Qualys Dynamic Tag Setup",
    "Content-Type": "text/xml",
    "Accept": "text/xml",
})
tag_api = f"{base_url}/qps/rest/{API_VERSION}"


def make_tag_xml(name, rule_type="STATIC", parent_id=None,
                 rule_text=None, criticality=None):
    root = ET.Element("ServiceRequest")
    data = ET.SubElement(root, "data")
    tag = ET.SubElement(data, "Tag")
    ET.SubElement(tag, "name").text = name
    ET.SubElement(tag, "ruleType").text = rule_type
    if parent_id:
        ET.SubElement(tag, "parentTagId").text = str(parent_id)
    if rule_text:
        ET.SubElement(tag, "ruleText").text = rule_text
    if criticality is not None:
        ET.SubElement(tag, "criticalityScore").text = str(criticality)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def parse_xml_response(response):
    try:
        root = ET.fromstring(response.text)
    except ET.ParseError:
        return False, f"HTTP {response.status_code}; response was not valid XML", None
    response_code = root.findtext(".//responseCode")
    message = (root.findtext(".//responseErrorDetails")
               or root.findtext(".//responseErrorMessage")
               or response_code
               or f"HTTP {response.status_code}")
    tag_id = root.findtext(".//data/Tag/id") or root.findtext(".//Tag/id")
    return response.ok and response_code == "SUCCESS", message, tag_id


def find_tag_by_exact_name(name):
    """Return existing tag info by exact name, or None if not found."""
    root = ET.Element("ServiceRequest")
    filters = ET.SubElement(root, "filters")
    criteria = ET.SubElement(filters, "Criteria", field="name", operator="EQUALS")
    criteria.text = name
    response = session.post(
        f"{tag_api}/search/am/tag",
        data=ET.tostring(root, encoding="utf-8", xml_declaration=True),
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    try:
        parsed = ET.fromstring(response.text)
    except ET.ParseError as exc:
        raise RuntimeError(f"Tag search returned invalid XML for {name!r}") from exc
    for node in parsed.findall(".//data/Tag"):
        if node.findtext("name") == name:
            return {
                "id": node.findtext("id"),
                "name": node.findtext("name"),
                "ruleType": node.findtext("ruleType"),
            }
    return None


def create_tag(name, rule_type="STATIC", parent_id=None,
               rule_text=None, criticality=None):
    payload = make_tag_xml(name, rule_type, parent_id, rule_text, criticality)
    response = session.post(
        f"{tag_api}/create/am/tag",
        data=payload,
        timeout=REQUEST_TIMEOUT,
    )
    return parse_xml_response(response)


def ensure_static_parent(name, report):
    existing = find_tag_by_exact_name(name)
    if existing and existing.get("id"):
        report["reused"].append({"name": name, "id": existing["id"], "kind": "parent"})
        print(f"REUSE parent: {name} (id={existing['id']})")
        return existing["id"]

    if DRY_RUN:
        report["planned"].append({"name": name, "kind": "parent", "action": "create STATIC"})
        print(f"PLAN parent: create {name}")
        return f"DRY_RUN_PARENT::{name}"

    ok, detail, tag_id = create_tag(name, rule_type="STATIC")
    if not ok or not tag_id:
        report["failed"].append({"name": name, "kind": "parent", "detail": detail})
        print(f"FAILED parent: {name}: {detail}")
        return None
    report["created"].append({"name": name, "id": tag_id, "kind": "parent"})
    print(f"CREATED parent: {name} (id={tag_id})")
    return tag_id


def main():
    report = {
        "platform": platform,
        "base_url": base_url,
        "mode": "strict",
        "dry_run": DRY_RUN,
        "rule_type_for_dynamic_children": "GLOBAL_ASSET_VIEW",
        "created": [],
        "reused": [],
        "planned": [],
        "skipped": list(SKIPPED_RULES),
        "failed": [],
        "notes": [
            "Dry run validates the planned configuration only; it does not contact the tag API.",
            "When DRY_RUN=False, each create request is validated by the Qualys API response.",
            "QQL token/syntax support does not guarantee that a query matches assets in this tenant.",
            "Existing child tags are reused and are not overwritten; review their current rule if the rule differs.",
            "OS version names must be checked against the OS names returned by this tenant's inventory.",
            "No authentication login/logout calls are made: the QPS API calls use HTTP Basic Auth consistently."
        ],
    }

    # Check credentials/API reachability before a non-dry-run operation.
    # In dry-run mode do not make any API changes or require a live API check.
    if DRY_RUN:
        print("\nDRY RUN enabled: no tags will be created or changed.")
        parent_ids = {name: f"DRY_RUN_PARENT::{name}" for name in PARENTS}
        for parent in PARENTS:
            report["planned"].append({"name": parent, "kind": "parent", "action": "reuse if present; otherwise create STATIC"})
        for parent, children in PARENTS.items():
            for name, qql, criticality in children:
                report["planned"].append({
                    "parent": parent,
                    "name": name,
                    "qql": qql,
                    "ruleType": "GLOBAL_ASSET_VIEW",
                    "criticalityScore": criticality,
                    "action": "reuse if exact name exists; otherwise create",
                })
                print(f"[{parent}] {name}\n  QQL: {qql}")
        print(f"\nPlanned dynamic rules: {sum(len(v) for v in PARENTS.values())}")
        print(f"Skipped strict-mode candidates: {len(SKIPPED_RULES)}")
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Report saved to: {REPORT_PATH.resolve()}")
        print("Review the report, then set DRY_RUN = False to execute.")
        return

    # A live search call verifies credentials and access before writes.
    try:
        find_tag_by_exact_name("OS: Operating Systems")
    except Exception as exc:
        raise SystemExit(
            "Could not query Qualys tag API. Verify platform, credentials, API permissions, "
            f"and base URL. Details: {exc}"
        )

    parent_ids = {}
    for parent in PARENTS:
        try:
            parent_ids[parent] = ensure_static_parent(parent, report)
        except Exception as exc:
            report["failed"].append({"name": parent, "kind": "parent", "error": str(exc)})
            print(f"ERROR checking parent {parent}: {exc}")

    for parent, children in PARENTS.items():
        parent_id = parent_ids.get(parent)
        if not parent_id:
            for name, qql, _ in children:
                report["failed"].append({
                    "name": name,
                    "parent": parent,
                    "error": "Parent tag was not available; child was not created."
                })
            continue

        for name, qql, criticality in children:
            try:
                existing = find_tag_by_exact_name(name)
                if existing and existing.get("id"):
                    report["reused"].append({
                        "name": name,
                        "id": existing["id"],
                        "kind": "child",
                        "parent": parent,
                        "note": "Existing tag reused; its current rule was not overwritten."
                    })
                    print(f"REUSE child: {name} (id={existing['id']}); rule unchanged")
                    continue

                ok, detail, tag_id = create_tag(
                    name,
                    rule_type="GLOBAL_ASSET_VIEW",
                    parent_id=parent_id,
                    rule_text=qql,
                    criticality=criticality,
                )
                if ok:
                    report["created"].append({
                        "name": name,
                        "id": tag_id,
                        "kind": "child",
                        "parent": parent,
                        "qql": qql,
                        "ruleType": "GLOBAL_ASSET_VIEW",
                    })
                    print(f"CREATED child: {name}")
                else:
                    report["failed"].append({
                        "name": name,
                        "parent": parent,
                        "qql": qql,
                        "detail": detail,
                    })
                    print(f"FAILED child: {name}: {detail}")
            except Exception as exc:
                report["failed"].append({
                    "name": name,
                    "parent": parent,
                    "qql": qql,
                    "error": str(exc),
                })
                print(f"ERROR child {name}: {exc}")
            time.sleep(0.1)

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\nSetup finished.")
    print(f"Created: {len(report['created'])}")
    print(f"Reused: {len(report['reused'])}")
    print(f"Skipped: {len(report['skipped'])}")
    print(f"Failed: {len(report['failed'])}")
    print(f"Report saved to: {REPORT_PATH.resolve()}")


if __name__ == "__main__":
    main()
