---
description: "Review current git changes using Grok"
model: "opencode/grok-code-fast-1"
---
Review the current staged changes: !`git diff --cached`

Check for:
1. **Logic Flaws**: Any obvious bugs or edge cases missed.
2. **Boilerplate**: Suggest where @doc-writer should add comments.
3. **Security**: Ensure no secrets or hardcoded keys are present.

If everything looks good, respond with "LGTM 🚀". Otherwise, list improvements for @deep-coder.