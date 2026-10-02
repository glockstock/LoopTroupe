# Open Questions

Any agent may add, clarify, or update questions here; keep IDs stable. Recording a proposal does not approve it. Approved product answers go to `docs/spec.md` (via `product_manager`), approved technical answers to `docs/tech_spec.md` (via `engineering_manager`).

| ID | Question | Status | Notes |
| --- | --- | --- | --- |
| Q-001 | Should riders be able to sync credits across devices (accounts or cloud sync)? | Open | Today only JSON export/import. A big technical change per AGENTS.md. |
| Q-002 | How are relocated, renamed, or re-themed coasters counted? Is a relocated coaster one credit or two? | Open | Enthusiast conventions vary; needs a product ruling before `coaster_data_curator` encodes it. |
| Q-003 | Should the database expand beyond the United States? | Open | The owner said "every park in America to start." |
| Q-004 | How is the database kept current each season, and from which sources? | Open | The 2024 scrape and build script were not kept; edits are manual. |
| Q-005 | Should web fonts be self-hosted rather than loaded from Google Fonts? | Open | Reliability, privacy, and layout-shift tradeoffs; owned by `web_performance_engineer`. |
