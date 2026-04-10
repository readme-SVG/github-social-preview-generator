"""Create GitHub issues and PR comments from AI-generated change analysis.
https://github.com/assembly-automation-hub/repo-governance

This module runs inside GitHub Actions and inspects either push or pull request
events. It gathers the relevant diff, sends the change summary to a hosted model,
and uses the structured JSON response to open a GitHub issue and optionally post
a pull request comment.

The entry-point is the module itself — there are no classes. Execution proceeds
top-to-bottom: environment variables are read, the diff is collected, a
role-specific prompt is assembled based on the event's trigger labels, the
hosted model is called, and finally a GitHub issue (and optional PR comment)
is created.

Attributes:
    gh_token (str | None): GitHub personal access token sourced from the
        ``GITHUB_TOKEN`` environment variable. Used to authenticate all
        PyGithub API calls.
    model_token (str | None): Bearer token for the Azure-hosted model endpoint,
        sourced from the ``GH_MODELS_TOKEN`` environment variable.
    repo_name (str | None): The ``owner/repo`` identifier of the target
        repository, sourced from the ``REPOSITORY`` environment variable.
    event_name (str | None): The GitHub Actions event that triggered this
        workflow run (``"push"`` or ``"pull_request"``), sourced from the
        ``EVENT_NAME`` environment variable.
    allowed_users (list[str]): Lowercase login names of GitHub users whose
        events are eligible for analysis. Parsed from the comma-separated
        ``ALLOWED_USER`` environment variable.
    MODEL_NAME (str): The model identifier used in every inference request.
    ENDPOINT (str): The Azure inference API URL for chat completions.
    diff_text (str): Accumulated file-patch text collected from the triggering
        commit or pull request. Capped at 10 000 characters for push events and
        80 000 characters for pull-request events to stay within model limits.
    event_context (str): A short human-readable description of the event (e.g.
        commit message or PR title/body) prepended to every model prompt.
    author_login (str): Lowercase GitHub login of the commit author or PR
        author used for allow-list enforcement.
    trigger_labels (list[str]): Lowercase label strings extracted from the
        commit message brackets ``[label]`` or from the PR's applied labels.
        Drive prompt-role selection later in the module.
    dedup_key (str): A stable identifier (e.g. ``"PR #42"`` or
        ``"commit:a1b2c3d"``) embedded in every generated issue body so that
        duplicate issues can be detected on subsequent runs.
    pr_ref (github.PullRequest.PullRequest | None): A live PyGithub pull
        request object retained for posting the summary comment, or ``None``
        when the triggering event is a push.
"""

import os
import json
import re
import time
import requests
from github import Github, Auth

# ---------------------------------------------------------------------------
# Environment — read once at module level so all functions share the values.
# ---------------------------------------------------------------------------
gh_token = os.environ.get("GITHUB_TOKEN")
model_token = os.environ.get("GH_MODELS_TOKEN")
repo_name = os.environ.get("REPOSITORY")
event_name = os.environ.get("EVENT_NAME")
allowed_users = [u.strip().lower() for u in os.environ.get("ALLOWED_USER", "").split(",")]

MODEL_NAME = "Llama-3.3-70B-Instruct"
ENDPOINT = "https://models.inference.ai.azure.com/chat/completions"

# Authenticate once; the ``repo`` object is reused throughout.
auth = Auth.Token(gh_token)
gh = Github(auth=auth)
repo = gh.get_repo(repo_name)

# ---------------------------------------------------------------------------
# Mutable state populated by the event-routing block below.
# ---------------------------------------------------------------------------
diff_text = ""
event_context = ""
author_login = ""
trigger_labels = []
dedup_key = ""
pr_ref = None
changed_files = []

# ---------------------------------------------------------------------------
# Event routing — collect the diff and metadata for push vs pull_request.
# ---------------------------------------------------------------------------
if event_name == "push":
    commit_sha = os.environ.get("COMMIT_SHA")
    commit = repo.get_commit(commit_sha)

    if len(commit.parents) > 1:
        exit(0)
    if not commit.author:
        exit(0)

    author_login = commit.author.login.strip().lower()
    if author_login not in allowed_users:
        exit(0)

    pr_match = re.search(r'\(#(\d+)\)', commit.commit.message)
    if pr_match:
        dedup_key = f"PR #{pr_match.group(1)}"
    else:
        dedup_key = f"commit:{commit_sha[:7]}"

    event_context = f"Commit Message: {commit.commit.message}"
    trigger_labels = [m.lower() for m in re.findall(r'\[(.*?)\]', commit.commit.message)]

    for file in commit.files:
        changed_files.append(file.filename)
        diff_text += f"File: {file.filename}\nPatch:\n{file.patch}\n\n"
        if len(diff_text) > 10000:
            diff_text += "\n[Diff truncated...]"
            break

elif event_name == "pull_request":
    pr_number = int(os.environ.get("PR_NUMBER"))
    pr = repo.get_pull(pr_number)
    author_login = pr.user.login.strip().lower()
    if author_login not in allowed_users:
        exit(0)

    pr_ref = pr
    dedup_key = f"PR #{pr_number}"
    event_context = f"PR Title: {pr.title}\nPR Body: {pr.body}"
    trigger_labels = [label.name.lower() for label in pr.labels]

    for file in pr.get_files():
        changed_files.append(file.filename)
        diff_text += f"File: {file.filename}\nPatch:\n{file.patch}\n\n"
        if len(diff_text) > 80000:
            diff_text += "\n[Diff truncated...]"
            break
else:
    exit(0)

if len(diff_text.strip()) < 50:
    print("Diff too small to analyze. Skipping.")
    exit(0)

for issue in repo.get_issues(state="all"):
    if dedup_key in (issue.body or ""):
        print(f"Issue for {dedup_key} already exists (#{issue.number}), skipping.")
        exit(0)


def was_already_closed(title_keyword: str) -> bool:
    """Return whether a similar issue title already exists in closed issues."""
    for issue in repo.get_issues(state="closed"):
        if title_keyword.lower() in (issue.title or "").lower():
            print(f"Similar closed issue found: #{issue.number} — skipping.")
            return True
    return False


def build_permalink(filename: str, line: int = 1) -> str:
    """Build a GitHub blob permalink for a file and line number."""
    sha = os.environ.get("COMMIT_SHA") or ""
    if not sha and pr_ref:
        sha = pr_ref.head.sha
    return f"https://github.com/{repo_name}/blob/{sha}/{filename}#L{line}"


# ---------------------------------------------------------------------------
# Auto-detection of change type from file paths and diff content.
# Used when no explicit labels are provided in commit message or PR.
# ---------------------------------------------------------------------------
def detect_change_type(files: list, diff: str, context: str) -> str:
    """Determine the analysis role based on changed file paths and diff content.

    Inspects the list of changed files and diff text to infer what kind of
    review is most appropriate. Returns a role key that maps to a specific
    prompt persona.

    Args:
        files: List of changed file paths.
        diff: The accumulated diff text.
        context: Commit message or PR title/body.

    Returns:
        A string role key: "security", "deps", "ci", "docs", "frontend",
        "backend", "config", or "general".
    """
    files_lower = [f.lower() for f in files]
    diff_lower = diff.lower()

    has_security_keywords = any(kw in diff_lower for kw in [
        "secret", "token", "password", "api_key", "apikey", "auth",
        "credential", "private_key", "access_key", "bearer",
        "vulnerability", "cve-", "injection", "xss", "csrf",
    ])
    has_security_files = any(f for f in files_lower if any(kw in f for kw in [
        "security", "auth", ".env", "secret",
    ]))
    if has_security_keywords or has_security_files:
        return "security"

    has_dep_files = any(f for f in files_lower if any(kw in f for kw in [
        "requirements", "package.json", "package-lock", "pipfile",
        "poetry.lock", "cargo.toml", "go.sum", "gemfile",
        "dependabot", "renovate",
    ]))
    if has_dep_files:
        return "deps"

    has_ci_files = any(f for f in files_lower if any(kw in f for kw in [
        ".github/workflows/", "jenkinsfile", ".gitlab-ci",
        ".circleci", "dockerfile", "docker-compose",
        ".github/actions/",
    ]))
    if has_ci_files:
        return "ci"

    has_doc_files = all(
        any(kw in f for kw in [
            "readme", "contributing", "changelog", "license",
            "docs/", "doc/", ".md", ".rst", ".txt",
        ])
        for f in files_lower
    )
    if has_doc_files and files_lower:
        return "docs"

    has_frontend_files = any(f for f in files_lower if any(kw in f for kw in [
        ".html", ".css", ".jsx", ".tsx", ".vue", ".svelte",
        "frontend/", "public/", "static/", "assets/",
    ]))
    has_frontend_keywords = any(kw in diff_lower for kw in [
        "classname", "style=", "onclick", "addeventlistener",
        "document.get", "innerhtml", "appendchild",
    ])
    if has_frontend_files or has_frontend_keywords:
        return "frontend"

    has_backend_files = any(f for f in files_lower if any(kw in f for kw in [
        ".py", ".go", ".java", ".rb", ".rs", ".php",
        "api/", "server/", "backend/", "lib/", "src/",
    ]))
    if has_backend_files:
        return "backend"

    has_config_files = any(f for f in files_lower if any(kw in f for kw in [
        ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf",
        ".json", ".env",
    ]))
    if has_config_files:
        return "config"

    return "general"


# ---------------------------------------------------------------------------
# Severity guidance shared across all prompt roles.
# ---------------------------------------------------------------------------
severity_guide = """
Use the following severity scale. You have 7 levels — pick the one that best matches the ACTUAL impact:

CRITICAL — Production-breaking changes, security vulnerabilities (exposed secrets, SQL injection, XSS, CSRF, broken auth), data loss risks, or changes that could cause service outages.

HIGH — Significant logic changes affecting core functionality, new or modified API endpoints, permission and access control modifications, database schema changes, removal of important functionality, breaking changes to public interfaces.

ELEVATED — New substantial features or modules, large-scale refactors that change behavior across multiple files, integration with external services or APIs, changes to error handling or retry logic, modifications to data processing pipelines.

MEDIUM — New utility functions or helpers, workflow and CI/CD pipeline changes, configuration changes that affect runtime behavior, dependency version updates, adding new files with meaningful functionality, structural reorganization of existing code.

MODERATE — Minor feature additions, small behavioral changes, adding validation or input checks, improving logging or error messages, updating environment variables or build settings, adding new labels or issue templates.

LOW — Documentation updates (README, CONTRIBUTING, comments), cosmetic UI changes without behavior impact, code formatting or style fixes, renaming without behavior change, adding badges or metadata, updating .gitignore or editor configs.

INFORMATIONAL — Trivial changes: fixing typos, whitespace adjustments, comment rewording, version bumps in non-critical files, adding blank lines.

IMPORTANT: Do NOT default to LOW or INFORMATIONAL. Carefully evaluate the actual scope and impact. Most code changes that add or modify functionality should be MEDIUM or higher. Use the full range of the scale.
"""

# ---------------------------------------------------------------------------
# Structured output contract sent to the model.
# ---------------------------------------------------------------------------
base_instructions = """
Return only a raw JSON object with no markdown formatting. The JSON must have these exact keys:

"issue_title": string — include severity prefix like [CRITICAL], [HIGH], [ELEVATED], [MEDIUM], [MODERATE], [LOW], or [INFO] at the start,
"severity": string — one of: critical, high, elevated, medium, moderate, low, informational,
"issue_body": string — must include these sections:
  ## Problem
  (clear description with exact file paths and line numbers if known)

  ## Code Reference
  (the exact problematic code snippet or the key changed code)

  ## Suggested Fix
  (concrete code or steps to fix — or "No action required" for informational changes)

  ## Permalink
  (placeholder: PUT_PERMALINK_HERE — will be replaced automatically)

"labels": list of strings — standard GitHub labels plus the severity level,
"affected_file": string — the most relevant filename from the diff (or "" if unknown),
"affected_line": integer — approximate line number of the issue (or 1 if unknown),
"summary": string — 2-3 sentence plain-English summary for the PR comment

The issue_title, issue_body and summary MUST be written entirely in English.
"""

# ---------------------------------------------------------------------------
# Prompt role definitions — keyed by label match or auto-detected type.
# ---------------------------------------------------------------------------
PROMPT_ROLES = {
    "security": (
        "Act as a Strict Security Auditor. Perform a deep security audit "
        "(OWASP Top 10, CWE patterns). Find real vulnerabilities with exact "
        "file/line references. Check for exposed secrets, injection vectors, "
        "broken auth, insecure deserialization, and misconfigurations."
    ),
    "review": (
        "Act as a Strict Code Reviewer. Analyze code quality using SOLID, DRY, "
        "and KISS principles. Point to exact lines that violate these principles. "
        "Evaluate naming, error handling, and separation of concerns."
    ),
    "qa": (
        "Act as a QA Engineer. Identify edge cases, missing test coverage, "
        "untested error paths, and potential regressions. Reference exact "
        "functions and lines that need tests."
    ),
    "perf": (
        "Act as a Performance Expert. Analyze algorithmic complexity, identify "
        "O(n²) patterns, unnecessary allocations, N+1 queries, blocking I/O, "
        "and missed caching opportunities. Reference exact lines."
    ),
    "pm": (
        "Act as a Product Manager. Generate user-facing Release Notes with "
        "clear impact descriptions. Focus on what changed for the end user, "
        "not implementation details."
    ),
    "deps": (
        "Act as a Security & Dependency Auditor. Analyze all new or changed "
        "dependencies: check for known vulnerabilities (CVEs), license "
        "compatibility (MIT/Apache/GPL), package size impact, maintenance "
        "status, and whether each dep is actively maintained. Reference exact "
        "file and line where each dependency is added or changed."
    ),
    "arch": (
        "Act as a Software Architect. Review changes for architectural issues: "
        "violation of separation of concerns, tight coupling, wrong layer "
        "dependencies, anti-patterns (God object, spaghetti logic, magic "
        "numbers, circular dependencies). Reference exact files and lines."
    ),
    "ci": (
        "Act as a DevOps/CI Engineer. Review the CI/CD pipeline changes for "
        "correctness, security (token permissions, secret exposure), efficiency "
        "(caching, parallelism, job dependencies), and best practices. Check "
        "for overly broad permissions, missing timeout limits, and potential "
        "race conditions in workflows."
    ),
    "docs": (
        "Act as a Technical Writer. Review the documentation changes for "
        "completeness, accuracy, clarity, and consistency. Check that code "
        "examples are correct, links are valid, and the structure is logical. "
        "Note any missing sections or outdated information."
    ),
    "frontend": (
        "Act as a Frontend Engineer. Review the UI/UX changes for accessibility "
        "(a11y), responsive design, performance (bundle size, render blocking), "
        "XSS risks in DOM manipulation, proper event handling, and browser "
        "compatibility. Reference exact files and lines."
    ),
    "backend": (
        "Act as a Senior Backend Engineer. Review the changes for correctness, "
        "error handling, input validation, resource management (file handles, "
        "connections), concurrency safety, and API contract compliance. "
        "Reference exact files and lines."
    ),
    "config": (
        "Act as a Configuration & Infrastructure Reviewer. Analyze the config "
        "changes for correctness, security implications (exposed ports, "
        "permissive CORS, debug mode in production), consistency across "
        "environments, and potential breaking changes for existing deployments."
    ),
    "general": (
        "Act as a Senior Software Engineer reviewing a colleague's changes. "
        "Provide a thorough assessment covering: what was changed and why, "
        "whether the changes introduce any risks or bugs, code quality, "
        "and the overall scope and impact on the project."
    ),
}

# Maps commit-message bracket labels and PR labels to role keys.
LABEL_TO_ROLE = {
    "sec": "security", "security": "security", "audit": "security",
    "review": "review", "refactor": "review", "code-review": "review",
    "qa": "qa", "test": "qa", "testing": "qa",
    "perf": "perf", "performance": "perf", "optimize": "perf",
    "pm": "pm", "release": "pm", "product": "pm",
    "deps": "deps", "dependencies": "deps", "dep": "deps",
    "arch": "arch", "architecture": "arch",
    "ci": "ci", "devops": "ci", "pipeline": "ci", "workflow": "ci",
    "docs": "docs", "doc": "docs", "documentation": "docs",
    "frontend": "frontend", "ui": "frontend", "ux": "frontend", "css": "frontend",
    "backend": "backend", "api": "backend", "server": "backend",
    "config": "config", "infra": "config", "infrastructure": "config",
}

# ---------------------------------------------------------------------------
# Prompt routing — label match first, then auto-detect from diff content.
# ---------------------------------------------------------------------------
role_key = None
for label in trigger_labels:
    if label in LABEL_TO_ROLE:
        role_key = LABEL_TO_ROLE[label]
        break

if not role_key:
    role_key = detect_change_type(changed_files, diff_text, event_context)
    print(f"Auto-detected change type: {role_key}")

role_instruction = PROMPT_ROLES.get(role_key, PROMPT_ROLES["general"])

prompt = f"""{role_instruction}

Do NOT invent problems that do not exist in the diff. Base your analysis strictly on what you see.
{severity_guide}
Context: {event_context}
Changed files: {', '.join(changed_files)}
Changes: {diff_text}
{base_instructions}"""


def call_model(prompt: str, retries: int = 3, delay: int = 5) -> dict:
    """Send a review prompt to the hosted model and parse the JSON reply."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {model_token}"
    }
    payload = {
        "messages": [
            {"role": "system", "content": "You are a professional software auditor. Always return valid JSON only. No markdown, no explanation, just the JSON object."},
            {"role": "user", "content": prompt}
        ],
        "model": MODEL_NAME,
        "temperature": 0.1
    }

    for attempt in range(retries):
        try:
            resp = requests.post(ENDPOINT, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            raw = data['choices'][0]['message']['content'].strip()
            raw = re.sub(r'^```json\s*|```$', '', raw, flags=re.MULTILINE).strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)

    print("All attempts failed. Exiting gracefully.")
    exit(0)


# ---------------------------------------------------------------------------
# Main execution — call the model and post the results to GitHub.
# ---------------------------------------------------------------------------

result = call_model(prompt)

title_keyword = result.get("issue_title", "")[:40]
if was_already_closed(title_keyword):
    exit(0)

affected_file = result.get("affected_file", "")
affected_line = result.get("affected_line", 1)

if affected_file:
    permalink = build_permalink(affected_file, affected_line)
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", permalink)
else:
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", "_No specific file identified_")

footer = f"\n\n---\n*Generated from {dedup_key} | Auto-detected role: `{role_key}`*"

severity = result.get("severity", "medium").lower()
severity_label_map = {
    "critical":      "severity: critical",
    "high":          "severity: high",
    "elevated":      "severity: elevated",
    "medium":        "severity: medium",
    "moderate":      "severity: moderate",
    "low":           "severity: low",
    "informational": "severity: informational",
}
extra_labels = [severity_label_map.get(severity, "severity: medium")]
all_labels = list(set(result.get("labels", []) + extra_labels))

issue = repo.create_issue(
    title=result["issue_title"],
    body=issue_body + footer,
    labels=all_labels
)
print(f"Created issue #{issue.number}: {issue.title}")

if pr_ref:
    summary = result.get("summary", "")
    if summary:
        pr_comment = (
            f"### AI Analysis Summary\n\n"
            f"{summary}\n\n"
            f"**Severity:** `{severity.upper()}` | **Role:** `{role_key}`\n\n"
            f"Full details: #{issue.number}"
        )
        pr_ref.create_issue_comment(pr_comment)
        print(f"Posted summary comment to PR #{pr_ref.number}")
