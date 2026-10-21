"""
Local Development Server with Qualys API Proxy
Hosts static frontend on / and relays /api/* requests to Qualys without CORS limitations.
"""
import http.server
import socketserver
import json
import urllib.request
import urllib.error
import base64
import os

PORT = 8787
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")

BASE_URLS = {
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

PARENTS = {
    "OS: Operating Systems": [
        {"name": "OS: Windows Server", "qql": "operatingSystem.category1:`Windows` and operatingSystem.category2:`Server`", "criticality": 4},
        {"name": "OS: Windows Client", "qql": "operatingSystem.category1:`Windows` and operatingSystem.category2:`Client`", "criticality": 2},
        {"name": "OS: Linux Server", "qql": "operatingSystem.category1:`Linux` and operatingSystem.category2:`Server`", "criticality": 4},
        {"name": "OS: Linux Client", "qql": "operatingSystem.category1:`Linux` and operatingSystem.category2:`Client`", "criticality": 2},
        {"name": "OS: Network OS", "qql": "operatingSystem.category1:`Network Operating System`", "criticality": 3},
    ],
    "Type: Asset Types": [
        {"name": "Type: Servers", "qql": "operatingSystem.category2:`Server` or hardware.category2:`Server`", "criticality": 4},
        {"name": "Type: Database Servers", "qql": "software:(category1:`Databases` and component:`Server`) and (hardware.category2:`Server` or operatingSystem.category2:`Server`)", "criticality": 4},
        {"name": "Type: Domain Controllers", "qql": "compute.domainRole:`Primary Domain Controller`", "criticality": 5},
        {"name": "Type: Clients/Workstations", "qql": "operatingSystem.category2:`Client` or hardware.category2:`Desktop`", "criticality": 2},
        {"name": "Type: Network Devices", "qql": "hardware.category1:`Networking Device` or hardware.category1:`Network Security Device`", "criticality": 3},
        {"name": "Type: Printers", "qql": "hardware.category1:`Printers`", "criticality": 1},
    ],
    "OS Version: Windows Client": [
        {"name": "OS Version: Windows 11", "qql": "operatingSystem.name:`Microsoft Windows 11`", "criticality": 3},
        {"name": "OS Version: Windows 10", "qql": "operatingSystem.name:`Microsoft Windows 10`", "criticality": 3},
        {"name": "OS Version: Windows 8.1", "qql": "operatingSystem.name:`Microsoft Windows 8.1`", "criticality": 3},
        {"name": "OS Version: Windows 7", "qql": "operatingSystem.name:`Microsoft Windows 7`", "criticality": 3},
    ],
    "OS Version: Windows Server": [
        {"name": "OS Version: Windows Server 2025", "qql": "operatingSystem.name:`Microsoft Windows Server 2025`", "criticality": 3},
        {"name": "OS Version: Windows Server 2022", "qql": "operatingSystem.name:`Microsoft Windows Server 2022`", "criticality": 3},
        {"name": "OS Version: Windows Server 2019", "qql": "operatingSystem.name:`Microsoft Windows Server 2019`", "criticality": 3},
        {"name": "OS Version: Windows Server 2016", "qql": "operatingSystem.name:`Microsoft Windows Server 2016`", "criticality": 3},
        {"name": "OS Version: Windows Server 2012 R2", "qql": "operatingSystem.name:`Microsoft Windows Server 2012 R2`", "criticality": 3},
        {"name": "OS Version: Windows Server 2012", "qql": "operatingSystem.name:`Microsoft Windows Server 2012`", "criticality": 3},
        {"name": "OS Version: Windows Server 2008 R2", "qql": "operatingSystem.name:`Microsoft Windows Server 2008 R2`", "criticality": 3},
    ],
    "OS Version: Linux": [
        {"name": "OS Version: Ubuntu", "qql": "operatingSystem.name:`Ubuntu`", "criticality": 3},
        {"name": "OS Version: Red Hat Enterprise Linux", "qql": "operatingSystem.name:`Red Hat Enterprise Linux`", "criticality": 3},
        {"name": "OS Version: SUSE Linux Enterprise Server", "qql": "operatingSystem.name:`SUSE Linux Enterprise Server`", "criticality": 3},
        {"name": "OS Version: Debian", "qql": "operatingSystem.name:`Debian`", "criticality": 3},
        {"name": "OS Version: Oracle Linux", "qql": "operatingSystem.name:`Oracle Linux`", "criticality": 3},
        {"name": "OS Version: Amazon Linux", "qql": "operatingSystem.name:`Amazon Linux`", "criticality": 3},
    ],
    "Lifecycle: OS Support Status": [
        {"name": "Lifecycle: OS End-of-Life", "qql": "operatingSystem.lifecycle.stage:`EOL`", "criticality": 4},
        {"name": "Lifecycle: OS End-of-Life / End-of-Support", "qql": "operatingSystem.lifecycle.stage:`EOL/EOS`", "criticality": 4},
        {"name": "Lifecycle: OS Lifecycle Unknown", "qql": "operatingSystem.lifecycle.stage:`Unknown`", "criticality": 3},
    ],
    "Lifecycle: Hardware Support Status": [
        {"name": "Lifecycle: Hardware End of Sale", "qql": "hardware.lifecycle.stage:`EOS`", "criticality": 3},
        {"name": "Lifecycle: Hardware Obsolete", "qql": "hardware.lifecycle.stage:`OBS`", "criticality": 4},
        {"name": "Lifecycle: Hardware Lifecycle Unknown", "qql": "hardware.lifecycle.stage:`Unknown`", "criticality": 3},
    ],
    "Cloud: Provider / Discovery Source": [
        {"name": "Cloud: AWS / EC2", "qql": "asset.inventory:(source: EC2)", "criticality": 3},
        {"name": "Cloud: Azure", "qql": "asset.inventory:(source: Azure)", "criticality": 3},
        {"name": "Cloud: Google Cloud", "qql": "asset.inventory:(source: GCP)", "criticality": 3},
        {"name": "Cloud: Oracle Cloud (OCI)", "qql": "asset.inventory:(source: OCI)", "criticality": 3},
    ],
    "Discovery: Asset Source": [
        {"name": "Discovery: API", "qql": "asset.inventory:(source: API)", "criticality": 3},
        {"name": "Discovery: Active Directory", "qql": "asset.inventory:(source: `Active Directory`)", "criticality": 3},
        {"name": "Discovery: Appliance", "qql": "asset.inventory:(source: Appliance)", "criticality": 3},
        {"name": "Discovery: Azure", "qql": "asset.inventory:(source: Azure)", "criticality": 3},
        {"name": "Discovery: BMC Helix", "qql": "asset.inventory:(source: `BMC Helix`)", "criticality": 3},
        {"name": "Discovery: CAPS", "qql": "asset.inventory:(source: CAPS)", "criticality": 3},
        {"name": "Discovery: CMDB", "qql": "asset.inventory:(source: CMDB)", "criticality": 3},
        {"name": "Discovery: Cloud Agent", "qql": "asset.inventory:(source: `Cloud Agent`)", "criticality": 3},
        {"name": "Discovery: EASM", "qql": "asset.inventory:(source: EASM)", "criticality": 3},
        {"name": "Discovery: EC2", "qql": "asset.inventory:(source: EC2)", "criticality": 3},
        {"name": "Discovery: GCP", "qql": "asset.inventory:(source: GCP)", "criticality": 3},
        {"name": "Discovery: ICS OCA", "qql": "asset.inventory:(source: `ICS OCA`)", "criticality": 3},
        {"name": "Discovery: IP Scanner", "qql": "asset.inventory:(source: `IP Scanner`)", "criticality": 3},
        {"name": "Discovery: Malware Domain", "qql": "asset.inventory:(source: `Malware Domain`)", "criticality": 3},
        {"name": "Discovery: OCA", "qql": "asset.inventory:(source: OCA)", "criticality": 3},
        {"name": "Discovery: OCI", "qql": "asset.inventory:(source: OCI)", "criticality": 3},
        {"name": "Discovery: Passive Sensor", "qql": "asset.inventory:(source: `Passive Sensor`)", "criticality": 3},
        {"name": "Discovery: ServiceNow", "qql": "asset.inventory:(source: ServiceNow)", "criticality": 3},
        {"name": "Discovery: VMWare vSphere", "qql": "asset.inventory:(source: `VMWare vSphere`)", "criticality": 3},
        {"name": "Discovery: Webhook", "qql": "asset.inventory:(source: Webhook)", "criticality": 3},
    ],
}

class LocalDevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/catalog":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            data = {"platforms": list(BASE_URLS.keys()), "parents": PARENTS, "skipped": []}
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return
        return super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        try:
            req_data = json.loads(body)
        except Exception:
            req_data = {}

        if self.path == "/api/test-connection":
            platform = req_data.get("platform")
            username = req_data.get("username")
            password = req_data.get("password")
            base_url = BASE_URLS.get(platform)

            if not base_url:
                self._send_json({"success": False, "error": "Invalid platform"}, 400)
                return

            search_xml = """<?xml version="1.0" encoding="utf-8"?>
<ServiceRequest>
  <filters>
    <Criteria field="name" operator="EQUALS">OS: Operating Systems</Criteria>
  </filters>
</ServiceRequest>"""

            headers = {
                "Content-Type": "text/xml",
                "Accept": "application/xml",
                "X-Requested-With": "Qualys Local Server",
            }

            try:
                import requests
                resp = requests.post(
                    f"{base_url}/qps/rest/2.0/search/am/tag",
                    data=search_xml.encode("utf-8"),
                    headers=headers,
                    auth=(username, password),
                    timeout=35
                )
                resp_text = resp.text
                if resp.status_code == 200 and "<responseCode>SUCCESS</responseCode>" in resp_text:
                    self._send_json({"success": True, "status": resp.status_code, "message": "Connected successfully"})
                else:
                    import re
                    err_match = re.search(r"<(?:errorMessage|errorReason)>([^<]+)</", resp_text)
                    code_match = re.search(r"<(?:responseCode|errorCode)>([^<]+)</", resp_text)
                    err_detail = err_match.group(1) if err_match else (code_match.group(1) if code_match else f"HTTP {resp.status_code}")
                    self._send_json({"success": False, "error": f"{err_detail} (HTTP {resp.status_code})"}, 401 if resp.status_code in (401, 403) else 200)
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, 500)
            return

        if self.path == "/api/tag-action":
            platform = req_data.get("platform")
            username = req_data.get("username")
            password = req_data.get("password")
            action = req_data.get("action")
            payload = req_data.get("payload", {})
            base_url = BASE_URLS.get(platform)

            headers = {
                "Content-Type": "text/xml",
                "Accept": "application/xml",
                "X-Requested-With": "Qualys Local Server",
            }

            if action == "find":
                search_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<ServiceRequest>
  <filters>
    <Criteria field="name" operator="EQUALS">{payload.get('name')}</Criteria>
  </filters>
</ServiceRequest>"""
                try:
                    import requests
                    import re
                    resp = requests.post(
                        f"{base_url}/qps/rest/2.0/search/am/tag",
                        data=search_xml.encode("utf-8"),
                        headers=headers,
                        auth=(username, password),
                        timeout=35
                    )
                    text = resp.text
                    existing = None
                    if "<name>" + payload.get("name") + "</name>" in text:
                        id_match = re.search(r"<id>(\d+)</id>", text)
                        existing = {"id": id_match.group(1) if id_match else None, "name": payload.get("name")}
                    self._send_json({"success": True, "existing": existing})
                except Exception as e:
                    self._send_json({"success": False, "error": str(e)}, 500)
                return

            if action == "create":
                parent_tag_xml = f"<parentTagId>{payload.get('parentId')}</parentTagId>" if payload.get('parentId') else ""
                rule_text_xml = f"<ruleText>{payload.get('ruleText')}</ruleText>" if payload.get('ruleText') else ""
                crit_xml = f"<criticalityScore>{payload.get('criticality')}</criticalityScore>" if payload.get('criticality') is not None else ""

                create_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<ServiceRequest>
  <data>
    <Tag>
      <name>{payload.get('name')}</name>
      <ruleType>{payload.get('ruleType', 'STATIC')}</ruleType>
      {parent_tag_xml}
      {rule_text_xml}
      {crit_xml}
    </Tag>
  </data>
</ServiceRequest>"""
                try:
                    import requests
                    import re
                    resp = requests.post(
                        f"{base_url}/qps/rest/2.0/create/am/tag",
                        data=create_xml.encode("utf-8"),
                        headers=headers,
                        auth=(username, password),
                        timeout=35
                    )
                    text = resp.text
                    is_success = "<responseCode>SUCCESS</responseCode>" in text
                    id_match = re.search(r"<id>(\d+)</id>", text)
                    tag_id = id_match.group(1) if id_match else None
                    err_match = re.search(r"<(?:errorMessage|errorReason)>([^<]+)</", text)
                    err_msg = err_match.group(1) if err_match else None
                    self._send_json({"success": is_success, "result": {"success": is_success, "tagId": tag_id, "error": err_msg}})
                except Exception as e:
                    self._send_json({"success": False, "error": str(e)}, 500)
                return

            self._send_json({"success": False, "error": "Unknown action"}, 400)
            return

        self._send_json({"error": "Not Found"}, 404)

    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

print(f"Starting Qualys Tag Assistant at http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), LocalDevHandler) as httpd:
    httpd.serve_forever()
