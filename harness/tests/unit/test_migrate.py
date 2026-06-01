"""migrate_open_tickets: TASKS.md → beads with difficulty labels + dep edges."""
from __future__ import annotations

from pathlib import Path

from harness.dispatch.migrate import migrate_open_tickets, open_ticket_names, ticket_meta


class FakeQueue:
    def __init__(self):
        self.created = {}   # name -> difficulty
        self.deps = []      # (blocked_bead, blocker_bead)

    def create(self, title, *, difficulty=None, priority=None):
        self.created[title] = difficulty
        return f"bead-{title}"

    def add_dep(self, blocked, blocker):
        self.deps.append((blocked, blocker))


def _repo(tmp_path: Path) -> Path:
    (tmp_path / "TASKS.md").write_text(
        "# Tasks\n"
        "- [x] [done-1](tickets/done-1/)\n"
        "- [ ] [a-easy](tickets/a-easy/)\n"
        "- [ ] [b-medium](tickets/b-medium/)\n"
        "- [ ] [c-epic](tickets/c-epic/)\n"
        "- [ ] [d-dep](tickets/d-dep/)\n"
    )
    def t(name, body):
        d = tmp_path / "tickets" / name
        d.mkdir(parents=True)
        (d / "ticket.md").write_text(body)
    t("a-easy", "# A\n## Difficulty: easy\n")
    t("b-medium", "# B\n")  # no difficulty → default medium
    t("c-epic", "# C epic\n## Type: epic\n## Difficulty: hard\n")
    t("d-dep", "# D\n## Difficulty: hard\n## Depends on: a-easy, c-epic, ghost\n")
    return tmp_path


def test_open_ticket_names_skips_checked(tmp_path):
    _repo(tmp_path)
    assert open_ticket_names(tmp_path / "TASKS.md") == ["a-easy", "b-medium", "c-epic", "d-dep"]


def test_ticket_meta_parsing(tmp_path):
    _repo(tmp_path)
    assert ticket_meta(tmp_path / "tickets/a-easy/ticket.md") == ("easy", False, [])
    assert ticket_meta(tmp_path / "tickets/b-medium/ticket.md") == ("medium", False, [])
    assert ticket_meta(tmp_path / "tickets/c-epic/ticket.md")[1] is True   # is_epic
    diff, epic, deps = ticket_meta(tmp_path / "tickets/d-dep/ticket.md")
    assert (diff, epic) == ("hard", False)
    assert deps == ["a-easy", "c-epic", "ghost"]


def test_migrate_creates_and_wires(tmp_path):
    _repo(tmp_path)
    q = FakeQueue()
    created = migrate_open_tickets(tmp_path, q)
    # epic skipped; checked ticket not open
    assert set(created) == {"a-easy", "b-medium", "d-dep"}
    assert q.created == {"a-easy": "easy", "b-medium": "medium", "d-dep": "hard"}
    # only the dep to a created, non-epic ticket is wired (c-epic + ghost skipped)
    assert q.deps == [("bead-d-dep", "bead-a-easy")]
