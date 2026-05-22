# Python rewrite of the autogame harness

**Status:** design draft, pre-implementation. Owner: Matt + Claude.
**Cutover model:** big-bang. The Python package replaces every bash file under
`harness/` in one PR (with a tag to roll back to if needed). No hybrid period.
**Scope:** harness only. The `game/` codebase is unchanged.

---

## 1. Goals

1. **Role-as-data.** Today's `IMPL_MODEL` / `QA_MODEL` / `DECOMP_MODEL` env-var
   zoo collapses to a single `roles.yaml` where each role names a primary
   backend, a fallback chain, a timeout, and a writable flag. Switching the
   implementer from qwen to composer is a one-line YAML edit, hot-reloaded at
   the next sub-ticket spawn — the same UX as today's `runtime.env`, but for
   the full chain instead of just three keys.
2. **Agent-as-class.** Each backend CLI gets one Python class implementing a
   shared `Agent` interface. Per-backend quirks (cursor-agent's `--mode ask`
   trap, qwen's blank-output failure mode, agy's missing `--model` flag) are
   encapsulated and don't leak into the dispatch logic.
3. **Pipeline-as-object.** `run_subtask.sh` becomes a `Pipeline` of explicit
   `Step`s with declared inputs/outputs/side-effects. This is the precondition
   for safe parallelism — once a Pipeline operates on a `Workspace`, two of
   them can run side-by-side without colliding.
4. **Worktree-per-worker (foundation).** The `Workspace` abstraction is
   designed from day 1 so a future `Worker` can own a git worktree and a port
   pair. Day-1 default is single-worker (matches today's behavior); the
   merge-queue + parallel scheduler comes in step 5 of the migration.
5. **Repair-agent path preserved.** `supervisor.sh`'s "on tool-failure, call
   claude to repair" loop is a feature, not an accident. The Python supervisor
   keeps it, just modeled as a `RepairStep` invoked on the `tool_failure`
   branch.

## 2. Non-goals

- **Not** switching to model SDKs. Per the architectural decision in §3.2,
  every Agent shells out to its existing CLI; the Python layer is structured
  argv + structured parsing. SDKs can come later, file-by-file, without
  changing the interface.
- **Not** rewriting the prompt templates. The 11 markdown files under
  `harness/prompts/` are reused verbatim; only the renderer (today's
  `render_prompt` bash function) is reimplemented.
- **Not** changing the ticket/sub-ticket directory layout, the `.passed`
  marker convention, the `feedback.md` / `handoff.md` / `review.md` /
  `gaps.md` / `nits.md` file contract, or the `v0.X` git tag convention.
  All of these are how tickets and sub-tickets persist progress; touching
  them would force every in-flight ticket to be replayed.
- **Not** rewriting the progress UI under `harness/progress/public/`. The
  server emits the same `events.ndjson` stream; the browser bundle is
  unchanged.
- **Not** parallel workers from day 1. The interfaces support it; the
  scheduler ships in step 5 of the migration, after the single-worker port
  is proven.

## 3. Architecture

### 3.1 The four layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ Orchestrator                                                        │
│  Supervisor → Backlog → Ticket → SubTicket                          │
│  (the loops; what supervisor.sh / run_backlog.sh / run_ticket.sh do)│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ runs
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Pipeline                                                            │
│  Sequence/Parallel/Branch of Steps that operate on a Workspace      │
│  (what run_subtask.sh does, as data)                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ dispatches role.execute()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Role                                                                │
│  Primary Agent + fallback chain; verdict parsing; retry policy      │
│  (what the qa-chain ladder + QA_MODEL prepend logic do)             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Agent                                                               │
│  One concrete CLI backend: QwenAgent, CursorAgent, AgyAgent,        │
│  ClaudeAgent. Owns argv construction, subprocess management,        │
│  timeout, stdout capture, telemetry emission.                       │
└─────────────────────────────────────────────────────────────────────┘
```

Each layer talks only to the one directly below. The Orchestrator never
constructs an Agent; it constructs a Roster, picks a Role from it, and runs
a Pipeline that calls `role.execute()`.

### 3.2 Why subprocess wrappers, not SDKs

The cursor `agent` CLI is the only way to get composer-2.5* and gpt-5.5-*
without rebuilding cursor-agent's tool-use scaffolding from scratch. The
qwen CLI similarly bundles MCP-server config (used for `qwen-vision` via
the playwright MCP). Antigravity has no SDK. Anthropic and OpenAI both have
SDKs but they're the minority of calls.

Shelling out preserves all of the above and means the Python rewrite is a
strict refactor of orchestration — not a rewrite of how any individual call
behaves. That bounds the test surface: if today's prompt-X-via-CLI-Y
produces output Z, tomorrow's prompt-X-via-PythonAgent-Y produces the same
output Z, because PythonAgent shells out to the same CLI with the same argv.

Migrating individual Agents to SDKs later is a per-class change, no
interface impact.

### 3.3 Why YAML for roster, code for pipeline

Roles change frequently and are typed by humans during experiments (today's
runtime.env). YAML is the right shape: declarative, hot-reloadable, easy to
diff, easy to point a non-Python operator at.

Pipelines change rarely and have non-trivial control flow (parallel pipeline
checks during screenshot capture, branch on PASS/FAIL, optional vision
feedback). Python code is the right shape: gives us types, refactoring, and
unit tests.

## 4. Module layout

```
harness/
  pyproject.toml              # poetry; py3.12; single package
  roles.yaml                  # the roster (committed)
  roles.local.yaml            # optional, gitignored — runtime overrides
  __main__.py                 # `python -m harness <subcommand>`
  cli.py                      # subcommand router (supervisor, backlog, ticket, subtask, doctor)
  config.py                   # loads roles.yaml + roles.local.yaml, env-var overrides
  agents/
    __init__.py
    base.py                   # Agent ABC, AgentResult, Capability enum
    qwen.py                   # QwenAgent (also QwenVisionAgent subclass)
    cursor.py                 # CursorAgent (composer-2.5, composer-2.5-fast, gpt-5.5-*)
    agy.py                    # AgyAgent (Antigravity / Gemini)
    claude.py                 # ClaudeAgent
  roles.py                    # Role, Roster, ChainResult, VerdictParser
  workspace/
    __init__.py
    workspace.py              # Workspace ABC
    repo.py                   # main-repo workspace (today's behavior)
    worktree.py               # git-worktree-per-worker workspace (step 5)
    ports.py                  # PortAllocator (game-server + vite)
  pipelines/
    __init__.py
    step.py                   # Step ABC, ParallelStep, BranchStep, SequenceStep
    subtask.py                # SubTicketPipeline (replaces run_subtask.sh)
    ticket.py                 # TicketPipeline   (replaces run_ticket.sh)
    backlog.py                # BacklogPipeline  (replaces run_backlog.sh)
  steps/
    __init__.py
    implement.py
    qa.py
    pipeline_checks.py        # vitest server + client in background
    game.py                   # start_game, stop_game, wait_for_game
    screenshot.py             # invokes screenshot.mjs subprocess
    commit.py                 # role-driven commit + deterministic fallback
    handoff.py                # synthesize handoff.md when implementer leaves none
    feedback.py               # accumulate feedback.md on FAIL
    vision_feedback.py        # optional run_qwen_vision branch on visual FAIL
    decompose.py
    review.py                 # top-level review (review.md / gaps.md / nits.md)
    repair.py                 # supervisor's escalate-to-claude
  prompts/
    renderer.py               # render_prompt equivalent
    verdict.py                # has_verdict / is_pass regexes
  git_helpers.py              # commit_verified, scope helpers (':!harness' etc.)
  telemetry/
    progress.py               # emit_progress_event → events.ndjson + HTTP POST
    usage.py                  # record_agent_usage (tokens, model, duration)
    logging.py                # structured logger; tee to per-pipeline log files
  supervisor.py               # the outermost watchdog (replaces supervisor.sh)
  prompts_dir/                # → symlink or copy of existing harness/prompts/
  progress/                   # ← unchanged; the express server + public/ stay
  tests/
    unit/
    integration/
    smoke/
```

`__main__.py` makes `python -m harness …` the single entry point. The
subcommands map 1:1 to today's scripts:

| Today                       | Tomorrow                                    |
| --------------------------- | ------------------------------------------- |
| `bash supervisor.sh`        | `python -m harness supervisor`              |
| `bash run_backlog.sh`       | `python -m harness backlog`                 |
| `bash run_ticket.sh <name>` | `python -m harness ticket <name>`           |
| `bash run_subtask.sh <dir>` | `python -m harness subtask <dir>`           |
| `bash qwen_vision_smoke.sh` | `python -m harness doctor vision`           |
| `bash lint.sh`              | `python -m harness lint` (wraps shellcheck) |

The tmux launch command becomes:

```bash
tmux new-session -d -s autogame python -m harness supervisor 2>&1 | tee -a LOOPLOG.txt
```

## 5. The Agent interface

```python
# harness/agents/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Flag, auto
from pathlib import Path
from typing import Mapping


class Capability(Flag):
    NONE       = 0
    WRITE_FILES = auto()    # backend can edit files in the workspace
    READ_FILES  = auto()    # backend can read files (always true for our agents)
    VISION      = auto()    # backend can process screenshots
    LONG_CONTEXT = auto()   # backend handles >200k input tokens well


@dataclass
class Prompt:
    """A rendered prompt string + the source template path (for telemetry)."""
    body: str
    template: Path


@dataclass
class AgentResult:
    rc: int                          # 0 = ok, 1 = task-failure, 2 = tool-failure
    stdout: str                      # full captured stdout
    duration_s: float
    started_at: float                # unix epoch
    ended_at: float
    timed_out: bool = False
    # Diff produced by the agent (vs the workspace state at .run() entry).
    # Empty string when the agent is read-only or made no changes.
    diff: str = ""
    # Tokens / usage if the backend reports them; otherwise zero.
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    # Per-backend metadata (e.g. cursor-agent session id, qwen model, …).
    extra: Mapping[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.rc == 0 and not self.timed_out


@dataclass
class AgentSpec:
    """
    The YAML-friendly description of one Agent instance. Concrete agent
    classes accept this in their constructor; the Roster turns YAML rows
    into AgentSpec dataclasses via Pydantic.
    """
    backend: str       # "qwen" | "cursor" | "agy" | "claude"
    model: str | None  # "composer-2.5-fast" etc; None means backend default
    writable: bool = False   # cursor-only: --mode ask (False) vs writable (True)
    extra: Mapping[str, str] = field(default_factory=dict)


class Agent(ABC):
    """One concrete CLI backend wrapper."""

    name: str                     # e.g. "cursor/composer-2.5-fast (writable)"
    capabilities: Capability
    cost_tier: int                # 0=local-free, 1=cheap-cloud, 2=premium

    @abstractmethod
    async def run(
        self,
        prompt: Prompt,
        workspace: "Workspace",
        *,
        timeout_s: float,
        telemetry: "TelemetrySink",
    ) -> AgentResult: ...

    # Required for the fast-fail short-circuit (today's QWEN_DISABLED knob
    # is replaced by simply removing qwen from the roster — but agents can
    # report "I'm unavailable" without spawning a subprocess, e.g. qwen
    # noticing ollama isn't running). Default returns True.
    async def available(self) -> bool:
        return True
```

### 5.1 Concrete agents — quirks documented

Each subclass documents the per-backend trap that bit us in the bash
harness. The docstrings are the spec — see `harness/lib.sh` for the bash
equivalents being ported.

```python
# harness/agents/cursor.py
class CursorAgent(Agent):
    """
    cursor `agent` CLI. Two operating modes per the same TRUST CAVEAT
    documented in the bash run_agent_model_writable:

    - writable=True  → no --mode flag; agent can write files. Required for
      top-level reviewers (must write review.md / gaps.md / nits.md) and
      for the implementer/decomposer roles. CAVEAT: the agent CAN write
      anywhere in the workspace, including harness/. Mitigations: the
      prompt forbids edits outside the target files, and a post-run
      ScopeAuditStep flags out-of-scope edits.

    - writable=False → --mode ask. Read-only — required for QA roles so the
      reviewer cannot edit the code it judges. KNOWN TRAP: under --mode ask
      the agent silently falls back to printing file contents in chat when
      asked to write a file. The QA prompts never ask for file writes, so
      this is safe there; do NOT use writable=False for the implementer or
      a top-level reviewer.

    The `--model` flag is mandatory and selects composer-2.5,
    composer-2.5-fast, gpt-5.5-medium-fast, gpt-5.5-extra-high, etc.
    """
    capabilities = Capability.READ_FILES | Capability.WRITE_FILES | Capability.LONG_CONTEXT

    def __init__(self, model: str, *, writable: bool):
        self.model = model
        self.writable = writable
        self.name = f"cursor/{model}" + (" (writable)" if writable else " (ask)")

    async def run(self, prompt, workspace, *, timeout_s, telemetry):
        argv = [
            "agent", "-p", "--force", "--trust",
            "--model", self.model,
        ]
        if not self.writable:
            argv += ["--mode", "ask"]
        argv.append(prompt.body)
        return await _spawn(
            argv, prompt=prompt, workspace=workspace,
            timeout_s=timeout_s, telemetry=telemetry,
            usage_kind="final_review" if self.writable else "qa",
            label=self.name,
        )
```

```python
# harness/agents/qwen.py
class QwenAgent(Agent):
    """
    Local qwen-code CLI. Talks to qwen-coder hosted on Alibaba's API by
    default; can be pointed at Ollama via QWEN_CODE_SYSTEM_SETTINGS_PATH
    (used by QwenVisionAgent).

    KNOWN FAILURE MODES the dispatcher must handle (carried over from the
    bash _run_cli retry policy):
      1. Empty output (qwen exits 0 but stdout is whitespace). Treated as
         rc=2 tool-failure so the chain falls through.
      2. "You have exhausted your capacity on this model" — treated as rc=2.
      3. Hard timeout — wrapped in `timeout -k 30`, treated as rc=2 with
         AgentResult.timed_out=True.

    Removing qwen from the roster is equivalent to today's QWEN_DISABLED=1
    knob; no separate flag is needed.
    """
    capabilities = Capability.READ_FILES | Capability.WRITE_FILES
    cost_tier = 0

    def __init__(self, model: str | None = None, *, openai_logging: bool = True):
        self.model = model
        self.openai_logging = openai_logging
        self.name = f"qwen/{model or 'default'}"
```

```python
# harness/agents/agy.py
class AgyAgent(Agent):
    """
    Antigravity CLI (Gemini 3.5 Flash, High).

    PORTED-OVER QUIRK: there is NO --model flag; the model is pinned
    globally via the interactive `/model` slash command and persisted
    server-side. AGY_MODEL_LABEL is recorded for telemetry only — it does
    not control which model runs. If a future version exposes a flag we
    add it here; until then, the constructor's `model_label` arg is
    metadata-only.

    PORTED-OVER QUIRK 2: agy's print-mode workspaceDirs is always empty
    regardless of cwd. The bash harness absolutizes all paths before
    passing them in (run_subtask.sh:24); the Python pipeline does the
    same in the Prompt renderer for any @file references.
    """
    capabilities = Capability.READ_FILES | Capability.LONG_CONTEXT

    def __init__(self, model_label: str = "Gemini 3.5 Flash (High)"):
        self.model_label = model_label
        self.name = f"agy/{model_label}"
```

```python
# harness/agents/claude.py
class ClaudeAgent(Agent):
    """Claude via `claude -p --dangerously-skip-permissions`."""
    capabilities = Capability.READ_FILES | Capability.WRITE_FILES | Capability.LONG_CONTEXT
    cost_tier = 2
```

### 5.2 The subprocess helper

Every Agent.run() goes through one helper for consistency:

```python
# harness/agents/_spawn.py
async def _spawn(
    argv: list[str],
    *,
    prompt: Prompt,
    workspace: Workspace,
    timeout_s: float,
    telemetry: TelemetrySink,
    usage_kind: str,
    label: str,
    retries: int = 2,
    retry_backoff_s: float = 20.0,
) -> AgentResult:
    """
    The Python equivalent of bash _run_cli. Spawns the CLI with the prompt
    on the last argv slot, captures stdout, enforces timeout via
    asyncio.wait_for + process.terminate/kill, retries on:
      - timeout
      - empty stdout
      - "you have exhausted your capacity" sentinel
      - "api error only" sentinel (today's cli_failure_reason)
    Records to telemetry on every attempt and the final result.

    NOTE on retry: the same retry policy as today (2 retries, 20s backoff
    each). The retries are inside _spawn because they're identical across
    all agents; the role-level fallback chain is OUTSIDE this function.
    """
```

## 6. Role + Roster

```python
# harness/roles.py
@dataclass
class Role:
    name: str                          # "implementer" | "qa:code" | "qa:visual" | "decomposer" | …
    primary: Agent
    fallbacks: list[Agent]
    timeout_s: float
    prompt_template: Path              # e.g. harness/prompts/implement.md
    verdict_parser: VerdictParser | None  # None when the role doesn't produce a verdict
    out_file: str                      # filename to write captured stdout to (e.g. "qwen.txt")
    # Per-role scope rules — used by the post-run ScopeAuditStep to flag
    # edits outside the role's allowed set.
    scope: PathScope


@dataclass
class ChainResult:
    final: AgentResult
    accepted_by: Agent
    skipped: list[tuple[Agent, str]]   # (agent, reason) for each tier that failed/no-verdicted


class Role:
    async def execute(self, workspace, prompt_vars: Mapping[str, str], *, telemetry) -> ChainResult:
        """
        Tries primary, then each fallback in order. A tier is accepted if:
          - AgentResult.ok, AND
          - verdict_parser is None OR verdict_parser.has_verdict(stdout)
        Otherwise the tier is recorded as skipped and the next one runs.
        On exhaustion, returns the last AgentResult with accepted_by=None.
        """
```

### 6.1 `roles.yaml`

```yaml
# harness/roles.yaml — committed; the canonical roster.
# Override per-experiment via roles.local.yaml (gitignored).

# --- shared agent definitions, referenced by anchor below ---
_agents:
  - &qwen        { backend: qwen }
  - &qwen_vision { backend: qwen, model: "qwen3.6:27b-q8_0", extra: { mode: vision } }
  - &composer_fast_write
                 { backend: cursor, model: composer-2.5-fast, writable: true }
  - &composer_fast_read
                 { backend: cursor, model: composer-2.5-fast, writable: false }
  - &composer_write
                 { backend: cursor, model: composer-2.5,      writable: true }
  - &composer_read
                 { backend: cursor, model: composer-2.5,      writable: false }
  - &gpt5_medium_write
                 { backend: cursor, model: gpt-5.5-medium-fast, writable: true }
  - &gpt5_extra_write
                 { backend: cursor, model: gpt-5.5-extra-high,  writable: true }
  - &agy         { backend: agy,    model_label: "Gemini 3.5 Flash (High)" }
  - &claude      { backend: claude }

roles:

  # === Sub-ticket roles (run by SubTicketPipeline) ===

  implementer:
    primary: *qwen
    fallbacks: []                 # implementer has no fallback — see §6.2
    timeout_s: 7200
    out_file: "qwen.txt"
    prompt_template: prompts/implement.md
    verdict_parser: null
    scope: { allow: ["game/**"], deny: ["tickets/**"] }

  qa:code:
    primary: *qwen
    fallbacks: [*composer_fast_read, *agy, *claude]
    timeout_s: 720
    out_file: "qa.txt"
    prompt_template: prompts/qa-code.md
    verdict_parser: { kind: pass_fail, pattern: '^VERDICT:\s*(PASS|FAIL)\b' }
    scope: { allow: [], deny: ["**"] }   # QA is read-only — any edit is a bug

  qa:visual:
    primary: *qwen
    fallbacks: [*composer_fast_read, *agy, *claude]
    timeout_s: 720
    out_file: "qa.txt"
    prompt_template: prompts/qa.md
    verdict_parser: { kind: pass_fail, pattern: '^VERDICT:\s*(PASS|FAIL)\b' }
    scope: { allow: [], deny: ["**"] }

  committer:
    primary: *qwen
    fallbacks: []                 # if qwen fails, CommitStep does the deterministic fallback
    timeout_s: 600
    out_file: "commit.txt"
    prompt_template: prompts/commit.md
    verdict_parser: null
    scope: { allow: ["**"], deny: [] }   # commit can touch the index

  vision_feedback:                # optional, only on visual QA fail
    primary: *qwen_vision
    fallbacks: []
    timeout_s: 900
    out_file: "qwen-vision.txt"
    prompt_template: prompts/qwen-vision-feedback.md
    verdict_parser: null
    scope: { allow: [], deny: ["**"] }   # purely an enrichment pass; no edits

  # === Ticket roles (run by TicketPipeline) ===

  decomposer:
    primary: *qwen
    fallbacks: []                 # if decomposer fails, TicketPipeline retries next round
    timeout_s: 1800
    out_file: "decompose.txt"
    prompt_template: prompts/decompose.md
    verdict_parser: null
    scope: { allow: ["tickets/**"], deny: [] }

  # Top-level review — three difficulty tiers (today's REVIEW_*_MODEL).
  review:easy:
    primary: *composer_write
    fallbacks: [*claude]
    timeout_s: 720
    out_file: "review-attempt.txt"
    prompt_template: prompts/review.md
    verdict_parser: { kind: review, accept_on: [REVIEW_FILES_WRITTEN] }
    scope: { allow: ["tickets/**"], deny: ["game/**", "harness/**"] }

  review:medium:
    primary: *gpt5_medium_write
    fallbacks: [*composer_write, *claude]
    timeout_s: 720
    out_file: "review-attempt.txt"
    prompt_template: prompts/review.md
    verdict_parser: { kind: review, accept_on: [REVIEW_FILES_WRITTEN] }
    scope: { allow: ["tickets/**"], deny: ["game/**", "harness/**"] }

  review:hard:
    primary: *gpt5_extra_write
    fallbacks: [*composer_write, *claude]
    timeout_s: 720
    out_file: "review-attempt.txt"
    prompt_template: prompts/review.md
    verdict_parser: { kind: review, accept_on: [REVIEW_FILES_WRITTEN] }
    scope: { allow: ["tickets/**"], deny: ["game/**", "harness/**"] }

  # === Supervisor roles ===

  repair:                         # supervisor's diagnose-and-repair-the-harness escalation
    primary: *claude
    fallbacks: []
    timeout_s: 900
    out_file: "diagnosis.txt"
    prompt_template: prompts/diagnose.md
    verdict_parser: null
    scope: { allow: ["harness/**"], deny: ["game/**", "tickets/**"] }
```

`roles.local.yaml` uses the same schema and shallow-merges into `roles.yaml`:
any role re-declared in the local file replaces the committed role entirely
(no field-level merge — confusing semantics). This is how the experiments
from earlier today (composer implementer, composer QA) get expressed:

```yaml
# harness/roles.local.yaml — gitignored
roles:
  implementer:
    primary: { backend: cursor, model: composer-2.5-fast, writable: true }
    fallbacks: [{ backend: qwen }]   # qwen as backup, not primary
    timeout_s: 1800
    out_file: "qwen.txt"             # kept for log/progress consumers
    prompt_template: prompts/implement.md
    verdict_parser: null
    scope: { allow: ["game/**"], deny: ["tickets/**"] }
  qa:code:
    primary: { backend: cursor, model: composer-2.5, writable: false }
    fallbacks: [{ backend: qwen }, { backend: cursor, model: composer-2.5-fast, writable: false }, { backend: agy }, { backend: claude }]
    timeout_s: 720
    out_file: "qa.txt"
    prompt_template: prompts/qa-code.md
    verdict_parser: { kind: pass_fail, pattern: '^VERDICT:\s*(PASS|FAIL)\b' }
    scope: { allow: [], deny: ["**"] }
```

### 6.2 Why implementer has no fallbacks

The implementer is the only role that mutates `game/` files. If primary
implementer fails, the right answer is to retry next iteration (with the
synthesized handoff explaining what went wrong) — NOT to silently let a
fallback agent take over, because the fallback's coding style and
assumptions differ enough that the resulting diff becomes a mess. Today's
bash mirrors this: `run_qwen` for the implementer has retries inside
`_run_cli` but no per-call fallback to a different agent.

If you want a different agent to implement, change the primary in YAML.

### 6.3 Hot-reload semantics

The Roster is loaded once per `Pipeline` construction, NOT once per
Supervisor process. Specifically:
- `SubTicketPipeline.__init__` calls `Roster.load()` → fresh YAML read.
- `TicketPipeline` loads the roster once at ticket start (decomposer +
  review use it).
- The Supervisor loop reloads nothing — it's just a loop that constructs
  fresh Pipelines.

Effect: editing `roles.local.yaml` between sub-tickets is picked up at the
next sub-ticket spawn. Same UX as today's `runtime.env`, no SIGHUP needed.

## 7. Workspace

```python
# harness/workspace/workspace.py
@dataclass
class PortAllocation:
    game_server: int    # default 3000
    vite: int           # default 5173


class Workspace(ABC):
    root: Path
    ports: PortAllocation
    branch: str

    @abstractmethod
    async def diff(self, scope: PathScope = ALL) -> str: ...

    @abstractmethod
    async def commit(self, message: str, scope: PathScope) -> CommitResult: ...

    @abstractmethod
    async def tag(self, name: str, message: str | None = None) -> None: ...

    @abstractmethod
    async def head(self) -> str: ...    # current sha

    @abstractmethod
    async def status_porcelain(self, scope: PathScope) -> str: ...

    async def merge_into_main(self) -> MergeResult:
        """No-op for RepoWorkspace (already on main); WorktreeWorkspace
        serializes its commit onto main via the merge queue (step 5)."""
        return MergeResult(no_op=True)
```

### 7.1 RepoWorkspace — day-1 default

Operates directly on `/home/matt/workspace/autogame` checked out on `main`.
Mirrors today's behavior exactly: one writer at a time, every commit lands
on main. Tag and commit are direct git calls.

### 7.2 WorktreeWorkspace — step 5

Each Worker calls `git worktree add ../autogame-worker-N <branch>` at
startup. The worktree is the Workspace.root; agents write into it; commits
land on the worker's branch. `merge_into_main()` uses a merge queue:

```python
async def merge_into_main(self):
    async with MERGE_QUEUE:        # asyncio.Lock — only one merge at a time
        await git("fetch", "origin", "main", cwd=MAIN_REPO)
        await git("rebase", "origin/main", cwd=self.root)  # may fail
        await git("push", "origin", self.branch, cwd=self.root)
        await git("merge", "--ff-only", self.branch, cwd=MAIN_REPO)
        return MergeResult(...)
```

On rebase conflict the worker's sub-ticket fails and is requeued (the
top-level review will see no changes for that sub-ticket; it'll either
re-decompose or accept the loss).

### 7.3 PortAllocator

Day 1: returns the fixed `{3000, 5173}` constant (matches today). Step 5:
allocates from a pool, one pair per active worker. Game servers and Vite
need their ports baked in at startup (the bash harness doesn't parameterize
them); we will likely need a small game-side change to accept `--server-port`
/ `--vite-port` flags. Documented as a step-5 dependency, not blocking.

## 8. Pipeline + Step

### 8.1 The Step ABC

```python
# harness/pipelines/step.py
@dataclass
class StepContext:
    workspace: Workspace
    artifacts: Path              # this iteration's artifacts/iter-N/
    roster: Roster
    telemetry: TelemetrySink
    log: Logger
    # Mutable bag of values produced by earlier steps; downstream steps
    # read by key. Examples: "coder_rc", "qa_verdict", "game_live", "diff_path".
    state: dict[str, object]


class Step(ABC):
    name: str

    @abstractmethod
    async def run(self, ctx: StepContext) -> StepResult: ...
```

`StepResult` carries `outcome ∈ {OK, FAIL, TOOL_FAILURE, SKIP}`, optional
state updates, and optional emitted-event payloads.

### 8.2 Combinators

- `SequenceStep([a, b, c])` — runs in order; short-circuits on TOOL_FAILURE.
- `ParallelStep([a, b])` — runs concurrently; reduces results by joining
  state and taking the worst outcome.
- `BranchStep(predicate, on_true, on_false)` — branches on a state key.
- `RetryStep(inner, *, retries=2)` — used at the iteration level, not the
  step level (retries on TOOL_FAILURE; not on FAIL — FAIL is a real verdict).

### 8.3 SubTicketPipeline (replaces run_subtask.sh)

```python
SubTicketPipeline = SequenceStep([
    ImplementStep(role_name="implementer"),
    EnsureHandoffStep(),              # synthesize handoff.md if implementer left none
    GuardImplementerScopeStep(),      # fails if implementer touched out-of-scope paths
    ParallelStep([
        PipelineChecksStep(),         # vitest server + client
        SequenceStep([
            StartGameStep(),
            ScreenshotStep(),
        ]),
    ]),
    CaptureDiffStep(),
    QAStep(role_name_fn=ctx_qa_mode), # picks "qa:code" or "qa:visual" from ticket front matter
    BranchStep(
        predicate=lambda ctx: ctx.state["qa_verdict"] == "PASS",
        on_true=SequenceStep([
            StopGameStep(),
            CommitStep(role_name="committer"),  # with deterministic fallback inside
            MarkPassedStep(),         # writes .passed marker, exits pipeline OK
        ]),
        on_false=SequenceStep([
            OptionalVisionFeedbackStep(),   # only when QA mode is visual + enabled
            StopGameStep(),
            AccumulateFeedbackStep(),
            # iteration loop continues
        ]),
    ),
])

SubTicket = IterateStep(
    inner=SubTicketPipeline,
    max_iter=cfg.max_iter,           # today's MAX_ITER, default 5
    on_tool_failure=ExitTwoStep(),   # rc=2 escalates to the supervisor
)
```

Every Step.run records `iteration_start` / step-name / `iteration_end` to
the same `progress/events.ndjson` stream the bash harness writes today.
The browser UI consumes it unchanged.

### 8.4 TicketPipeline (replaces run_ticket.sh)

The top-level ticket loop is bigger but follows the same shape:

```python
TicketPipeline = IterateStep(
    max_iter=cfg.ticket_max_rounds,    # today's TICKET_MAX_ROUNDS, default 10
    inner=SequenceStep([
        ReadReviewFeedbackStep(),       # gaps from previous round, if any
        DecomposeStep(role_name="decomposer"),
        ListSubTicketsStep(),
        ForEachSubTicketStep(
            inner=RunSubTicketStep(),   # → spawns SubTicketPipeline per sub-ticket
            order="version",            # 01-, 02-, … sorted
            skip_if=lambda st: st.has_marker(".passed"),
        ),
        ReviewStep(
            role_name_fn=lambda t: f"review:{t.difficulty}",
            recover=RecoverReviewFilesStep(),   # awk extractor when reviewer printed instead of writing
        ),
        BranchStep(
            predicate=lambda ctx: ctx.state["review_verdict"] == "APPROVE",
            on_true=SequenceStep([
                TagTicketStep(),         # v0.X tag
                MarkTicketCompleteStep(),
                ExitSuccessStep(),
            ]),
            on_false=SequenceStep([
                AccumulateReviewFeedbackStep(),   # writes review-feedback.md for next round
                # ticket loop continues with REMEDIATION ROUND N+1
            ]),
        ),
    ]),
)
```

### 8.5 BacklogPipeline + Supervisor

```python
# Replaces run_backlog.sh
BacklogPipeline = SequenceStep([
    WhileStep(
        predicate=lambda ctx: AnyOpenTicket().check(),
        body=SequenceStep([
            PickNextTicketStep(),
            TicketPipeline,
            BranchStep(
                predicate=lambda ctx: ctx.state["ticket_outcome"] == "complete",
                on_true=NoOpStep(),
                on_false=BreakStep(rc=2),     # escalates
            ),
        ]),
    ),
])
```

```python
# Replaces supervisor.sh
class Supervisor:
    def __init__(self, max_escalations: int = 3):
        self.escalations = 0
        self.max_escalations = max_escalations

    async def run(self):
        while True:
            tags_before = await count_v0_tags()
            rc = await BacklogPipeline.run(...)
            tags_after = await count_v0_tags()

            completed = tags_after - tags_before
            self.escalations = max(0, self.escalations - completed)

            if rc == 0:
                return 0                    # all done
            if rc == 1:
                return 1                    # human review needed
            # rc == 2: tool-failure → repair-agent
            self.escalations += 1
            if self.escalations > self.max_escalations:
                return 2
            await RepairStep(role_name="repair").run(...)
            await asyncio.sleep(5)
```

The escalation-decay logic ("every ticket that completed pays back one
strike") is preserved verbatim from `supervisor.sh:38-44` — this is a real
piece of judgment we don't want to lose.

## 9. Telemetry & progress UI

### 9.1 The events stream

`harness/telemetry/progress.py` exposes one function:

```python
def emit_progress_event(type: str, payload: dict) -> None: ...
```

Behavior identical to the bash `emit_progress_event`:
1. Append a JSON line to `harness/progress/events.ndjson`.
2. If `PROGRESS_SERVER_URL` is set, POST the line to `<URL>/events`.
3. Never affects control flow (errors swallowed).

The event vocabulary is unchanged — every event name currently emitted
(`subtask_start`, `iteration_start`, `qa_verified`, `qa_verdict`,
`pipeline_check_start`, `pipeline_check_finish`, `capture_complete`,
`game_start`, `qwen_visual_feedback`, `subtask_passed`, `agent_retry`, …)
is emitted from the equivalent Step. The browser UI under
`harness/progress/public/` reads the same schema and needs no changes.

### 9.2 Usage telemetry

`harness/telemetry/usage.py` reimplements `record_agent_usage`. Today's
bash invokes a Node snippet to write JSON; Python writes the same JSON
directly. Schema matches `harness/progress/server.mjs`'s consumer
expectations (`model`, `bucket`, `attempt`, `rc`, `status`, `reason`,
`started_ms`, `ended_ms`, `prompt_len`, `out_path`, plus the optional
`input_tokens` / `output_tokens` / `cost_usd` when the backend reports
them).

### 9.3 GPU uptime + token totals

`harness/progress/gpu-uptime.json` and `token-totals.json` are written by
the same telemetry module on every result, on the same cadence as today.

## 10. Bash → Python file mapping

| Bash file / function                                       | Python module / class                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `supervisor.sh`                                            | `harness/supervisor.py` (`Supervisor`)                         |
| `run_backlog.sh`                                           | `harness/pipelines/backlog.py` (`BacklogPipeline`)             |
| `run_ticket.sh`                                            | `harness/pipelines/ticket.py` (`TicketPipeline`)               |
| `run_subtask.sh`                                           | `harness/pipelines/subtask.py` (`SubTicketPipeline`)           |
| `lib.sh::run_qwen` / `run_impl`                            | `harness/agents/qwen.py` (`QwenAgent`)                         |
| `lib.sh::run_agent_model[_writable]`                       | `harness/agents/cursor.py` (`CursorAgent`)                     |
| `lib.sh::run_agy`                                          | `harness/agents/agy.py` (`AgyAgent`)                           |
| `lib.sh::run_claude`                                       | `harness/agents/claude.py` (`ClaudeAgent`)                     |
| `lib.sh::run_qwen_vision`                                  | `harness/agents/qwen.py` (`QwenVisionAgent`)                   |
| `lib.sh::_run_cli` (retry / timeout / classify)            | `harness/agents/_spawn.py`                                     |
| `lib.sh::has_verdict` / `is_pass`                          | `harness/prompts/verdict.py`                                   |
| `lib.sh::render_prompt`                                    | `harness/prompts/renderer.py`                                  |
| `lib.sh::cli_failure_reason` / `cli_output_is_only_error`  | `harness/agents/_spawn.py` (failure classifier)                |
| `lib.sh::commit_verified`                                  | `harness/git_helpers.py::commit_verified`                      |
| `lib.sh::start_game` / `stop_game` / `wait_for_game`       | `harness/steps/game.py`                                        |
| `lib.sh::write_qwen_vision_settings`                       | `harness/agents/qwen.py::QwenVisionAgent._write_settings`      |
| `lib.sh::qwen_extract_review_files` / `recover_review_files` | `harness/steps/review.py::RecoverReviewFilesStep`            |
| `lib.sh::emit_progress_event`                              | `harness/telemetry/progress.py::emit_progress_event`           |
| `lib.sh::record_agent_usage`                               | `harness/telemetry/usage.py::record_agent_usage`               |
| `lib.sh::verify_reviews`                                   | `harness/steps/review.py::VerifyReviewsStep`                   |
| `lib.sh::agent_model_for_label` / `review_agent_for_difficulty` | resolved by `Roster.load()` — no equivalent needed         |
| `run_subtask.sh` (handoff fallback synthesis L129-145)     | `harness/steps/handoff.py::EnsureHandoffStep`                  |
| `run_subtask.sh` (qwen-vision feedback L303-314)           | `harness/steps/vision_feedback.py::OptionalVisionFeedbackStep` |
| `run_ticket.sh` (decompose / sub dispatch / review)        | `harness/pipelines/ticket.py` (see §8.4 above)                 |
| `screenshot.mjs`                                           | unchanged — invoked as subprocess from `ScreenshotStep`        |
| `harness/progress/server.mjs`                              | unchanged                                                      |
| `harness/progress/public/*`                                | unchanged                                                      |
| `harness/githooks/*`                                       | unchanged                                                      |
| `harness/prompts/*.md`                                     | unchanged — read by the `prompts.renderer`                     |
| `harness/qwen_vision_smoke.sh`                             | `harness/cli.py::doctor_vision` subcommand                     |
| `harness/lint.sh`                                          | `harness/cli.py::lint` subcommand (still wraps shellcheck for as long as any bash exists in the tree) |
| `harness/tmp/runtime.env` (today's live-override file)     | `roles.local.yaml` (gitignored, same hot-reload story)         |
| `IMPL_MODEL` / `QA_MODEL` / `DECOMP_MODEL` env vars        | gone — `roles.local.yaml` replaces them all                    |

Net delta: 2,287 lines of bash → estimated ~2,500–3,000 lines of Python
across the modules above. The Python is longer because we get type
annotations, dataclasses, and tests; the surface area is smaller because
the cross-cutting concerns (retry, telemetry, scope-audit, verdict-parse)
are factored out instead of inlined per call.

## 11. Tests

### 11.1 Unit tests (fast, run on every change)

| Module                  | What's tested                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `agents/_spawn.py`      | Retry on empty stdout, retry on capacity-exhausted, hard timeout via fake subprocess fixture           |
| `agents/cursor.py`      | argv construction for writable vs read-only, model arg required                                        |
| `agents/qwen.py`        | argv construction with/without QWEN_MODEL, openai-logging flag wiring                                  |
| `agents/agy.py`         | NO `--model` flag is ever passed (regression test for the AgyAgent quirk)                              |
| `roles.py`              | Chain accepts on verdict + ok; chain skips on no-verdict; chain skips on tool-failure; YAML load round-trip |
| `prompts/verdict.py`    | `^VERDICT:\s*(PASS\|FAIL)` regex against real qa.txt fixtures                                          |
| `prompts/renderer.py`   | `__VAR__` substitution; absolute-path injection for `@file` references (agy fix)                       |
| `git_helpers.py`        | `commit_verified` stages only the scoped paths; HEAD-advancement assertion                             |
| `workspace/ports.py`    | Allocation, release, conflict detection                                                                |
| `pipelines/step.py`     | `SequenceStep` short-circuit on TOOL_FAILURE; `ParallelStep` joins state; `BranchStep` routing         |
| `telemetry/progress.py` | NDJSON append is line-atomic under concurrent writers (regression for parallel-workers step)           |

### 11.2 Integration tests (medium, run pre-PR)

| Scenario                                                                                  | Pipeline                                |
| ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Single sub-ticket happy path with a stub agent that always passes                         | `SubTicketPipeline` end-to-end          |
| Sub-ticket where implementer crashes once then succeeds                                   | retry loop + handoff synthesis          |
| Sub-ticket where primary QA fails, fallback QA succeeds                                   | `Role.execute` fallback chain           |
| Sub-ticket where all QA agents return no verdict                                          | tool-failure escalation                 |
| Ticket where decomposer returns zero sub-tickets (atomic ticket)                          | `TicketPipeline` no-decompose fallback  |
| Ticket round 1 fails review, round 2 passes review                                        | feedback accumulation                   |
| Supervisor: backlog returns rc=2, repair runs, restart succeeds                           | `Supervisor` escalation-decay           |
| Live-edit `roles.local.yaml` between sub-tickets                                          | hot-reload semantics                    |
| Implementer touches `harness/` despite ticket scope                                       | `GuardImplementerScopeStep` flags it    |
| QA agent (writable=False) emits a file-write block in chat (--mode ask trap)              | RecoverReviewFilesStep awk path         |
| Visual QA fails → qwen-vision feedback enriches the next iteration's prompt               | `OptionalVisionFeedbackStep`            |

Stub agents are subclasses of `Agent` with deterministic outputs — no real
CLIs spawn in integration tests, so the test suite is hermetic.

### 11.3 Smoke tests (slow, run pre-release)

One smoke test per real backend, gated by env var:
- `pytest -m smoke_qwen` — requires ollama + qwen3.6:27b-q8_0 loaded
- `pytest -m smoke_cursor` — requires `agent` CLI logged in
- `pytest -m smoke_agy` — requires antigravity CLI logged in
- `pytest -m smoke_claude` — requires `ANTHROPIC_API_KEY` and `claude` CLI

Each smoke test runs one real sub-ticket against a throwaway tickets/
fixture and asserts the agent produced a non-empty output. These are the
"does the CLI still exist and accept our argv" checks.

## 12. Migration plan

Big-bang per the user's choice, but staged within the single PR so the
review is human-sized:

### Phase 0 — preparation (no functional change)

1. Decide the tag we roll back to if the cutover fails. Today's HEAD
   `37e0fae` is a good candidate — last commit produced by the bash
   harness.
2. Add `python-rewrite-cutover` branch from `main`.
3. Mirror `harness/prompts/*` and `harness/progress/*` into the new layout
   (the rewrite doesn't touch them, but we want the file moves visible in
   the diff).
4. Land this design doc on `main`.

### Phase 1 — Python package skeleton

5. `poetry new harness`, `pyproject.toml` with `pydantic`, `anyio`,
   `httpx`, `typer`, `pytest`, `pytest-anyio`.
6. Empty modules per §4 with class skeletons and `...` bodies. CI green.

### Phase 2 — Agents (bottom of the stack first)

7. `_spawn.py` + tests. Includes the retry classifier ported from
   `cli_failure_reason`.
8. `QwenAgent`, `CursorAgent`, `AgyAgent`, `ClaudeAgent` + per-agent unit
   tests. Pure argv construction; no CLI is invoked.
9. Smoke tests for each agent against the real CLI. Gated by env var so
   CI doesn't need credentials.

### Phase 3 — Roles + Roster + verdict parsing

10. `roles.py`, `prompts/verdict.py`, `prompts/renderer.py` + tests.
11. `roles.yaml` and `roles.local.yaml.example` checked in.
12. Integration test: `Role.execute` with a stub-agent chain, four scenarios.

### Phase 4 — Workspace + steps + pipelines (single-worker)

13. `workspace/repo.py` — wraps the main repo. `workspace/ports.py` returns
    the fixed pair.
14. `git_helpers.py` ported (`commit_verified` is the meaty bit).
15. `steps/*.py` ported one-by-one. Each step has a unit test against a
    fake `StepContext`.
16. `pipelines/subtask.py` assembled. Integration test: one full
    SubTicketPipeline against stub agents.
17. `pipelines/ticket.py` assembled. Integration test: decompose → 2 subs
    → review → pass.
18. `pipelines/backlog.py` + `Supervisor`. Integration test: 1 ticket
    backlog, full success path.
19. `cli.py` subcommand router; `python -m harness supervisor` is now
    runnable end-to-end against stub agents.

### Phase 5 — Cutover

20. Run the existing bash harness on one ticket; record events.ndjson,
    git log, final tag.
21. Roll back the working tree; run the Python harness on the same ticket
    with the same `roles.yaml`; record the same outputs.
22. Diff: events.ndjson should differ only in timestamps; commit messages
    and code diffs should be identical for the deterministic-fallback path
    (implementer outputs will differ because the LLM is non-deterministic;
    this is expected).
23. If the equivalence test passes, delete `harness/*.sh`, update
    `tmux new-session` launch command in any operator docs.
24. Tag `v0-python-cutover`. PR review. Merge.

### Phase 6 — Parallel workers (separate PR, separate week)

25. `WorktreeWorkspace`, `PortAllocator` pool, dynamic-port flags in the
    game.
26. `BacklogPipeline.ForEachSubTicketStep(order="version")` becomes
    `ForEachSubTicketStep(concurrency=N, order="version")`.
27. Merge queue (`asyncio.Lock` + git operations).
28. Smoke run with N=2 workers on a 4-sub-ticket fixture ticket.

## 13. Open questions

1. **Python version.** Targeting 3.12 (uses `Self`, `Generic[T]` shorthand,
   improved error messages). Confirm we have 3.12 on the box; `python3
   --version` shows…  *(check before phase 1)*
2. **Async or sync?** Drafting in `async def` for I/O steps; CPU-only
   helpers stay sync. Subprocess via `asyncio.create_subprocess_exec`.
   Tests use `pytest-anyio` so we're not tied to asyncio specifically;
   trio is a future option if we want it.
3. **Single-process or per-pipeline?** Today every sub-ticket is a fresh
   `bash run_subtask.sh` — context isolation is free. Python could keep
   that pattern (`python -m harness subtask <dir>` per sub-ticket, spawned
   by the supervisor) or run everything in one process. **Recommendation:**
   per-sub-ticket subprocess for day 1 (cheap isolation, easy to reason
   about); single-process when parallel workers ship in phase 6 (cheaper,
   needed for shared port allocator and merge queue).
4. **Configuration of `_agents` aliases.** YAML anchors work but YAML
   anchor merging across files (`roles.local.yaml` overriding `_agents`)
   is fiddly. Alternatives: (a) require `roles.local.yaml` to re-declare
   any aliases it needs, (b) use Pydantic `model_validator` to flatten
   aliases before merging. **Recommendation:** (a) — local file is
   intended for one-off experiments; verbosity is fine there.
5. **Repair-agent scope.** Today's `claude -p
   --dangerously-skip-permissions` repair agent can touch anything. The
   YAML scope (`{ allow: ["harness/**"], deny: [...] }`) needs an audit
   step that runs after the repair and reverts out-of-scope edits.
   **Recommendation:** add `GuardScopeStep` after every Role.execute, not
   just the implementer. Out-of-scope edits get reverted and the role's
   result is downgraded to `rc=2 tool_failure`.
6. **Process-management strategy under tmux.** Today: tmux → bash
   supervisor → bash backlog → bash ticket → bash subtask → CLI. If
   per-sub-ticket subprocesses (Q3 recommendation) are kept, the Python
   layer looks the same. If we go single-process the tmux session
   directly owns one long-running Python; SIGINT handling needs to
   gracefully shut down active CLIs. **Recommendation:** keep tmux as the
   session manager; install a signal handler in `Supervisor` that drains
   active pipelines on SIGTERM.
7. **What about the harness's own pre-commit hooks (`harness/githooks/`)?**
   Stay unchanged. They're shell scripts that operate on commits and
   don't care which orchestrator made them.
8. **Backwards compatibility with `tickets/**/` layout.** Confirmed in §2
   non-goals: zero changes. Worth restating that the Python layer reads
   and writes the exact same files (`ticket.md`, `feedback.md`,
   `handoff.md`, `.passed`, `review.md`, `gaps.md`, `nits.md`,
   `review-feedback.md`, `log.txt`, `artifacts/iter-N/*`).
9. **Where does today's `harness/tmp/runtime.env` go?** Deleted — its job
   moves to `roles.local.yaml`. The bash `lib.sh:74-78` source block goes
   too.

## 14. Risks

| Risk                                                                | Mitigation                                                                                                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cutover regression — Python misses a subtle bash behavior           | Phase 5 step 22 (equivalence diff against the same ticket run twice). Roll back to `37e0fae` tag if it fails.                                                                           |
| `_run_cli`'s retry classifier has hard-won regex tweaks we drop     | Port the regex list verbatim into `_spawn.py` with a unit test fixture for each pattern (`cli_failure_reason` from `lib.sh` is the source of truth).                                    |
| Roles YAML schema drift between this doc and the implementation     | Pydantic model in `config.py` is the source of truth; this doc gets regenerated from the model (a tiny script in Phase 1 dumps the schema as YAML and asserts it matches the doc).      |
| Big-bang PR is too large to review                                  | Phase 1-4 land as separate PRs on the `python-rewrite-cutover` branch; only Phase 5 merges to main. Reviewers see ~5 PRs of ~500 lines each, plus the final cutover diff.                |
| Async subprocess semantics differ from bash's `timeout -k 30`       | `_spawn.py` uses `asyncio.wait_for` + `process.terminate()` + `wait(grace=30)` + `process.kill()`. Unit test verifies a hung subprocess is actually killed within grace+1 seconds.       |
| Repair-agent's broad write scope                                    | Q5 above — `GuardScopeStep` reverts out-of-scope edits. Plus: the repair role is the only one with `scope.allow = ["harness/**"]`; nothing else can touch harness.                      |
| Worktree-per-worker breaks the game's hard-coded ports              | Documented as a Phase 6 prerequisite (small game-side change to accept `--server-port` / `--vite-port`). Phase 5 cutover does NOT require this; worker count stays at 1 until Phase 6. |

## 15. What this design buys us, restated

- **Today's role experiments are one YAML edit.** The IMPL_MODEL /
  QA_MODEL / DECOMP_MODEL / QWEN_DISABLED conversation we just had becomes:
  "edit `roles.local.yaml`; reload at next sub-ticket spawn." No new bash
  knob per role per experiment.
- **Adding a new backend is one Python class.** When (not if) cursor adds
  composer-3 or a new vendor's CLI shows up, it's one `Agent` subclass and
  one YAML row to add it to the roster, with zero changes to the dispatch
  logic.
- **The QA-chain ladder stops being a regex of `elif`s in shell.** It's a
  list, in YAML, that anyone can read.
- **Parallel workers become a scheduling change, not an orchestration
  rewrite.** Phase 6 swaps `RepoWorkspace` for `WorktreeWorkspace` and
  adds concurrency to `ForEachSubTicketStep`. The pipeline itself
  doesn't change.
- **Tests, finally.** The bash harness has no unit tests; every change
  has to be validated by running real CLIs. Python lets us stub agents and
  test orchestration in milliseconds.
