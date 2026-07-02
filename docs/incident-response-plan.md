# DropandSell — Information Security Incident Response Plan

**Organization:** DropandSell
**Document owner:** Business Owner / Primary Account User
**Last reviewed:** 30 May 2026
**Next review due:** 30 November 2026 *(reviewed every 6 months)*

---

## 1. Purpose

This plan describes how DropandSell detects, responds to, and reports
information security incidents — including any incident involving Amazon
Information obtained through the Amazon Selling Partner API. The goal is to
contain harm quickly, protect customer and Amazon data, and meet Amazon's
24-hour incident notification requirement.

## 2. Scope

This plan applies to all systems, accounts, and data used to operate the
DropandSell application and our Amazon seller account, including the
application servers, databases, stored credentials, and any device used to
access Amazon Information.

## 3. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| **Incident Lead** (Business Owner / Primary Account User) | Overall responsibility for the response. Decides on containment actions and approves notifications. |
| **Technical Responder** (Business Owner or appointed developer) | Investigates the incident, contains it, restores systems, and preserves evidence/logs. |
| **Communications Contact** (Business Owner) | Notifies Amazon, affected parties, and any required authorities. |

For a small team, one person may hold more than one role. The Business Owner
is the default contact for all roles.

## 4. What Counts as an Incident

Examples include, but are not limited to:

- Unauthorized access to the application, database, or seller account
- Leaked, stolen, or exposed credentials (passwords, API keys, secrets)
- Malware or ransomware on a system that handles Amazon Information
- Accidental public exposure of Amazon Information
- Any suspected breach or loss of customer or Amazon data

## 5. Response Procedure

**Step 1 — Detect & Record (immediately).** When an incident is suspected,
the person who notices it informs the Incident Lead and writes down the date,
time, and what was observed.

**Step 2 — Contain (within hours).** Limit the damage: revoke or rotate
affected credentials and API keys, disable compromised accounts, remove
affected systems from the network, and enable additional access restrictions.

**Step 3 — Assess.** Determine what data was involved, whether Amazon
Information was affected, and how the incident happened.

**Step 4 — Notify (within 24 hours of detection).** If Amazon Information is
involved, the Communications Contact emails **security@amazon.com** within
**24 hours** of detecting the incident, including a summary of what happened,
what data was affected, and the steps taken. Notify any other parties or
authorities as required by law.

**Step 5 — Recover.** Restore systems from clean backups, confirm the threat
is removed, and return to normal operation.

**Step 6 — Review.** Within two weeks, the Incident Lead documents the root
cause and the lessons learned, and updates security controls to prevent a
repeat.

## 6. Amazon Notification Details

- **Contact:** security@amazon.com
- **Deadline:** within 24 hours of detecting any incident involving Amazon Information
- **Include:** date/time detected, description, data affected, actions taken, and contact details

## 7. Preventive Security Controls

- Credentials and API keys are stored in encrypted secret storage — never
  hardcoded in the application, shared, or placed in public repositories.
- All data is encrypted in transit (HTTPS / encrypted database connections).
- Access to Amazon Information is restricted to authorized people based on
  their job duties.
- Accounts use strong passwords (12+ characters) and multi-factor
  authentication (MFA).
- Network protections (firewalls and anti-malware) are in place on systems
  that handle Amazon Information.

## 8. Review Schedule

This plan is reviewed and updated at least **every 6 months**, and after any
significant incident or major change to our systems. The review date at the
top of this document is updated each time.
