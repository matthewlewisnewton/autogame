"""Fast-bail: a decompose AGENT that errors immediately (down/quota) bails for
re-assignment instead of burning all rounds; a slow failure keeps re-decomposing."""
from __future__ import annotations

import types

from harness.pipelines.ticket import _decompose_fast_failed, _DECOMPOSE_FAST_FAIL_S


def _chain(*, ok: bool, duration_s: float):
    final = types.SimpleNamespace(ok=ok, duration_s=duration_s)
    return types.SimpleNamespace(final=final)


def test_fast_agent_error_bails():
    # cursor "unpaid invoice" fast-fail (~2.8s) → bail
    assert _decompose_fast_failed(_chain(ok=False, duration_s=2.8)) is True


def test_slow_failure_does_not_bail():
    # agent ran for real but produced no usable decomposition → content problem,
    # keep the normal re-decompose loop
    assert _decompose_fast_failed(_chain(ok=False, duration_s=120.0)) is False


def test_success_never_bails():
    assert _decompose_fast_failed(_chain(ok=True, duration_s=1.0)) is False


def test_threshold_boundary():
    assert _decompose_fast_failed(_chain(ok=False, duration_s=_DECOMPOSE_FAST_FAIL_S - 0.1)) is True
    assert _decompose_fast_failed(_chain(ok=False, duration_s=_DECOMPOSE_FAST_FAIL_S + 0.1)) is False
