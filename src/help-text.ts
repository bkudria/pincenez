export const HELP_TEXT = `
Checks File Schema (YAML):
  Only 'checks' is required. All other fields are optional.

    # --- Context (optional) ---
    context: |                              # What task produced this output
      The agent was asked to write a haiku
      about the ocean and save it to ocean.txt

    # --- Checks ---
    checks:
      - file-created:                       # ID as key (required)
          check: "ocean.txt was created"    # Binary claim to evaluate (required)
          note: "Look for Write tool usage" # Grading hint (optional)
          model: claude-sonnet-4-6          # Model override (optional)

  Field Reference:
    context             What task produced this output. Orients the judge.
    checks[].{id}       Map key is the unique check identifier.
    checks[].check      The statement to evaluate. Objective, verifiable claim.
    checks[].note       Grading hint. Improves human-judge alignment significantly.
    checks[].model      Model override. Overrides --model and the default.

Output Format:
  Grading YAML is streamed to stdout as checks complete (arrival order):

    checks:
      - id: file-created
        check: "ocean.txt was created"
        pass: true
        evidence: "The agent used Write to create ocean.txt"
    pass_rate: 1

  pass_rate is written after all checks finish.

Examples:
  # Grade a file against a checks file
  pincenez checks.yaml output.md

  # Pipe from stdin (e.g. scuttlerun output)
  scuttlerun session.yaml | pincenez checks.yaml

  # Use a stronger model for all checks
  pincenez checks.yaml output.md --model claude-sonnet-4-6

  # CI quality gate with yq
  pincenez checks.yaml output.md | yq -e '.pass_rate == 1.0'

  # Save results to file
  pincenez checks.yaml output.md > grading.yaml

  # Lint checks for quality anti-patterns
  pincenez lint checks.yaml

Exit Codes:
  0   Ran successfully (regardless of check results)
  1   Checks file error (invalid YAML, missing fields)
  2   Runtime error (API failure, etc.)`;
