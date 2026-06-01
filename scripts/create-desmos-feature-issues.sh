#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO="aelishRollo/Pretty-Calc"
repo_arg="${1:-}"
declare -a created_urls=()
declare -a skipped_titles=()

log() {
  echo "==> $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    die "GitHub CLI (gh) is not installed. Install from https://cli.github.com/ and rerun."
  fi
}

resolve_repo_from_git() {
  local remote
  remote="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote" ]]; then
    return 1
  fi

  # Supports:
  # - https://github.com/owner/repo(.git)
  # - git@github.com:owner/repo(.git)
  remote="${remote%.git}"
  remote="${remote#git@github.com:}"
  remote="${remote#https://github.com/}"
  remote="${remote#http://github.com/}"

  if [[ "$remote" == */* ]]; then
    echo "$remote"
    return 0
  fi
  return 1
}

resolve_repo() {
  if [[ -n "$repo_arg" ]]; then
    echo "$repo_arg"
    return 0
  fi

  if repo_from_git="$(resolve_repo_from_git)"; then
    echo "$repo_from_git"
    return 0
  fi

  echo "$DEFAULT_REPO"
}

ensure_auth() {
  if gh auth status -h github.com >/dev/null 2>&1; then
    return 0
  fi

  log "GitHub auth is missing/invalid; launching login flow..."
  gh auth login -h github.com --git-protocol https --web

  gh auth status -h github.com >/dev/null 2>&1 || die "Authentication did not complete. Please rerun after login."
}

issue_exists() {
  local repo="$1"
  local title="$2"
  gh issue list \
    --repo "$repo" \
    --search "in:title \"$title\"" \
    --state all \
    --limit 100 \
    --json title \
    --jq ".[] | select(.title == \"$title\") | .title" \
    | grep -Fqx "$title"
}

create_issue() {
  local repo="$1"
  local title="$2"
  local body="$3"
  if issue_exists "$repo" "$title"; then
    log "Skipping existing issue: $title"
    skipped_titles+=("$title")
    return 0
  fi

  local url
  url="$(gh issue create --repo "$repo" --title "$title" --body "$body")"
  created_urls+=("$url")
  log "Created: $url"
}

main() {
  require_gh
  ensure_auth
  local repo
  repo="$(resolve_repo)"
  log "Using repo: $repo"

create_issue "$repo" \
  "Implement core scientific calculator UX (multi-line expressions + keypad modes)" \
"## Goal
Implement the baseline Desmos-style scientific calculator interaction model in Pretty-Calc.

## Scope
- Multi-line expression list (not single-entry only)
- Reuse previous answer token (\`ans\`)
- Three keypad modes:
  - \`main\` (numbers/operators/roots/fractions/trig basics)
  - \`abc\` (qwerty-style symbols/text helpers)
  - \`func\` (advanced function entry)
- Decimal-to-fraction answer toggle (where rational approximation is available)
- Angle mode toggle (degrees/radians) in settings
- Calculator settings surface that can host future toggles

## Acceptance Criteria
- Users can enter and evaluate expressions across multiple lines.
- \`ans\` resolves to the previous evaluated result.
- Keypad mode switching is discoverable and preserves expression focus.
- Degree/radian mode changes affect trig evaluation correctly.
- Decimal/fraction representation can be toggled on supported outputs.
- Existing tests pass and new interaction tests are added for keypad mode + \`ans\` + angle mode."

create_issue "$repo" \
  "Add Scientific function set parity (trig, logs, combinatorics, stats basics, matrix ops)" \
"## Goal
Reach core function parity for the Desmos scientific function surface.

## Scope
- Arithmetic/number: absolute value, percent, fraction input, nth root, factorial, round
- Constants: \`pi\`, \`e\`
- Trig: \`sin\`, \`cos\`, \`tan\`, \`asin\`, \`acos\`, \`atan\`
- Logs: \`ln\`, \`log\`
- Combinatorics: \`nPr\`, \`nCr\`
- Statistics (basic): \`mean\`, \`stdev\`, \`stdevp\`
- Matrix-related entries used in scientific flow:
  - matrix template
  - \`rref\`, \`det\`, \`trace\`, inverse, square, transpose

## Acceptance Criteria
- Each listed function/operator has parser support and evaluator support.
- Helpful errors are returned for invalid domains and malformed inputs.
- Function docs/examples exist in-project.
- Unit tests cover happy path and key edge cases for each category."

create_issue "$repo" \
  "Implement Complex Mode (imaginary unit + complex functions)" \
"## Goal
Support a full Complex Mode comparable to Desmos scientific behavior.

## Scope
- Complex mode toggle in settings
- Add imaginary unit \`i\` to input affordances in complex mode
- In complex mode:
  - Force angle interpretation to radians
  - Enable complex helpers: \`real()\`, \`imag()\`, \`conj()\`, \`arg()\`, modulus via \`|z|\`
- Support complex arithmetic: add/subtract/multiply/divide

## Acceptance Criteria
- Toggling complex mode updates available keypad/functions immediately.
- \`real\`, \`imag\`, \`conj\`, \`arg\`, and modulus compute correctly.
- Complex arithmetic passes deterministic test vectors.
- Mode interactions with angle settings are clearly defined and tested."

create_issue "$repo" \
  "Support variables, function definitions, and list workflows" \
"## Goal
Enable advanced expression authoring beyond one-off calculations.

## Scope
- Variable assignment and reuse across lines
- Function definition and evaluation (e.g., \`f(x)=2x+3\`, \`f(5)\`)
- List support:
  - literal lists
  - range/ellipsis style generation
  - indexing/subsetting
  - list-driven statistical calculations
- Optional: testing-mode compatibility flag to disable function definitions later

## Acceptance Criteria
- Variable and function references resolve correctly across expression lines.
- Users can define and call single-argument functions reliably.
- List syntax works for evaluation and stats functions.
- Evaluation order and dependency updates are deterministic and tested."

create_issue "$repo" \
  "Implement keyboard shortcuts and accessibility baseline" \
"## Goal
Ship an accessibility-first interaction model inspired by Desmos scientific shortcuts and settings.

## Scope
- Keyboard navigation across expression lines and within math fields
- Common shortcut support (undo/redo, clear, angle toggle)
- Fraction/navigation shortcuts in structured math input
- Accessibility settings:
  - enlarged display mode
  - reverse contrast mode
  - braille mode scaffolding/hooks (UEB/Nemeth-ready architecture)
- Screen-reader-friendly math verbalization strategy (at minimum for focused expression and answer)

## Acceptance Criteria
- Core keyboard-only workflows can be completed without mouse.
- Reverse contrast and enlarged display can be toggled and persisted.
- Shortcut coverage is documented in-app.
- Accessibility smoke tests are added (manual checklist + automated where possible)."

create_issue "$repo" \
  "Plan advanced math-engine extension set (distributions/inference/calculus/number theory)" \
"## Goal
Create an incremental roadmap for higher-order math features documented in Desmos broader function sets.

## Scope
- Define phased implementation plan for:
  - probability distributions and sampling helpers
  - inference tests and result properties
  - calculus operators (\`exp\`, derivative, integral, sum, product)
  - extended number theory/hyperbolic trig functions
- Identify parser/evaluator architecture changes required for each phase
- Define performance and precision expectations per feature class

## Acceptance Criteria
- A written RFC/design doc is linked in this issue.
- Features are prioritized into milestones with clear dependencies.
- Each milestone has test strategy and rollback plan."

create_issue "$repo" \
  "Add platform compatibility + testing-mode profiles" \
"## Goal
Support configurable behavior profiles so the calculator can mimic standard vs testing constraints.

## Scope
- Add feature-flag profile system:
  - Standard profile (full Pretty-Calc scientific feature set)
  - Testing profile(s) with selective restrictions
- Initial testing-profile constraints to support:
  - disable function definitions
  - optionally force degree default
  - disable selected advanced functions/categories
- Document browser/platform support matrix and known limitations

## Acceptance Criteria
- Profile selection cleanly gates parser/UI features.
- Restricted features show clear UX messaging (not silent failures).
- Profile behavior is covered by regression tests.
- Documentation includes how to define new profiles."

  echo
  log "Done for repo: $repo"
  log "Created: ${#created_urls[@]}"
  if ((${#created_urls[@]} > 0)); then
    printf '%s\n' "${created_urls[@]}"
  fi
  log "Skipped existing: ${#skipped_titles[@]}"
}

main "$@"
