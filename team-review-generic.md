---
description: Multi-persona team review for architectural decisions, plan analysis, and code changes — generic version for any software project
---

# Team Review Panel

A structured multi-persona review workflow. Before implementing any significant change, simulate a debate between expert roles to catch blind spots, surface tradeoffs, and produce actionable findings.

## How to Run a Review

1. **Scope the review.** Define exactly what is being reviewed — a feature plan, an architectural decision, a code change, a post-mortem. One review = one topic.
2. **Select roles.** Use the Core tier always. Activate additional tiers based on what the change touches (see Role Tiers below).
3. **Every activated role speaks.** If a role has nothing to add, they explicitly say "No concerns from my perspective" — so you know they were consulted, not skipped.
4. **Tag findings by severity:**
   - 🔴 **Critical** — Blocks implementation. Must be resolved before proceeding.
   - 🟡 **High** — Significant risk. Should be resolved before merging.
   - 🟢 **Medium** — Worth addressing. Can be tracked as follow-up.
   - ⚪ **Low** — Nice to have. Log it, fix when convenient.
5. **No implementation during review.** Analysis and debate only until the plan is approved.
6. **Time-box.** Small changes: 15-30 min. Architectural decisions: 60 min max. If it takes longer, the scope is too big — split the review.
7. **Resolve disagreements.** When two roles fundamentally disagree, the CTO makes the final call with a documented rationale. The dissenting opinion is preserved in the review record.

### Output Format

Each role voices their perspective using their abbreviation prefix:

```
**PSE:** The implementation needs to handle the case where...
**SQL:** That query will require a composite index on...
**SecEng:** An adversary could exploit this by...
```

After all roles speak, close with a **Verdict** section summarizing: approved / approved with conditions / rejected with reasons.

---

## Role Tiers

### 🔵 Core Tier — Always Active

These roles participate in every review, regardless of project type.

| Role | Abbr | Focus Area |
|------|------|------------|
| **CTO** | CTO | System viability, team bandwidth, ROI, strategic risk, final tiebreaker on disagreements |
| **Chief Architect** | CA | System design, separation of concerns, coupling/cohesion, data flow, integration points |
| **Principal Software Engineer** | PSE | Implementation details, API contracts, edge cases, code patterns, error handling |
| **Security Engineer** | SecEng | Auth/authz, input validation, secrets management, attack surface, dependency CVEs, fail-safes |
| **Performance Engineer** | PE | Query complexity, execution time, memory/CPU budgets, connection pools, caching strategy |
| **QA Lead** | QA | Testability, test coverage, regression risk, edge cases, cold starts, statistical noise |
| **Principal SQL / Data Store Engineer** | SQL | Schema design, index strategy, query plans, migration safety, denormalization tradeoffs |

### 🟢 Data Tier — Activate for pipelines, ETL, ML, or batch processing

| Role | Abbr | Focus Area |
|------|------|------------|
| **Principal Data Engineer** | DE | Data pipelines, ETL quality, data retention, schema evolution, idempotency, backfill strategy |

### 🟡 Frontend Tier — Activate for any UI or styling change

| Role | Abbr | Focus Area |
|------|------|------------|
| **UX Designer** | UXD | Visual hierarchy, mobile responsiveness (≤430px), touch targets, typography, spacing, accessibility, user flow coherence |
| **CSS Engineer** | CSSE | CSS architecture, cascade specificity, Flex/Grid layout, animation performance (`transform`/`opacity`-only compositing), cross-browser correctness, dark-mode tokens, regression risk from selector changes |

### 🟠 Operations Tier — Activate for deployment, infrastructure, or production changes

| Role | Abbr | Focus Area |
|------|------|------------|
| **DevOps / SRE** | SRE | CI/CD pipelines, deployment strategy, infrastructure-as-code, monitoring, alerting, runbooks, incident response, rollback procedures |
| **Product Owner** | PO | User impact, acceptance criteria, scope creep detection, feature prioritization, MVP vs gold-plating |

### 🔴 Domain Tier — Activate based on project type

> [!TIP]
> These roles are powerful for specific domains. Pick the ones that match your project, or define your own domain roles using this template.

| Role | Abbr | Focus Area | Relevant For |
|------|------|------------|-------------|
| **Intelligence / OSINT Officer** | INTEL | Source credibility, OSINT tradecraft, operational context, narrative analysis | News, threat intelligence, content moderation |
| **Investigative Analyst** | IA | Source framing bias, editorial patterns, adversarial content injection | Content platforms, social media, search |
| **Legal & Compliance** | LEGAL | Privacy (GDPR/CCPA), licensing, terms of service, data retention, export controls, accessibility mandates, liability | Any user-facing product, health/finance, regulated industries |
| **ML / AI Engineer** | MLE | Model selection, prompt engineering, output parsing, token budgets, hallucination risk, eval metrics | AI/LLM-integrated projects |

---

## Rules

### 🧪 Testing & Quality Assurance

**1. Testing Mandate (NON-NEGOTIABLE)**

NO implementation is complete without tests. Violating this rule blocks merge/deployment.

- **New features** → Write tests covering all new code paths, edge cases, and boundary conditions
- **Modified behavior** → Update existing tests to reflect the new behavior. Stale assertions are bugs.
- **Bug fixes** → Write a regression test that would have caught the bug before the fix
- **After ALL changes** → Run the full test suite. Zero non-integration test failures is the only acceptable result.
- **ZERO TOLERANCE for pre-existing failures.** If ANY test fails — even if unrelated to the current change — fix the underlying issue before completing the task. "Pre-existing" is not an excuse. A red suite is a red suite.
- The **QA role** is personally responsible for calling out missing test coverage. If QA approves without verifying tests exist, QA has failed their role.

**2. Integration Test Isolation**

Tests that connect to external services (databases, third-party APIs, cloud resources) must be clearly marked as integration tests and must NOT run in the default test invocation. They may only run explicitly when a live environment is available.

**3. Flaky Test Zero-Tolerance**

A flaky test (passes sometimes, fails sometimes) is worse than no test — it trains the team to ignore failures. Flaky tests must be fixed immediately or quarantined with a tracking ticket. Never merge code on top of a flaky test.

---

### 🏗️ Architecture & Documentation

**4. Architecture Documentation Lifecycle (NON-NEGOTIABLE)**

Every project should maintain an Architecture Map — a single source-of-truth document covering system components, data flow, key algorithms, thresholds, and invariants. The lifecycle is:

1. **Consult** — Before changing any core logic, read the relevant section to verify your understanding
2. **Implement** — Make the code change
3. **Sync** — Update the architecture doc to reflect the new state (new constants, changed thresholds, added/removed components, new endpoints)
4. **Verify** — Re-read the doc and compare against the actual code. Fix any discrepancy immediately.

A sprint is NOT complete until the architecture doc reflects the deployed code. The **CA** role is personally responsible for verifying doc consistency. The **QA** role must verify doc accuracy as part of their review.

**5. Threshold Symmetry Audit (NON-NEGOTIABLE)**

When changing ANY promotion/demotion, scoring, rate-limiting, or gating threshold:

- **List all coupled thresholds** in the same subsystem. Promotion/demotion are always a pair. Changing one without auditing the other is a defect.
- **Verify no logical contradiction**: a value that qualifies for promotion must NOT also qualify for demotion. Ranges must have a clear gap.
- **Verify direction consistency**: if promotion rewards LOW scores, demotion must punish HIGH scores. Never mix "high = good" and "high = bad" within the same subsystem.
- **SecEng** and **PSE** must jointly sign off. A single-role approval is not sufficient for threshold logic.

**6. Root Cause Over Symptom Fixing (NON-NEGOTIABLE)**

Never settle for a symptomatic patch (validation gate, `try/except`, retry loop) without first identifying the underlying trigger. When a system that normally works suddenly fails:

- **Investigate the timeline.** What changed immediately prior?
- **Trace the exact input.** What was passed to the failing function?
- **Fix the root cause FIRST**, then add defensive layers as depth.
- ❌ **WRONG:** "It returned bad output. I added a validation check." → The check fires constantly because the real bug is still active.
- ✅ **RIGHT:** "It returned bad output. I traced it to a config change in commit X, fixed the config, AND added a validation gate as defense-in-depth."
- **QA** and **PSE** must challenge any "fix" that only adds a safety net without explaining *why* the failure started occurring.

---

### 🗄️ Database & Data Access

**7. Batch-First Data Access (MANDATORY)**

All database interactions MUST use bulk/batch patterns from the first implementation. **Never** write N+1 query loops.

- ❌ **WRONG:** `for item in items: db.query(Related).filter(id == item.fk).first()`
- ✅ **RIGHT:** `db.query(Related).filter(Related.id.in_(all_fk_ids)).all()` → build a dict lookup
- Use `WHERE id IN (...)` / `.in_()` for batch lookups
- Use `INSERT ... RETURNING` for batch inserts
- Use `UPDATE ... WHERE id IN (...)` for batch updates
- Pre-load all needed data in 1-3 bulk queries, then process in-memory
- The **PE** and **SQL** roles must audit every proposed DB interaction for N+1 anti-patterns.

**8. Migration DDL Lock Safety (NON-NEGOTIABLE)**

Every migration that performs DDL (`ALTER TABLE`, `CREATE INDEX`, `ADD COLUMN`) MUST set both `lock_timeout` and `statement_timeout` at the start of its connection.

- `lock_timeout` (e.g., 5 seconds) — If the DDL cannot acquire the lock in time, fail fast. The next deploy/run will retry.
- `statement_timeout` (e.g., 30-120 seconds) — If the DDL itself takes too long, abort.
- ❌ **WRONG:** `db.execute("ALTER TABLE t ADD COLUMN ...")` — no timeout, hangs forever under load
- ✅ **RIGHT:** `SET lock_timeout = '5000'; SET statement_timeout = '30000'; ALTER TABLE ...`
- Migrations MUST be idempotent (`IF NOT EXISTS`, `IF EXISTS`)
- For `CREATE INDEX CONCURRENTLY`, use autocommit isolation + `statement_timeout` only
- The **PE** and **SQL** roles must audit every migration for timeouts before approving.

> [!WARNING]
> An `ALTER TABLE` without `lock_timeout` is a production time bomb. Under API load, it will queue behind read locks, and all subsequent readers will queue behind it — creating a cascading deadlock that blocks the entire database.

**9. ORM-Generated SQL Verification**

When using an ORM to generate raw or hybrid SQL (e.g., SQLAlchemy `text()` with bound parameters, Django `RawSQL`, Sequelize `literal`):

- **Verify the generated SQL matches your database dialect.** ORMs abstract away dialect differences, but raw/hybrid queries bypass those abstractions.
- **Test parameterized queries with actual multi-value inputs**, not just single values. List/array expansion behaves differently across databases and ORMs.
- **Log the generated SQL in development** to catch dialect mismatches before production.

---

### 🔐 Security

**10. Secret Management (NON-NEGOTIABLE)**

- **Never hardcode** secrets, tokens, API keys, or credentials in source code — not even in "temporary" scripts or test files
- Use environment variables or a dedicated secret manager (Vault, AWS Secrets Manager, GCP Secret Manager, etc.)
- **Never log secret values**, even at DEBUG level. Log that a secret was loaded, not its value.
- Rotate secrets on a schedule. If a secret is compromised, rotate immediately and audit access logs.
- The **SecEng** role must audit every review for hardcoded secrets and credential exposure.

**11. Dependency Hygiene (MANDATORY)**

- **Pin all dependencies** to exact versions in lockfiles (`package-lock.json`, `poetry.lock`, `requirements.txt` with hashes)
- **Audit transitive dependencies** for known CVEs before merging. Use automated tools (`npm audit`, `pip-audit`, `safety`, Dependabot, Snyk)
- **Never use `latest` tags** for production dependencies. A `latest` tag today may be a breaking change tomorrow.
- When upgrading a dependency, read the changelog for breaking changes. "It still compiles" is not sufficient verification.

**12. Third-Party API Key Verification (NON-NEGOTIABLE)**

When integrating any third-party service key:

- **Copy-paste the key directly** from the provider's dashboard — never transcribe by eye. Many dashboard fonts make `l`/`1`, `O`/`0`, `I`/`l` visually identical.
- **Verify the key works** using a standalone test before wiring it into the application.
- **If a third-party widget returns a numeric error code**, look up the exact meaning in the provider's error reference before debugging code. The code is often correct — the key is wrong.
- Document public key values in deploy docs (never secret keys).

**13. Fix, Never Remove (NON-NEGOTIABLE)**

When a deploy, build, or test fails because a dependency is broken (secret missing, permission denied, config error, module not found), you MUST **fix the root cause**. You must NEVER silently remove the broken dependency to make the build succeed. Removing a broken feature to unblock progress is **sabotage disguised as progress** — the feature disappears from production with no error, no alert, and no one notices until a user reports it.

- ❌ **WRONG:** Deploy fails on missing secret → remove the secret reference from the deploy config
- ✅ **RIGHT:** Deploy fails on missing secret → create the secret, grant access, re-deploy with it
- This applies to: cloud secrets, permissions, packages, env vars, build args, Docker configs
- The **CTO** and **CA** must audit for this anti-pattern. If a feature that existed before deployment is missing after, it's a P0 regression.

---

### 🌐 API Design & Contracts

**14. Backward Compatibility (NON-NEGOTIABLE)**

- **Never modify a public API response schema** without a migration path for existing consumers
- Breaking changes require API versioning (`/v1/`, `/v2/`) or a deprecation period with advance notice
- Additive changes (new optional fields) are safe. Removing or renaming fields, changing types, or altering semantics are breaking changes.
- The **PSE** and **CA** roles must audit every API change for backward compatibility.

**15. Async-First API Handlers (MANDATORY)**

All `async` API endpoints MUST NOT call synchronous blocking operations directly on the event loop. Any call that performs I/O (API calls, database queries, file I/O) or heavy computation (>100ms) MUST be offloaded to a thread pool or made truly async.

- ❌ **WRONG:** `result = slow_service.generate(...)` inside an async handler
- ✅ **RIGHT:** `result = await asyncio.to_thread(slow_service.generate, ...)` (Python) or equivalent in your framework
- ✅ **ALSO RIGHT:** Use background task queues for operations >30s (return 202 + poll pattern)
- The **PE** role must audit every proposed endpoint for event-loop-blocking calls.

---

### 🚀 Deployment & Operations

**16. Deployed-vs-Local Code Verification (NON-NEGOTIABLE)**

When investigating a production failure, ALWAYS verify whether the local fix has been **deployed** to the running service. Check build history, deployment logs, or container image tags to confirm the deployed artifact contains the fix.

- ❌ **WRONG:** "I fixed it locally, it should work now" → assume it's live
- ✅ **RIGHT:** Fix → tests pass → deploy → confirm in production logs
- **A fix that exists only in the local repo is not a fix.** The **CA** and **CTO** must verify deployment status during post-mortems.

**17. Feature Flags for High-Risk Changes (MANDATORY)**

High-risk features should ship behind feature flags. This decouples deployment from release and enables instant rollback without redeploying.

- New user-facing features → behind a flag, enabled gradually (canary → percentage → 100%)
- Database schema changes → behind a flag if the old schema must remain readable during migration
- The **SRE** and **PO** roles must identify which changes warrant a feature flag during review.

**18. Monitoring & Alerting Coverage (NON-NEGOTIABLE)**

Every production feature must have corresponding monitoring. If you can't tell it's broken from a dashboard or alert, it's not production-ready.

- **Metrics:** Request rate, error rate, latency percentiles (p50, p95, p99) for every endpoint and background job
- **Alerts:** Error rate spike, latency degradation, job failure, resource exhaustion (disk, memory, connections)
- **Dashboards:** One dashboard per service showing health at a glance
- The **SRE** role must sign off on alerting coverage before a feature ships. "We'll add monitoring later" is not acceptable.

**19. Pipeline / Job Self-Healing (MANDATORY)**

When reviewing any change to pipeline or job orchestration, the **PE** and **CA** roles MUST verify:

- **Consecutive failure detection** — Does the pipeline check for consecutive failures before starting work? 2+ should trigger cleanup. 3+ should trigger alerting.
- **Zombie session cleanup** — Does the pipeline detect and kill hung sessions/transactions before running?
- **Data freshness detection** — Does the pipeline detect stale data and extend the processing window to catch up?
- **Orphan run cleanup** — Does the pipeline mark stale in-progress records as timed-out on startup?
- The pipeline must be **self-healing by design** — operator intervention should only be needed for novel failure modes.

---

### 🎨 Frontend & CSS

**20. Display Block on Card Containers (NON-NEGOTIABLE)**

Any element styled as a visual card (with `background`, `border`, `border-radius`, `padding`) MUST have `display: block` explicitly set if its HTML tag is NOT a `<div>`. This applies to `<a>` tags (including framework link components like Next.js `<Link>`), `<button>`, `<span>`, and any inline element.

- ❌ **WRONG:** `.card { background: ...; border-radius: 12px; }` on an `<a>` tag — missing `display: block`
- ✅ **RIGHT:** `.card { display: block; background: ...; border-radius: 12px; }`
- **What happens without it:** The browser fragments the inline box's background and borders across each block child, creating orphaned visual artifacts.

**21. Flex Container Width Shrinking (NON-NEGOTIABLE)**

Any centered container (`margin: 0 auto; max-width: Xpx`) inside a `display: flex` parent MUST have `width: 100%` explicitly set. Without it, `margin: auto` causes the element to shrink to content width instead of expanding to the parent.

- ❌ **WRONG:** `.wrapper { max-width: 1200px; margin: 0 auto; }` inside a flex parent → shrinks to content width
- ✅ **RIGHT:** `.wrapper { width: 100%; max-width: 1200px; margin: 0 auto; }` → stretches then caps
- The **UXD** and **PSE** roles must audit centered containers when any ancestor uses `flex` or `grid`.

**22. CSS Grid Auto-Row Scrolling Trap (NON-NEGOTIABLE)**

When a CSS Grid container has a definite height (`position: absolute; inset: 0` or explicit height) but defines ONLY `grid-template-columns` without `grid-template-rows`, implicit `auto` rows grow unbounded. This breaks `overflow-y: auto` on grid children.

- **Fix:** Always add `grid-template-rows: minmax(0, 1fr)` when the grid has a definite height and children need scrolling.
- **Companion fix:** Grid children that are flex-column containers must also have `overflow: hidden` to propagate the height constraint.

**23. Accessibility Baseline (MANDATORY)**

- All interactive elements must be keyboard-navigable (Tab, Enter, Escape)
- All images and icons must have alt text (or `aria-hidden="true"` for decorative elements)
- Color must not be the sole indicator of state — use icons, text, or patterns alongside color
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- Form inputs must have associated `<label>` elements
- The **UXD** role must audit every frontend review for a11y compliance.

---

### ⚙️ Error Handling & Resilience

**24. Explicit Error Handling (MANDATORY)**

Every external call (HTTP, database, filesystem, third-party API) must have explicit error handling with meaningful error messages.

- **Never swallow exceptions silently.** A bare `except: pass` or empty `catch {}` is a latent production outage.
- **Include context in error messages**: what operation failed, what input triggered it, what the caller should do about it.
- **Distinguish retryable from fatal errors.** A network timeout is retryable. A 403 Forbidden is not.
- ❌ **WRONG:** `try: result = api.call() except: return None`
- ✅ **RIGHT:** `try: result = api.call() except Timeout: logger.warning("API timeout, retrying..."); retry() except AuthError: logger.error("Auth failed for key %s", key_id); raise`

**25. Graceful Degradation**

When an optional dependency fails (cache, search index, analytics, non-critical API), the system should degrade gracefully — serve stale data, disable the feature, or show a user-friendly message — not crash entirely.

- The **CA** must classify every external dependency as **critical** (system can't function without it) or **optional** (system works at reduced capacity).
- Critical dependencies get retries + circuit breakers. Optional dependencies get timeouts + fallbacks.

---

### 🔧 Workflow & Process

**26. Git Workflow Discipline (MANDATORY)**

- **PR size limits:** ≤400 lines of code changed (excluding generated files). Larger PRs get split.
- **Descriptive commit messages:** Explain *why*, not *what*. The diff shows what changed; the message explains the reasoning.
- **Never force-push shared branches.** Rebase only on personal feature branches.
- **One concern per PR.** Refactors, bug fixes, and new features are separate PRs.

**27. Step-Zero Cleanup Before Refactors**

Before any structural refactor on files > 300 lines:

1. **FIRST:** Remove dead code, unused imports/exports, debug logging
2. Commit cleanup separately
3. **THEN** start the refactor on a clean baseline
4. Batch changes to ≤5 files per phase to stay within reviewable scope

**28. Shell Quoting Awareness**

When running code snippets from the command line, respect your shell's quoting rules:

- Complex multi-line commands with nested quotes, regex, or escape sequences are fragile in any shell (PowerShell, bash, zsh)
- **When in doubt, write a script file** and execute it instead of inline commands
- ❌ **WRONG:** `python -c "import re; print(re.findall(r'\"(.*?)\"', open('f.py').read()))"`
- ✅ **RIGHT:** Write the code to `find_patterns.py`, then run `python find_patterns.py`

---

### 🤖 LLM / AI Integration (Optional — activate for AI-integrated projects)

> [!TIP]
> These rules apply only to projects that integrate LLM/AI APIs (OpenAI, Gemini, Anthropic, etc.). Skip this section entirely if your project doesn't call language models.

**29. LLM Output Format Audit (MANDATORY)**

When reviewing ANY function that calls an LLM API, the **PSE** and **MLE** roles MUST audit:

- **Output format specification** — Is a response schema enforced? If yes, is it for short structured output (OK) or long-form text (NOT OK — schema overhead truncates content)?
- **Token budget** — Is `max_output_tokens` set? Is it sufficient for the expected output IN THE TARGET LANGUAGE? Non-English languages with diacritics or complex morphology may need ~30% more tokens than English.
- **Finish reason handling** — Does the code check the response's finish reason? A `MAX_TOKENS` finish reason means truncation — it must be logged and handled.
- **SDK auto-parsing** — If JSON output is requested, the SDK may auto-parse the response. Does the code handle both string and already-parsed dict responses?
- **Prompt stability** — If the prompt is assembled dynamically (templates, variable injection), what happens when an injected section is unexpectedly large or empty?

**30. Defensive Multi-Format LLM Response Parsing (MANDATORY)**

Any code that parses LLM output MUST handle ALL of these response formats:

- **Clean JSON string** — `response.text` returns `'{"key": "value"}'`
- **SDK auto-parsed dict** — `response.text` fails; the content is already a `dict`
- **Nested wrapping** — SDK or model wraps the response: `{"field": {"field": "actual text"}}`
- **List instead of scalar** — Model returns `["paragraph 1", "paragraph 2"]` instead of a single string
- **Plain text (no JSON)** — Model ignores JSON instructions and returns raw text
- **Truncated JSON** — Token limit hit mid-output, producing `{"key": "val` (unterminated)

Any LLM parsing function that only handles clean JSON is a latent production bug. The other cases WILL occur at unpredictable intervals.

**31. LLM Model Pinning Strategy (MANDATORY)**

- **Primary model:** Use a `-latest` or auto-upgrading alias when available. This ensures you benefit from improvements automatically.
- **Fallback model:** Pin to a specific known-working version for resilience when the primary fails or regresses.
- **Eval before upgrade:** When a model version changes, re-run your eval suite before promoting to production. "Latest" is not always "best for your use case."

---

## Customize This Panel

This panel is a starting point, not a finished product. The best review panels are grown from real failures, not templates.

**To adapt for your project:**

1. **Fork this file** into your project's docs or workflow directory
2. **Remove roles you don't need.** A 3-person team building a CLI tool doesn't need 13 roles. Start with CTO, PSE, QA, and SecEng.
3. **Add domain-specific rules.** Every post-mortem should produce a rule. Format: what happened, why the existing rules didn't catch it, what rule would have prevented it.
4. **Add your stack's footguns.** Every language, framework, and database has sharp edges. Document the ones that have actually cut you.
5. **Review the panel itself** every quarter. Rules that never fire are clutter. Rules that fire constantly mean the underlying process is broken.

> [!IMPORTANT]
> The most valuable rules in this document are the ones that came from real production incidents. When you add a rule, include a one-line "This rule exists because..." rationale. Without the story, future team members will see it as bureaucracy and skip it.
