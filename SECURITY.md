# Security Policy

## Supported Versions

Security fixes are currently provided for the latest `dev` branch. APOHUB is
community software and does not promise support for deployed forks or old
releases.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Contact
`davao.gdg@gmail.com` with:

- A concise description of the issue
- Affected files, routes, or Firebase collections
- Reproduction steps or a proof of concept
- The possible privacy or security impact

Please remove credentials, attendee data, payment proofs, and access tokens
from reports. The maintainers will acknowledge reports as soon as practical and
will coordinate disclosure after a fix or mitigation is available.

## Secret Exposure

If a Firebase service-account key, payment credential, email API key, or other
secret is committed, assume it is compromised. Revoke it first, then remove it
from the current tree and repository history. Deleting the file alone is not a
revocation or a history cleanup.

## Privacy

APOHUB processes attendee contact information, payment proofs, attendance data,
feedback, and certificates. Deployments must follow the Philippine Data Privacy
Act of 2012 and must not use production personal data in development fixtures.
