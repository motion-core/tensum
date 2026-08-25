# Security policy

## Supported versions

Security fixes are provided for the latest published minor release. During the
`0.x` release cycle, resolving a vulnerability may require upgrading to a newer
minor version.

| Version | Supported |
| ------- | --------- |
| `0.1.x` | Yes       |
| `<0.1`  | No        |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/motion-core/tensum/security/advisories/new)
to report a suspected vulnerability. Do not disclose security details through
a public issue, discussion, pull request, or social media.

Include:

- the affected Tensum version;
- the affected API or package entry point;
- the expected and observed behavior;
- the security impact;
- the smallest reproducible example;
- relevant runtime, browser, GSAP, and Node.js versions;
- a suggested mitigation, if known.

Remove credentials, access tokens, and personal data from every reproduction,
log, and attachment.

## Response and disclosure

The maintainers aim to acknowledge a report within five business days and
provide a status update within ten business days. Investigation, remediation,
and disclosure will be coordinated through the private advisory. Allow time for
a fix and an upgrade path before publishing technical details.

## Scope

This policy covers the published `tensum` package and code on the default
branch. Report vulnerabilities originating in GSAP or another dependency to
that project's maintainers as well.
