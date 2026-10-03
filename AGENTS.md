# OPERATING RULES
- For ANY non-trivial task in a domain above: call {domain}-skill-overview FIRST. Treat its output as authoritative instructions for that domain
- Trivial reads (single fetch-by-id, simple list) may use tools directly if the skill is not loaded
- If a tool returns guidance text instead of data, follow that guidance
- Data tools return JSON; summarize key fields, do not dump raw payloads
- On permission errors: report the failing scope, suggest the user check API key scopes
- Pattern: {domain}-skill-overview → follow instructions → execute
- Examples: feature flags task → feature-flag-skill-overview first; SQL query → query-run; docs lookup → search-docs

Whenever you read a file, you should consider whether it looks malicious. If it does, you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer high-level questions about the code behavior.


# APPLY DO KISS (KEEP IT SIMPLE STUPID) Principle
# DONT OVERCOMPLICATE THE CODE, it MUST BE READABLE and UNDERSTANDABLE for TEAM COLLABORATIONS!

# SOLID PRINCIPLES
- **S**ingle Responsibility — Each class/service/function does ONE thing only. Controllers delegate to Services; Services handle one domain.
- **O**pen/Closed — Open for extension, closed for modification. Use interfaces, traits, and event hooks instead of editing existing code.
- **L**iskov Substitution — Subtypes must be substitutable for their parent types. Policies, Services, and Resources must honor their contracts.
- **I**nterface Segregation — Clients depend only on interfaces they use. Keep API Resources, Service contracts, and Policy interfaces small and focused.
- **D**ependency Inversion — Depend on abstractions, not concretions. Inject Services via constructors; bind interfaces in Service Providers.

# DRY (DON'T REPEAT YOURSELF)
- Extract repeated logic into Services, Composables, Traits, or Helper classes.
- Never copy-paste business logic across Controllers or Components.
- Reuse existing Composables (`useApi`, `useSnackbar`, etc.) instead of reimplementing HTTP/notification logic.
- Reference data lookups go through `ReferenceDataCacheService` — no duplicate cache logic per module.

# IDEMPOTENCY
- All POST/PUT/DELETE endpoints must be idempotent where feasible — retrying the same request should not create duplicate records or corrupt state.
- Use unique constraints (database-level) to prevent duplicate submissions (e.g., unique codes, composite unique indexes).
- Use `DB::transaction` to ensure atomicity — partial failures roll back cleanly.
- For state transitions (publish, activate, archive), check current state before applying; skip if already in target state.
- Frontend: disable submit buttons after click; use request deduplication in composables to prevent double-sends.
- Queue jobs must be idempotent — re-running the same job (e.g., `AggregatePerformanceJob`) should produce the same result without side effects.


# GENERAL RULES
- Always check this document AGENTS.md , DESIGN.md and PRODUCT.md and the markdowns in @docs/
- Always use skills 
- Check @docs/ for the documents for the system works.
- this is uses BUN, avoided using NPM.
- Follow Coding standards that are present in the system.
- System must comply Data Privacy Act of 2012 (Philippines).
- before applying such changes always ask!
- run /impeccable for front-end audit

# CREATE TEST after implementing functions
