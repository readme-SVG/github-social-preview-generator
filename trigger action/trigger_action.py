"""Create GitHub issues and PR comments from AI-generated change analysis.

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

# ---------------------------------------------------------------------------
# Event routing — collect the diff and metadata for push vs pull_request.
# ---------------------------------------------------------------------------
if event_name == "push":
    commit_sha = os.environ.get("COMMIT_SHA")
    commit = repo.get_commit(commit_sha)

    # Skip merge commits (more than one parent) to avoid double-processing
    # changes that already went through the pull_request event path.
    if len(commit.parents) > 1:
        exit(0)
    if not commit.author:
        exit(0)

    author_login = commit.author.login.strip().lower()
    if author_login not in allowed_users:
        exit(0)

    # Skip merge commits that already came through the PR flow.
    # If the commit message contains "(#<number>)" it was merged via a PR
    # and the analysis was already performed on the PR event.
    pr_match = re.search(r'\(#(\d+)\)', commit.commit.message)
    if pr_match:
        dedup_key = f"PR #{pr_match.group(1)}"
    else:
        dedup_key = f"commit:{commit_sha[:7]}"

    event_context = f"Commit Message: {commit.commit.message}"
    # Extract labels from bracket syntax — e.g. "[security] fix XSS" → ["security"]
    trigger_labels = [m.lower() for m in re.findall(r'\[(.*?)\]', commit.commit.message)]

    # Accumulate file patches up to the character budget (10 000 chars).
    for file in commit.files:
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

    # Retain PR reference for posting the summary comment after issue creation.
    pr_ref = pr
    dedup_key = f"PR #{pr_number}"
    event_context = f"PR Title: {pr.title}\nPR Body: {pr.body}"
    trigger_labels = [label.name.lower() for label in pr.labels]

    # Accumulate file patches up to the character budget (80 000 chars).
    for file in pr.get_files():
        diff_text += f"File: {file.filename}\nPatch:\n{file.patch}\n\n"
        if len(diff_text) > 80000:
            diff_text += "\n[Diff truncated...]"
            break
else:
    # Unsupported event type — exit cleanly without error.
    exit(0)

# A very small diff (fewer than 50 non-whitespace characters) is unlikely to
# contain meaningful changes and would produce low-quality model output.
if len(diff_text.strip()) < 50:
    print("Diff too small to analyze. Skipping.")
    exit(0)

# Avoid reopening the same finding once it has already been tracked.
# We search all open issues for the dedup_key embedded in their body.
for issue in repo.get_issues(state="all"):
    if dedup_key in (issue.body or ""):
        print(f"Issue for {dedup_key} already exists (#{issue.number}), skipping.")
        exit(0)


def was_already_closed(title_keyword: str) -> bool:
    """Return whether a similar issue title already exists in closed issues.

    Iterates every closed issue in the repository and performs a
    case-insensitive substring match against each issue title. This guards
    against reopening findings that were deliberately closed by a maintainer.

    Note:
        This function pages through *all* closed issues via the GitHub REST
        API. On repositories with a very large issue history the call may be
        slow or consume a significant portion of the GitHub API rate limit.

    Args:
        title_keyword (str): A case-insensitive substring used to compare
            against titles of closed repository issues. Typically the first
            40 characters of the model-generated issue title.

    Returns:
        bool: ``True`` if at least one closed issue contains
            ``title_keyword`` in its title (case-insensitive); ``False``
            otherwise.

    Examples:
        >>> was_already_closed("[LOW] Documentation update")
        False
        >>> was_already_closed("[HIGH] SQL injection in login handler")
        True  # if a matching closed issue already exists
    """
    for issue in repo.get_issues(state="closed"):
        if title_keyword.lower() in (issue.title or "").lower():
            print(f"Similar closed issue found: #{issue.number} — skipping.")
            return True
    return False


def build_permalink(filename: str, line: int = 1) -> str:
    """Build a GitHub blob permalink for a file and line number.

    Constructs a permanent deep-link into the GitHub file browser anchored
    to a specific line. The commit SHA is resolved from the ``COMMIT_SHA``
    environment variable for push events, or from the pull request head SHA
    for pull-request events.

    Note:
        If neither ``COMMIT_SHA`` nor ``pr_ref`` is available the SHA segment
        will be an empty string, producing a technically invalid but still
        parseable URL that callers can detect.

    Args:
        filename (str): The repository-relative path to the file being
            linked (e.g. ``"src/utils/auth.py"``).
        line (int, optional): The 1-based line number to anchor in the GitHub
            URL. Defaults to ``1``.

    Returns:
        str: A fully-qualified GitHub URL of the form
            ``https://github.com/<owner>/<repo>/blob/<sha>/<filename>#L<line>``.

    Examples:
        >>> build_permalink("src/app.py", 12)
        'https://github.com/<owner>/<repo>/blob/<sha>/src/app.py#L12'
        >>> build_permalink("README.md")
        'https://github.com/<owner>/<repo>/blob/<sha>/README.md#L1'
    """
    sha = os.environ.get("COMMIT_SHA") or ""
    # Fall back to the PR head SHA when running in a pull_request event context.
    if not sha and pr_ref:
        sha = pr_ref.head.sha
    return f"https://github.com/{repo_name}/blob/{sha}/{filename}#L{line}"


# ---------------------------------------------------------------------------
# Structured output contract sent to the model as part of every prompt.
# The model must return a raw JSON object matching this schema exactly.
# ---------------------------------------------------------------------------
base_instructions = """
Return only a raw JSON object with no markdown formatting. The JSON must have these exact keys:

"issue_title": string — include severity prefix like [CRITICAL], [HIGH], [MEDIUM], or [LOW] at the start,
"severity": string — one of: critical, high, medium, low,
"issue_body": string — must include these sections:
  ## Problem
  (clear description with exact file paths and line numbers if known)

  ## Code Reference
  (the exact problematic code snippet)

  ## Suggested Fix
  (concrete code or steps to fix)

  ## Permalink
  (placeholder: PUT_PERMALINK_HERE — will be replaced automatically)

"labels": list of strings — standard GitHub labels plus the severity level,
"affected_file": string — the most relevant filename from the diff (or "" if unknown),
"affected_line": integer — approximate line number of the issue (or 1 if unknown),
"summary": string — 2-3 sentence plain-English summary for the PR comment

The issue_title, issue_body and summary MUST be written entirely in English.
"""

# ---------------------------------------------------------------------------
# Prompt routing — select the model persona based on trigger_labels extracted
# from the commit message or applied PR labels. Falls back to a generic
# documentation-summary prompt when no recognised label is present.
# ---------------------------------------------------------------------------
if any(l in trigger_labels for l in ["sec", "security", "audit"]):
    prompt = f"Act as a Strict Security Auditor. Perform a deep security audit (OWASP Top 10). Find real vulnerabilities with exact file/line references.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["review", "refactor", "code-review"]):
    prompt = f"Act as a Strict Code Reviewer. Analyze code quality (SOLID/DRY). Point to exact lines that violate principles.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["qa", "test", "testing"]):
    prompt = f"Act as a QA Engineer. Identify edge cases and missing test coverage. Reference exact functions/lines.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["perf", "performance", "optimize"]):
    prompt = f"Act as a Performance Expert. Analyze bottlenecks and O(n) complexity issues with exact line references.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["pm", "release", "product"]):
    prompt = f"Act as a Product Manager. Generate user-facing Release Notes with clear impact descriptions.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["deps", "dependencies"]):
    prompt = f"Act as a Security & Dependency Auditor. Analyze all new or changed dependencies: check for known vulnerabilities (CVEs), license compatibility (MIT/Apache/GPL), package size impact, and whether each dep is actively maintained. Reference exact file and line where dep is added.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
elif any(l in trigger_labels for l in ["arch", "architecture"]):
    prompt = f"Act as a Software Architect. Review the code changes for architectural issues: violation of separation of concerns, tight coupling, wrong layer dependencies, anti-patterns (God object, spaghetti logic, magic numbers). Reference exact files and lines.\nContext: {event_context}\nChanges: {diff_text}\n{base_instructions}"
else:
    prompt = f"""Analyze the following code changes and create a documentation issue summarizing what was changed and why.
IMPORTANT: Do NOT invent security issues, bugs, or problems that do not exist in the diff.
If the changes are trivial (e.g. adding imports, minor refactoring), set severity to LOW and describe only what actually changed.
Context: {event_context}
Changes: {diff_text}
{base_instructions}"""


def call_model(prompt: str, retries: int = 3, delay: int = 5) -> dict:
    """Send a review prompt to the hosted model and parse the JSON reply.

    Submits a chat-completion request to the Azure-hosted Llama inference
    endpoint. The system message instructs the model to return only a raw
    JSON object; the function strips any accidental markdown code-fence
    wrappers before parsing. On transient failures the request is retried up
    to ``retries`` times with a fixed ``delay``-second pause between attempts.
    If all attempts fail the process exits with code 0 (success) to prevent
    the GitHub Actions workflow step from being marked as failed.

    Args:
        prompt (str): The fully rendered instruction payload describing the
            repository context, the diff, and the required JSON output schema.
        retries (int, optional): The maximum number of HTTP request attempts
            to make before exiting gracefully. Defaults to ``3``.
        delay (int, optional): The number of seconds to wait between
            consecutive failed attempts. Defaults to ``5``.

    Returns:
        dict: The parsed JSON object returned by the model. Expected keys are
            ``issue_title``, ``severity``, ``issue_body``, ``labels``,
            ``affected_file``, ``affected_line``, and ``summary``.

    Raises:
        requests.HTTPError: Raised by ``resp.raise_for_status()`` when the
            inference endpoint returns a non-2xx HTTP status code. The
            exception is caught internally, logged to stdout, and the request
            is retried until the budget is exhausted.
        json.JSONDecodeError: Raised by ``json.loads()`` when the model
            returns a response that cannot be parsed as valid JSON even after
            stripping markdown fences. Caught internally and retried.
        SystemExit: Raised (via ``exit(0)``) after all retry attempts are
            exhausted. The workflow step will succeed but no issue is created.

    Examples:
        >>> response = call_model("Summarize this diff", retries=1, delay=0)
        >>> isinstance(response, dict)
        True
        >>> "issue_title" in response
        True
    """
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
        # Low temperature keeps the JSON structure deterministic across retries.
        "temperature": 0.1
    }

    for attempt in range(retries):
        try:
            resp = requests.post(ENDPOINT, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            raw = data['choices'][0]['message']['content'].strip()
            # Strip markdown code-fence wrappers (```json ... ```) that some
            # model versions emit despite the system instruction.
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

# Use only the first 40 characters of the title for closed-issue deduplication
# to allow minor wording variations while still catching near-duplicates.
title_keyword = result.get("issue_title", "")[:40]
if was_already_closed(title_keyword):
    exit(0)

affected_file = result.get("affected_file", "")
affected_line = result.get("affected_line", 1)

# Substitute the permalink placeholder with a real GitHub deep-link when the
# model identified a specific file; otherwise use a neutral fallback string.
if affected_file:
    permalink = build_permalink(affected_file, affected_line)
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", permalink)
else:
    issue_body = result["issue_body"].replace("PUT_PERMALINK_HERE", "_No specific file identified_")

# Keep the footer source-aware so issues can be traced back quickly.
footer = f"\n\n---\n*Generated from {dedup_key}*"

# Map the model's free-text severity string to a structured GitHub label.
severity = result.get("severity", "medium").lower()
severity_label_map = {
    "critical": "severity: critical",
    "high":     "severity: high",
    "medium":   "severity: medium",
    "low":      "severity: low",
}
extra_labels = [severity_label_map.get(severity, "severity: medium")]
# Merge model-suggested labels with the mandatory severity label,
# removing duplicates via set conversion.
all_labels = list(set(result.get("labels", []) + extra_labels))

issue = repo.create_issue(
    title=result["issue_title"],
    body=issue_body + footer,
    labels=all_labels
)
print(f"Created issue #{issue.number}: {issue.title}")

# Post a concise summary comment on the originating PR so reviewers see the
# AI analysis inline without having to navigate to the issue.
if pr_ref:
    summary = result.get("summary", "")
    if summary:
        pr_comment = (
            f"### AI Analysis Summary\n\n"
            f"{summary}\n\n"
            f"**Severity:** `{severity.upper()}`\n\n"
            f"Full details: #{issue.number}"
        )
        pr_ref.create_issue_comment(pr_comment)
        print(f"Posted summary comment to PR #{pr_ref.number}")
