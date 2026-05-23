"""Role, ChainResult, TierResult, Roster.

Per design doc §6.2 — Role.execute owns scope_audit per-tier. The tier
loop:
  1. If agent.writable: snapshot head_before + untracked_before.
  2. agent.run(invocation, workspace, telemetry).
  3. If agent.writable: scope_audit. On had_violations: downgrade tier's
     AgentResult.reason to SCOPE_VIOLATION (via dataclasses.replace);
     record TierResult(accepted=False, scope_audit=audit); next tier.
  4. acceptance.accepts(result, workspace, artifacts_dir). True → return
     ChainResult; False → record TierResult(accepted=False, reason="no_acceptance");
     next tier.
  5. Chain exhausted → ChainResult(accepted_by=None).
"""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Optional, Union

from harness.agents.base import (
    Agent,
    AgentInvocation,
    AgentResult,
    FailureReason,
    Prompt,
    UsageKind,
)
from harness.config.schema import RoleSpec
from harness.config.tunables import Tunables, set_active as set_active_tunables
from harness.git_helpers import PathScope, ScopeAuditResult, scope_audit, snapshot_untracked
from harness.prompts.acceptance import AcceptanceCriterion, build_from_yaml
from harness.prompts.renderer import render_prompt

if TYPE_CHECKING:
    pass  # forward refs are resolved lazily — workspace + telemetry stay Any-ish


@dataclass
class Role:
    """One role configuration. Phase 4's pipelines call .execute()."""
    name: str
    primary: Agent
    fallbacks: list[Agent]
    timeout_s: float
    prompt_template: Path
    acceptance: AcceptanceCriterion
    out_file: str
    usage_kind: UsageKind
    scope: PathScope

    def execute(
        self,
        workspace,
        prompt_vars: dict,
        artifacts_dir: Path,
        *,
        telemetry=None,
        extra_safe_paths: "list[str] | None" = None,
    ) -> "ChainResult":
        """Run the primary, then each fallback in order. See module docstring
        for the per-tier sequence.

        `extra_safe_paths` (v5.1 hotfix): caller-supplied paths the role's
        prompt explicitly directs the agent to write to OUTSIDE the
        artifacts dir (e.g. implementer writes handoff.md in the sub-ticket
        root; decomposer writes sub-ticket folders under subtickets/;
        split() writes new tickets under tickets/). These get unioned with
        the auto-derived `artifacts_dir/**` safe path and passed to
        scope_audit as the safe-list — the rule there overrides deny so
        the harness's own writes don't false-trip the audit.
        """
        artifacts_dir = Path(artifacts_dir)
        out_path = artifacts_dir / self.out_file

        # Render the prompt body once; same body goes to every tier.
        prompt_body = render_prompt(self.prompt_template, **prompt_vars)
        prompt = Prompt(body=prompt_body, template=self.prompt_template)

        invocation = AgentInvocation(
            prompt=prompt,
            timeout_s=self.timeout_s,
            out_file=out_path,
            usage_kind=self.usage_kind,
        )

        # Build the harness-internal safe-paths list. artifacts_dir is
        # always safe (it's the role's own bookkeeping). Caller may add
        # role-specific extras (handoff.md, subtickets dir, etc.).
        try:
            arti_rel = artifacts_dir.resolve().relative_to(
                Path(workspace.root).resolve())
            safe_paths = [f"{arti_rel}/**"]
        except (ValueError, AttributeError):
            safe_paths = []
        if extra_safe_paths:
            safe_paths.extend(extra_safe_paths)

        # A role with empty `allow` cannot legitimately produce ANY in-scope
        # write (everything falls through to implicit-deny). Running
        # scope_audit on such a role is not just wasteful — it's actively
        # dangerous, because `diff_since(head_before)` returns ALL
        # uncommitted state, including work left in the tree by the PRIOR
        # step (typically the implementer). scope_audit would then revert
        # the implementer's uncommitted code and the QA judge would see an
        # empty diff and FAIL the iteration. Bug discovered Phase 5 cutover
        # day on ticket 055 — every iter wrote correct code, every QA call
        # silently wiped it. Per design doc §7.4: scope_audit is for
        # *writable role* tiers only; a `deny:["**"]` role like qa:* is
        # read-only by config and must skip the audit even when the agent
        # implementation happens to be writable=True.
        role_can_write = bool(self.scope.allow)

        tiers: list[TierResult] = []
        for agent in [self.primary, *self.fallbacks]:
            # Snapshot before write — only for writable agents (read-only
            # roles have nothing to audit and skip the snapshot cost).
            audit: Optional[ScopeAuditResult] = None
            head_before: Optional[str] = None
            untracked_before: set = set()
            should_audit = role_can_write and getattr(agent, "writable", False)
            if should_audit:
                try:
                    head_before = workspace.head()
                except Exception:
                    head_before = None
                untracked_before = snapshot_untracked(workspace)

            result = agent.run(invocation, workspace, telemetry=telemetry)

            if should_audit and head_before is not None:
                audit = scope_audit(workspace, head_before, untracked_before,
                                    self.scope, safe_paths=safe_paths)
                if audit.had_violations:
                    # Downgrade tier — AgentResult is a @dataclass, so use
                    # dataclasses.replace (NOT result._replace which is
                    # NamedTuple-only). The scope_audit() call already
                    # reverted the files in-line per §7.4.
                    result = dataclasses.replace(result, reason=FailureReason.SCOPE_VIOLATION,
                                                 rc=2)
                    tiers.append(TierResult(
                        agent=agent, result=result, accepted=False,
                        reason_for_skip=FailureReason.SCOPE_VIOLATION,
                        scope_audit=audit,
                    ))
                    continue

            # Acceptance check (may run recovery internally — see ReviewAccept).
            if result.ok and self.acceptance.accepts(result, workspace, artifacts_dir):
                tiers.append(TierResult(
                    agent=agent, result=result, accepted=True,
                    reason_for_skip=None, scope_audit=audit,
                ))
                return ChainResult(tiers=tiers, accepted_by=agent)

            # Tier rejected. Record reason for telemetry / diagnosis.
            reason_for_skip: Union[FailureReason, str]
            if not result.ok:
                reason_for_skip = result.reason
            else:
                reason_for_skip = "no_acceptance"
            tiers.append(TierResult(
                agent=agent, result=result, accepted=False,
                reason_for_skip=reason_for_skip, scope_audit=audit,
            ))

        return ChainResult(tiers=tiers, accepted_by=None)


@dataclass
class TierResult:
    agent: Agent
    result: AgentResult
    accepted: bool
    # FailureReason if the agent itself failed (incl. SCOPE_VIOLATION); the
    # literal string "no_acceptance" if the agent succeeded but the
    # acceptance criterion rejected; None on accepted tier.
    reason_for_skip: Union[FailureReason, str, None]
    # Populated for writable agent tiers; None for read-only.
    scope_audit: Optional[ScopeAuditResult]


@dataclass
class ChainResult:
    tiers: list[TierResult]
    # The Agent whose tier accepted, or None if all tiers exhausted.
    accepted_by: Optional[Agent]

    @property
    def final(self) -> AgentResult:
        """Last AgentResult in the chain. Raises if no tiers ran (defensive
        — Role.execute always runs at least the primary tier)."""
        return self.tiers[-1].result


# --- Roster --------------------------------------------------------------- #

@dataclass
class Roster:
    """Loaded roles + tunables. Constructed by Supervisor at startup /
    SIGHUP and passed by reference into ticket/subtask pipelines.

    Hot-reload boundary: NOT per-pipeline. The Supervisor's SIGHUP
    handler swaps self.roster atomically; in-flight pipelines keep
    their original reference. See §6.5.
    """
    tunables: Tunables
    agents: dict[str, Agent]                       # by name
    _role_specs: dict[str, RoleSpec]               # raw specs; Role objects built lazily for difficulty selection
    _role_defaults: dict[str, dict]                # the _role_defaults: block (per family)
    base_path: Path                                # roles.yaml path, for re-load via reload()
    local_path: Optional[Path]                     # roles.local.yaml path, may not exist

    @classmethod
    def load(cls, base_path: Path | str, local_path: Optional[Path | str] = None) -> "Roster":
        """Load roles.yaml (+ optional roles.local.yaml), set active
        tunables, return an immutable-ish Roster.

        Phase 4 wires this into Supervisor's SIGHUP handler.
        """
        from harness.config.loader import _build_agent, load_roster_files

        base_path = Path(base_path)
        local_path = Path(local_path) if local_path is not None else None
        rf = load_roster_files(base_path, local_path)

        # Build named agents.
        agents = {name: _build_agent(name, spec) for name, spec in rf.agents.items()}

        # Validate referenced names — every role's primary / fallback agent
        # name must exist in the agents: map. Fail at load, not at runtime.
        for role_name, role_spec in rf.roles.items():
            _validate_role_refs(role_name, role_spec, agents)

        set_active_tunables(rf.tunables)

        return cls(
            tunables=rf.tunables,
            agents=agents,
            _role_specs=dict(rf.roles),
            _role_defaults=dict(rf.role_defaults),
            base_path=base_path,
            local_path=local_path,
        )

    def reload(self) -> "Roster":
        """Re-load from disk; useful for SIGHUP. Returns a new Roster
        (callers swap self.roster = roster.reload() atomically)."""
        return Roster.load(self.base_path, self.local_path)

    def role(self, name: str, *, difficulty: Optional[str] = None) -> Role:
        """Materialize a Role object from the named RoleSpec, applying
        _role_defaults via family inheritance + per-difficulty primary
        selection if applicable.

        For roles like 'review' that use primary_by_difficulty, pass
        difficulty=...; for simple roles, leave it None.

        v5.1 hotfix: _role_defaults application. Pre-v5.1 the family
        defaults dict was looked up via _family_defaults() and then
        DROPPED — every role in roles.yaml had to restate every field
        verbatim. This version merges family defaults UNDER the role's
        own fields (role wins on overlap) before constructing the Role.
        """
        spec = self._role_specs.get(name)
        if spec is None:
            raise KeyError(f"No role {name!r} in roster (available: {sorted(self._role_specs)})")

        # Family defaults — apply UNDER the role's own values.
        defaults = self._family_defaults(name)
        if defaults:
            # Pydantic dump → defaults overlay → pydantic re-validate.
            role_dict = spec.model_dump(exclude_unset=True)
            merged: dict = {}
            for key, dval in defaults.items():
                if key not in role_dict:
                    merged[key] = dval
            merged.update(role_dict)
            spec = type(spec).model_validate(merged)

        # Build the Role's concrete agent refs.
        if spec.primary is not None:
            primary = self.agents[spec.primary]
        elif spec.primary_by_difficulty and difficulty:
            primary_name = spec.primary_by_difficulty.get(difficulty)
            if not primary_name:
                raise KeyError(f"Role {name!r} has no primary for difficulty {difficulty!r}")
            primary = self.agents[primary_name]
        else:
            raise ValueError(f"Role {name!r} has neither primary nor primary_by_difficulty")

        # Per-difficulty fallback override, if any. Otherwise use the shared
        # fallbacks list.
        if difficulty and spec.fallbacks_by_difficulty:
            fb_names = spec.fallbacks_by_difficulty.get(difficulty, spec.fallbacks)
        else:
            fb_names = spec.fallbacks
        fallbacks = [self.agents[fbn] for fbn in fb_names]

        # Acceptance + scope from spec (with defaults overlay).
        from harness.prompts.acceptance import build_from_yaml as build_acceptance
        acc_spec_dict = spec.acceptance.model_dump()
        acceptance = build_acceptance(acc_spec_dict)
        scope = PathScope(allow=spec.scope.allow, deny=spec.scope.deny)

        try:
            usage_kind = UsageKind(spec.usage_kind)
        except ValueError as e:
            raise ValueError(f"Role {name!r}: unknown usage_kind {spec.usage_kind!r}") from e

        return Role(
            name=name,
            primary=primary,
            fallbacks=fallbacks,
            timeout_s=float(spec.timeout_s),
            prompt_template=Path(spec.prompt_template),
            acceptance=acceptance,
            out_file=spec.out_file,
            usage_kind=usage_kind,
            scope=scope,
        )

    def _family_defaults(self, role_name: str) -> dict:
        """Per-family defaults from _role_defaults. Phase 3 keeps this a
        simple lookup-by-exact-name; Phase 4 may extend if we need
        prefix-matching ("qa:code" → "qa")."""
        return self._role_defaults.get(role_name.split(":")[0], {})


def _validate_role_refs(role_name: str, spec: RoleSpec, agents: dict[str, Agent]) -> None:
    """Fail-fast on roles that reference an unknown agent name."""
    missing: list[str] = []
    if spec.primary is not None and spec.primary not in agents:
        missing.append(spec.primary)
    if spec.primary_by_difficulty:
        for diff, agent_name in spec.primary_by_difficulty.items():
            if agent_name not in agents:
                missing.append(f"{agent_name} (primary_by_difficulty.{diff})")
    for fb in spec.fallbacks:
        if fb not in agents:
            missing.append(fb)
    if spec.fallbacks_by_difficulty:
        for diff, fb_list in spec.fallbacks_by_difficulty.items():
            for fb in fb_list:
                if fb not in agents:
                    missing.append(f"{fb} (fallbacks_by_difficulty.{diff})")
    if missing:
        raise ValueError(
            f"Role {role_name!r} references unknown agents: {missing}. "
            f"Add them under `agents:` in roles.yaml or roles.local.yaml."
        )


__all__ = ["ChainResult", "Role", "Roster", "TierResult"]
