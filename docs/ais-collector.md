# VesselAPI collection after 29 October 2026

The only production collector is the existing `abdias-public-portals` Worker,
triggered at UTC minutes 21 and 51. GitHub Actions only mirrors cached observations;
its delays no longer control live collection or the central portals.

- Every run synchronizes SPOT and Radar observations before evaluating eligibility.
- Valid SPOT/MarineTraffic observations less than 30 minutes old suppress a request.
- Magellan/Patagonian envelopes retain the newest actual fix for at most six hours.
  A newer actual fix outside cancels the mode immediately. No synthetic position is
  used to decide location. Expiry returns to the normal budget.
- Intensive mode requires a quota header at most 12 hours old and more than 120
  remaining credits. Reserve is decremented before requesting; all attempts count.
- Minimum request interval is 30 minutes; outside the envelopes the normal budget
  remains one request per six-hour Brasilia slot, at most four daily requests.
- A versioned D1 row reserves the request before network access. Concurrent cron
  invocations cannot both spend a credit. A crashed request keeps its reservation.
- 401/403 block further requests; 429 respects Retry-After; failures back off at
  least one hour. No automatic satellite access or other provider is enabled.
- `/api/ais` is anonymous READ ONLY, exposing only previously public AIS observations,
  source health and decision reason. Visiting it cannot spend quota. Other private
  APIs retain their existing keys, origin checks and access rules.
- `ais_collector` owns ledger and health; `data/ais-request-ledger.json` is migration
  seed only. Never restart the old GitHub collector or reset the D1 ledger.
- `VESSELAPI_API_KEY` is transferred to the existing Worker through deployment stdin,
  using the existing GitHub secret. It must never be written into source or logs.

Validation: offline policy, SQLite reservation races, provider statuses, API access,
position retention and Worker bundle tests. A deployed handler is not proof that a
scheduled invocation ran; verify `/api/ais` lastDecision and lastAttemptAt separately.
