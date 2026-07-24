# Objectives shell achievement host

## Summary

Moved Objectives ownership into the recovered app shell and added one persistent achievement
popup host. Main Menu, Mode Select, and Objectives now share a fresh shell manager while
gameplay keeps its independent manager.

## Implementation behavior

- The shell creates the Objectives manager once from the shared Settings runtime.
- The achievement host survives foreground swaps and presents shell-owned popups above the
  active foreground.
- Popup delivery preserves native ordering: effects gate, cheer, presenter creation, then
  attachment.
- Cheer, creation, attachment, update, retirement, and teardown failures stay contained.
  Failed popup construction rolls back owned presenter and node state and emits one diagnostic.
- Completed popup presentations retire through the presenter completion contract after the
  native `7.5s` lifecycle.
- Shell teardown releases every active achievement presentation and its ownership nodes.
- Fatal Objectives ownership failures release input and scene ownership, dispose the poisoned
  presenter, and recover to a fresh Main Menu. Failed recovery leaves the shell explicitly
  failed and emits one transition diagnostic with the original error.

## Validation

- Achievement host unit tests: `6/6`.
- Focused Objectives presenter, menu, mode-select, host, and shell tests: `168/168`.
- Host + Objectives screen + shell + integration rerun: `121/121`.
- Creator resource metadata validation: `9/9`.
- Creator 3.8.8 bundled strict TypeScript: zero diagnostics.
- `git diff --check`: clean.

## Documentation impact

No general documentation update required; this report records the internal ownership and
failure-recovery change.

## Unresolved questions

None.

## Status

Status: DONE
