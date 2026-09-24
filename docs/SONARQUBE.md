# SonarQube

Vet-Rate.org is checked by SonarQube at three levels. All three use the same
rules, so a warning you see in the editor is the warning the scan reports.

| Where                            | What runs                                               | When                                      |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Editor (Problems tab)            | SonarQube for IDE, connected to the local server        | As you edit                               |
| `npm run lint` / pre-commit / CI | ESLint with `eslint-plugin-sonarjs` (recommended rules) | Every commit and PR                       |
| `npm run sonar:scan`             | Full SonarQube analysis, local server                   | Before a release, or after a large change |

Nothing leaves the machine: the server listens on `127.0.0.1` only.

## First-time setup

1. Start the server: `npm run sonar:up` (Docker Desktop must be running).
   First boot takes about a minute; <http://127.0.0.1:9000> shows "UP" when ready.
2. Log in as `admin` / `admin` and set a new password when prompted.
3. Create a token: **My Account → Security → Generate Token**, type
   **Global Analysis Token**. Keep it in your password manager.
4. Connect the editor: in the SonarQube for IDE panel, choose
   **Add SonarQube Server Connection**, use connection ID `vetrate-local`,
   server `http://127.0.0.1:9000`, and paste the token. The project binding
   (`vet-rate-org`) is shared in `.sonarlint/connectedMode.json`, so the
   extension offers to bind automatically.

## Running a scan

```powershell
$env:SONAR_TOKEN = "<your token>"
npm run sonar:scan
```

It prints the quality-gate result, open issues by quality and severity, and
the dashboard link. `npm run sonar:down` stops the server; results persist in
Docker volumes.

## Triage rules

- **Bugs and security issues:** fix them. If a finding is a false positive,
  mark it in the dashboard with a reason rather than suppressing it in code.
- **`Math.random` (S2245):** safe for animation, jitter and display IDs.
  Anything that protects data (keys, tokens, nonces) must use
  `crypto.getRandomValues` or `crypto.randomUUID`.
- **Cognitive complexity:** the limit is 15 in both SonarQube and ESLint.
  Split the function rather than raising the limit.
- **Regex backtracking (S8786, S5852):** these patterns read the text of
  veterans' VA letters. Change them only with a test on real letter wording.
