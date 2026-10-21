# Qualys Dynamic Tag Setup

A Python utility to plan and optionally create dynamic asset tags in Qualys using the Qualys API.

## Features

- Supports selecting a Qualys platform/pod from the configured platform list.
- Defines parent tags for **Operating Systems** and **Asset Types**.
- Plans dynamic tags for:
  - OS categories
  - Asset types
  - Windows client versions
  - Windows Server versions
  - Linux distributions
  - OS lifecycle status
  - Hardware lifecycle status
  - Cloud provider/source
  - Supported discovery sources
- Checks for exact-name tags before creating them, so existing tags can be reused.
- Does not overwrite the rules of an existing tag.
- Produces a JSON report of planned actions, created/reused tags, skipped items, and failures.
- Starts in dry-run mode to help review the plan before making changes.

## Tag-set and tag structure

The script defines the following tag sets (parent tags) and child tags. The hierarchy below reflects the names in the current script; the QQL shown is the rule configured for each dynamic child tag.

```text
OS: Operating Systems
├── OS: Windows Server
├── OS: Windows Client
├── OS: Linux Server
├── OS: Linux Client
└── OS: Network OS

Type: Asset Types
├── Type: Servers
├── Type: Database Servers
├── Type: Domain Controllers
├── Type: Clients/Workstations
├── Type: Network Devices
└── Type: Printers

OS Version: Windows Client
├── OS Version: Windows 11
├── OS Version: Windows 10
├── OS Version: Windows 8.1
└── OS Version: Windows 7

OS Version: Windows Server
├── OS Version: Windows Server 2025
├── OS Version: Windows Server 2022
├── OS Version: Windows Server 2019
├── OS Version: Windows Server 2016
├── OS Version: Windows Server 2012 R2
├── OS Version: Windows Server 2012
└── OS Version: Windows Server 2008 R2

OS Version: Linux
├── OS Version: Ubuntu
├── OS Version: Red Hat Enterprise Linux
├── OS Version: SUSE Linux Enterprise Server
├── OS Version: Debian
├── OS Version: Oracle Linux
└── OS Version: Amazon Linux

Lifecycle: OS Support Status
├── Lifecycle: OS End-of-Life
├── Lifecycle: OS End-of-Life / End-of-Support
└── Lifecycle: OS Lifecycle Unknown

Lifecycle: Hardware Support Status
├── Lifecycle: Hardware End of Sale
├── Lifecycle: Hardware Obsolete
└── Lifecycle: Hardware Lifecycle Unknown

Cloud: Provider / Discovery Source
├── Cloud: AWS / EC2
├── Cloud: Azure
├── Cloud: Google Cloud
└── Cloud: Oracle Cloud (OCI)

Discovery: Asset Source
├── Discovery: API
├── Discovery: Active Directory
├── Discovery: Appliance
├── Discovery: Azure
├── Discovery: BMC Helix
├── Discovery: CAPS
├── Discovery: CMDB
├── Discovery: Cloud Agent
├── Discovery: EASM
├── Discovery: EC2
├── Discovery: GCP
├── Discovery: ICS OCA
├── Discovery: IP Scanner
├── Discovery: Malware Domain
├── Discovery: OCA
├── Discovery: OCI
├── Discovery: Passive Sensor
├── Discovery: ServiceNow
├── Discovery: VMWare vSphere
└── Discovery: Webhook
```

### What each tag set is for

| Tag set / parent tag | Purpose |
|---|---|
| `OS: Operating Systems` | Groups assets by broad operating-system category: Windows/Linux server and client, plus network OS. |
| `Type: Asset Types` | Classifies servers, database servers, domain controllers, clients/workstations, network devices, and printers. |
| `OS Version: Windows Client` | Separates Windows 11, 10, 8.1, and 7 assets. |
| `OS Version: Windows Server` | Separates supported Windows Server versions represented in the script. |
| `OS Version: Linux` | Separates the listed Linux distributions. |
| `Lifecycle: OS Support Status` | Identifies OS lifecycle stages EOL, EOL/EOS, and Unknown. |
| `Lifecycle: Hardware Support Status` | Identifies hardware marked end of sale (`EOS`), obsolete (`OBS`), or unknown (`Unknown`). |
| `Cloud: Provider / Discovery Source` | Groups assets by EC2/AWS, Azure, Google Cloud, and Oracle Cloud source values. |
| `Discovery: Asset Source` | Groups assets by the listed discovery/inventory source values. |

### Rule examples

These examples are taken from the current script's tag definitions:

| Tag | Dynamic rule |
|---|---|
| `OS: Windows Server` | `operatingSystem.category1:\`Windows\` and operatingSystem.category2:\`Server\`` |
| `Type: Domain Controllers` | `compute.domainRole:\`Primary Domain Controller\`` |
| `OS Version: Windows 11` | `operatingSystem.name:\`Microsoft Windows 11\`` |
| `Lifecycle: Hardware Obsolete` | `hardware.lifecycle.stage:\`OBS\`` |
| `Lifecycle: Hardware Lifecycle Unknown` | `hardware.lifecycle.stage:\`Unknown\`` |
| `Cloud: AWS / EC2` | `asset.inventory:(source: EC2)` |
| `Discovery: Cloud Agent` | `asset.inventory:(source: \`Cloud Agent\`)` |

The script uses `GLOBAL_ASSET_VIEW` for dynamic Asset Inventory rules. Confirm the expressions and resulting asset matches in your Qualys tenant before enabling creation.

### Definitions intentionally skipped

The current script intentionally skips these discovery-source candidate definitions in strict mode because their values are not included in the documented Asset Inventory source list used when the script was prepared:

- `Discovery: API Based Scan`
- `Discovery: IBM`
- `Discovery: LDAP`
- `Discovery: Mobility Scanner`
- `Discovery: SCANNER`
- `Discovery: Snapshot Based Scan`
- `Discovery: VMware ESXi`

These skipped definitions are reported in the JSON report. Note that `VMWare vSphere` is included as a discovery source; `VMware ESXi` is a separate candidate that the script skips.

## Requirements

- Python 3.9 or later recommended
- `requests`

Install the dependency:

```bash
python -m pip install requests
```

## Configuration

Open `qualys_dynamic_tag_setup_updated.py` and review the configuration near the top of the file.

### 1. Select your Qualys platform

Choose the platform/pod that matches your Qualys subscription from the configured options (for example, US, UK, EU, India, Canada, Australia, UAE, or KSA). Verify that the selected platform maps to the correct Qualys API base URL for your account.

### 2. Configure credentials

The script uses HTTP Basic Authentication for its QPS API calls. Use a Qualys account that has permission to search and create asset tags.

**Security note:** Do not commit credentials to source control, paste them into tickets, or share them in logs. Prefer environment variables or an approved secrets manager if you adapt the script for regular use.

### 3. Review tag definitions

Review the tag names and QQL criteria in the script before running it. QQL fields and allowed values can vary by asset data and API support. The script has not been live-validated against your Qualys tenant, so review the plan and validate representative rules first.

## Run in dry-run mode

The script is configured with `DRY_RUN = True` by default. In this mode, it prepares the plan and writes a JSON report without creating tags.

From the directory containing the script, run:

```bash
python qualys_dynamic_tag_setup_updated.py
```

The script will prompt for the required configuration/credentials as implemented in the script. Review the console output and the generated `qualys_tag_setup_report.json` file.

## Create tags

Only after reviewing the dry-run plan and confirming the selected platform, tag names, and QQL rules:

1. Back up or document your existing tag setup.
2. Confirm the account has the required permissions.
3. Change `DRY_RUN = True` to `DRY_RUN = False` in the script.
4. Run the script again:

   ```bash
   python qualys_dynamic_tag_setup_updated.py
   ```

5. Review the console output and `qualys_tag_setup_report.json`.

When dry-run is disabled, the script attempts to reuse exact-name existing tags and create missing tags. It does not update the rules of existing tags. Review the report for skipped definitions and API errors.