# Gemini monitor notifications

`runGeminiMonitor()` and `sendDailyMonitorNotification()` default to notifications disabled.
Only the boolean `notify: true` enables delivery. SMTP credentials alone do not authorize
delivery. `offline` and `apply` control analysis and data updates independently of email.
The monitor CLI defaults off; `--notify` explicitly opts in for direct use.

GitHub Actions runs the monitor without notification, saving a private snapshot with
`--report-output` in `runner.temp`, keyed by run ID and attempt. After validation,
commit handling and artifact upload, one final notification step uses this snapshot.
Only that step receives SMTP secrets. It never reads committed daily reports, which
can contain test dates. If the run fails before generating its snapshot, the final
step sends an incomplete-run notice instead of reusing an old report.

| Execution | Email |
| --- | --- |
| schedule | One final summary, including zero updates |
| workflow_dispatch default | None |
| workflow_dispatch with send_notification checked | One final summary |
| single_event_id supplied | None, even with checkbox checked |
| regression tests | None; notification tests use a mock transport |

Notification failure makes the final step fail; it does not silently succeed or retry
delivery. This prevents duplicate send attempts within one normal execution. SMTP
delivery itself depends on the provider and valid secrets.

Run `node scratch/verify_gemini_notification_regressions.js` for full regressions,
the isolated legacy updater integration, dual-site validation and build. It supplies
fake SMTP secrets and blocks/records TLS connection attempts in child processes;
notification tests inject mock transports. Existing report edits are restored after
verification. The legacy integration copy includes `firestore.rules`.
