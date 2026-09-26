# Security policy

## Reporting a vulnerability

Report it privately through GitHub: open this repository's **Security** tab and choose
**Report a vulnerability**. Please do not open a public issue for a security problem.

Please include enough to reproduce the issue. If it affects funds, miner payouts, or how the
wallet handles keys, say so in the title so it is read first.

This is a one-person operation, so please allow a reasonable window before public disclosure.
Expect an acknowledgement within a few days. There is no bounty program.

## Scope

In scope: the code in this repository, the live services at `pwnda.org`, and the pool stratum
endpoints it advertises.

Out of scope: upstream projects this infrastructure forks or depends on (report those to their
maintainers), and denial of service by sheer traffic volume against the public endpoints.

## What is not published

The payout engine, exchange integrations and admin surfaces are not in this repository. If you
believe you have found an issue in one of them from the outside, report it here anyway and it will
be routed.
