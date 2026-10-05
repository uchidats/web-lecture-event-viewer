/* Google Calendar adapter. Tokens and private appointments live only in this closure. */
(function (root) {
  "use strict";
  const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/calendar.events"];
  const DAY = 86400000;

  function eventRange(event) {
    const first = root.parseEventDate(event.date);
    const last = root.parseEventDate(event.endDate || event.date);
    if (first === null || last === null || last < first) return null;
    const venue = root.getEventVenue(event);
    const country = venue?.country || event.cityCountry?.split(/[/／]/)[1]?.trim();
    const domestic = country === "日本" || (!country && event.region && event.region !== "海外");
    const zone = event.timeZone || venue?.timeZone || (domestic ? "Asia/Tokyo" : null);
    const formatter = root.getTimeZoneFormatter(zone);
    if (!formatter) return null;
    const match = typeof event.time === "string" && event.time.match(/^\s*(\d{1,2}):(\d{2})\s*[-–—〜～]\s*(\d{1,2}):(\d{2})(?:\s*[（(].*?[）)])?\s*$/);
    // Known date-only schedules are all-day. Malformed numeric times are never guessed.
    const allDay = !match && (!event.time || /^(全日程|現地時間|終日|未定|要確認)(?:[（(].*[）)])?$/.test(String(event.time).trim()));
    if (!match && !allDay) return null;
    let start, end;
    if (allDay) {
      start = root.localTimeToInstant(first, 0, 0, formatter);
      end = root.localTimeToInstant(last + DAY, 0, 0, formatter);
    } else {
      const [, sh, sm, eh, em] = match.map(Number);
      if (sh > 23 || sm > 59 || eh > 24 || em > 59 || (eh === 24 && em)) return null;
      start = root.localTimeToInstant(first, sh, sm, formatter);
      end = root.localTimeToInstant(last + (last === first && eh * 60 + em <= sh * 60 + sm ? DAY : 0), eh, em, formatter);
    }
    if (start === null || end === null || end <= start) return null;
    return {start, end, zone, allDay, multiDay: last > first, startDate: event.date,
      endDateExclusive: new Date(last + DAY).toISOString().slice(0, 10)};
  }

  function appointmentRange(item, calendarZone) {
    if (item.start?.dateTime && item.end?.dateTime) {
      const start = Date.parse(item.start.dateTime), end = Date.parse(item.end.dateTime);
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? {start, end} : null;
    }
    if (item.start?.date && item.end?.date) {
      const first = root.parseEventDate(item.start.date), last = root.parseEventDate(item.end.date);
      const formatter = root.getTimeZoneFormatter(calendarZone);
      if (first === null || last === null || !formatter) return null;
      const start = root.localTimeToInstant(first, 0, 0, formatter), end = root.localTimeToInstant(last, 0, 0, formatter);
      return start !== null && end !== null && end > start ? {start, end} : null;
    }
    return null;
  }

  function quarters(range) {
    const keys = [];
    const date = new Date(range.start);
    let year = date.getUTCFullYear(), quarter = Math.floor(date.getUTCMonth() / 3);
    for (let i = 0; i < 40; i++) {
      const start = Date.UTC(year, quarter * 3, 1), end = Date.UTC(year, quarter * 3 + 3, 1);
      if (start >= range.end) break;
      keys.push({key: `${year}-${quarter}`, start, end});
      if (++quarter === 4) {quarter = 0; year++;}
    }
    return keys;
  }

  function conflictLabel(item, interval, multiDay) {
    const formatter = root.getTimeZoneFormatter("Asia/Tokyo");
    const start = root.getZonedTimeParts(interval.start, formatter), end = root.getZonedTimeParts(interval.end, formatter);
    const clock = parts => `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
    const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
    return {providerLabel: "Google", title: item.summary || "予定（タイトル非公開）", allDay: !!item.start.date,
      dateLabel: multiDay ? `${start.month}/${start.day}` : "",
      start: clock(start), end: `${sameDay ? "" : `${end.month}/${end.day} `}${clock(end)}`};
  }

  function createAdapter({config = {}, fetchImpl = (...args) => root.fetch(...args), oauth = () => root.google?.accounts?.oauth2,
    now = () => Date.now(), onChange = () => {}, timers = root} = {}) {
    let token = null, expiresAt = 0, expiryTimer = null, tokenClient = null, phase = "disconnected";
    let generation = 0, calendarZone = null, metadataPromise = null, authPromise = null;
    const cache = new Map(), pending = new Map(), failures = new Set(), controllers = new Set(), inserting = new Map();
    const notify = () => onChange();
    function reset(nextPhase) {
      generation++; token = null; expiresAt = 0; phase = nextPhase;
      timers.clearTimeout(expiryTimer); expiryTimer = null;
      controllers.forEach(controller => controller.abort()); controllers.clear();
      cache.clear(); pending.clear(); failures.clear(); inserting.clear();
      calendarZone = null; metadataPromise = null; notify();
    }
    function connected() {
      if (token && now() >= expiresAt) reset("expired");
      return !!token;
    }
    async function request(path, options = {}) {
      if (!connected()) throw new Error("reconnect");
      const currentGeneration = generation, accessToken = token;
      const controller = new AbortController(); controllers.add(controller);
      const timeout = timers.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetchImpl(`https://www.googleapis.com/calendar/v3/${path}`, {
          ...options, signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "error",
          headers: {Authorization: `Bearer ${accessToken}`, ...(options.body ? {"Content-Type": "application/json"} : {})}
        });
        if (currentGeneration !== generation) throw new Error("session-changed");
        if (response.status === 401 || response.status === 403) {reset("expired"); throw new Error("reconnect");}
        if (!response.ok) throw new Error("calendar-request-failed");
        const result = await response.json();
        if (currentGeneration !== generation) throw new Error("session-changed");
        return result;
      } finally {timers.clearTimeout(timeout); controllers.delete(controller);}
    }
    function connect() {
      if (authPromise) return authPromise;
      if (!config.clientId || config.clientId === "YOUR_GOOGLE_CLIENT_ID") return Promise.reject(new Error("client-id-missing"));
      const gis = oauth();
      if (!gis) return Promise.reject(new Error("identity-library-unavailable"));
      reset("connecting");
      const currentGeneration = generation;
      authPromise = new Promise((resolve, reject) => {
        const fail = () => {if (currentGeneration === generation) reset("error"); reject(new Error("authorization-failed"));};
        tokenClient = gis.initTokenClient({client_id: config.clientId, scope: SCOPES.join(" "),
          callback: response => {
            if (currentGeneration !== generation) {reject(new Error("session-changed")); return;}
            if (response.error || !response.access_token || !gis.hasGrantedAllScopes(response, ...SCOPES) || !(Number(response.expires_in) > 0)) {fail(); return;}
            token = response.access_token; expiresAt = now() + Number(response.expires_in) * 1000;
            phase = "connected";
            expiryTimer = timers.setTimeout(() => reset("expired"), Number(response.expires_in) * 1000);
            notify(); resolve();
          }, error_callback: fail});
        try {tokenClient.requestAccessToken({prompt: "select_account"});} catch {fail();}
      }).finally(() => {authPromise = null;});
      return authPromise;
    }
    async function metadata() {
      if (calendarZone) return calendarZone;
      if (!metadataPromise) {
        const currentGeneration = generation;
        metadataPromise = request(`calendars/${encodeURIComponent(config.calendarId || "primary")}`).then(result => {
          if (currentGeneration !== generation || !root.getTimeZoneFormatter(result.timeZone)) throw new Error("calendar-timezone-unavailable");
          calendarZone = result.timeZone; return calendarZone;
        }).catch(error => {if (currentGeneration === generation) metadataPromise = null; throw error;});
      }
      return metadataPromise;
    }
    function loadQuarter(bucket) {
      if (cache.has(bucket.key) || failures.has(bucket.key)) return Promise.resolve();
      if (pending.has(bucket.key)) return pending.get(bucket.key);
      const currentGeneration = generation;
      const task = (async () => {
        try {
          await metadata();
          if (currentGeneration !== generation) return;
          const items = []; let pageToken;
          for (let page = 0; page < 50; page++) {
            const query = new URLSearchParams({timeMin: new Date(bucket.start).toISOString(), timeMax: new Date(bucket.end).toISOString(),
              singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500"});
            if (pageToken) query.set("pageToken", pageToken);
            const result = await request(`calendars/${encodeURIComponent(config.calendarId || "primary")}/events?${query}`);
            items.push(...(result.items || [])); pageToken = result.nextPageToken;
            if (!pageToken) break;
            if (page === 49) throw new Error("too-many-events");
          }
          if (currentGeneration === generation) cache.set(bucket.key, items);
        } catch {if (currentGeneration === generation) failures.add(bucket.key);}
        finally {if (currentGeneration === generation) {pending.delete(bucket.key); notify();}}
      })();
      pending.set(bucket.key, task); return task;
    }
    async function ensure(events) {
      if (!connected()) return;
      const unique = new Map();
      for (const event of events) {const range = eventRange(event); if (range) for (const bucket of quarters(range)) unique.set(bucket.key, bucket);}
      // Bounded concurrency, one request stream per quarter; filtering reuses the session cache.
      const buckets = [...unique.values()]; let cursor = 0;
      await Promise.all([0, 1].map(async () => {while (cursor < buckets.length && connected()) await loadQuarter(buckets[cursor++]);}));
    }
    function snapshot(event) {
      if (!connected()) return {state: phase === "connecting" ? "loading" : phase === "disconnected" ? "disconnected" : "error", conflicts: []};
      const range = eventRange(event);
      if (!range) return {state: "unknown", conflicts: []};
      const buckets = quarters(range);
      if (buckets.some(b => failures.has(b.key))) return {state: "error", conflicts: []};
      if (buckets.some(b => !cache.has(b.key))) return {state: "loading", conflicts: []};
      const items = [...new Map(buckets.flatMap(b => cache.get(b.key)).map(item => [item.id, item])).values()];
      const conflicts = [], spans = []; let registered = false;
      for (const item of items) {
        if (item.status === "cancelled") continue;
        const interval = appointmentRange(item, calendarZone);
        if (!interval) return {state: "error", conflicts: []};
        const sameId = item.extendedProperties?.private?.ophthalconfEventId === event.id ||
          (item.description || "").split(/\r?\n/).includes(`OphthalConf-ID: ${event.id}`);
        if (sameId && interval.start === range.start && interval.end === range.end) {registered = true; continue;}
        if (item.transparency === "transparent" || item.attendees?.some(attendee => attendee.self && attendee.responseStatus === "declined")) continue;
        if (interval.start < range.end && interval.end > range.start) {
          spans.push([Math.max(range.start, interval.start), Math.min(range.end, interval.end)]);
          conflicts.push({...conflictLabel(item, interval, range.multiDay), sortTime: interval.start});
        }
      }
      spans.sort((a, b) => a[0] - b[0]);
      let covered = 0, start = null, end = null;
      for (const span of spans) {
        if (start === null) [start, end] = span;
        else if (span[0] <= end) end = Math.max(end, span[1]);
        else {covered += end - start; [start, end] = span;}
      }
      if (start !== null) covered += end - start;
      return {state: "ready", registered, status: covered === 0 ? "free" : covered / (range.end - range.start) >= 0.8 ? "busy" : "partial",
        conflicts: conflicts.sort((a, b) => a.sortTime - b.sortTime), multiDay: range.multiDay};
    }
    function insert(event) {
      if (inserting.has(event.id)) return inserting.get(event.id);
      const currentGeneration = generation;
      const task = (async () => {
        if (!connected()) throw new Error("reconnect");
        const range = eventRange(event);
        if (!range) throw new Error("event-time-unknown");
        await ensure([event]);
        if (currentGeneration !== generation) throw new Error("session-changed");
        const known = snapshot(event);
        if (known.state !== "ready") throw new Error("calendar-check-failed");
        if (known.registered) return {alreadyRegistered: true};
        const description = `${event.description || ""}\n主催: ${event.sponsor || ""}\n単位: ${event.credits || ""}\n公式URL: ${event.officialUrl || ""}\nOphthalConf-ID: ${event.id}`;
        const body = {summary: event.title, description, location: root.getEventVenueName(event),
          start: range.allDay ? {date: range.startDate} : {dateTime: new Date(range.start).toISOString(), timeZone: range.zone},
          end: range.allDay ? {date: range.endDateExclusive} : {dateTime: new Date(range.end).toISOString(), timeZone: range.zone},
          extendedProperties: {private: {ophthalconfEventId: event.id}}};
        // Google all-day dates use the destination calendar's timezone; use exact instants when these differ.
        if (range.allDay && calendarZone !== range.zone) {
          body.start = {dateTime: new Date(range.start).toISOString(), timeZone: range.zone};
          body.end = {dateTime: new Date(range.end).toISOString(), timeZone: range.zone};
        }
        const result = await request(`calendars/${encodeURIComponent(config.calendarId || "primary")}/events`, {method: "POST", body: JSON.stringify(body)});
        if (currentGeneration !== generation) throw new Error("session-changed");
        if (!result.id || !appointmentRange(result, calendarZone)) throw new Error("insert-response-invalid");
        for (const bucket of quarters(range)) if (cache.has(bucket.key)) cache.get(bucket.key).push(result);
        notify(); return result;
      })().finally(() => {if (currentGeneration === generation) inserting.delete(event.id);});
      inserting.set(event.id, task); return task;
    }
    return {connect, disconnect: () => reset("disconnected"), connected, ensure, snapshot, insert,
      refresh: () => {if (connected()) {generation++; controllers.forEach(c => c.abort()); cache.clear(); pending.clear(); failures.clear(); inserting.clear(); metadataPromise = null; notify();}},
      connectionState: () => {connected(); return phase;}};
  }

  const config = typeof GOOGLE_CALENDAR_CONFIG !== "undefined" ? GOOGLE_CALENDAR_CONFIG : {};
  let repaint = () => {}, scheduled = false;
  const adapter = createAdapter({config, onChange: () => {
    if (!scheduled) {scheduled = true; root.setTimeout(() => {scheduled = false; updateConnectionUI(); repaint();}, 0);}
  }});
  function updateConnectionUI(provider) {
    const section = root.document?.getElementById("google-calendar-connection");
    if (!section) return;
    provider ||= root.document.querySelector('input[name="calendarProvider"]:checked')?.value || "both";
    section.hidden = !["google", "both"].includes(provider);
    const state = adapter.connectionState();
    root.document.getElementById("google-calendar-state").textContent = adapter.connected() ? "Google Calendar　接続済み" :
      state === "connecting" ? "Google Calendar　認証中…" : "Google Calendar　未接続";
    root.document.getElementById("google-calendar-connect").disabled = state === "connecting";
    root.document.getElementById("google-calendar-disconnect").hidden = !adapter.connected();
    root.document.getElementById("google-calendar-refresh").hidden = !adapter.connected();
    if (state === "expired" || state === "error") root.document.getElementById("google-calendar-message").textContent = "Google Calendarを再接続してください";
  }
  function setupUI(onRepaint) {
    repaint = onRepaint;
    const connect = root.document.getElementById("google-calendar-connect");
    if (!connect) return;
    const message = root.document.getElementById("google-calendar-message");
    connect.addEventListener("click", () => {
      message.textContent = "";
      adapter.connect().catch(error => {
        message.textContent = error.message === "client-id-missing" ? "Google OAuth Client IDを設定してください。" :
          error.message === "identity-library-unavailable" ? "Google認証ライブラリを読み込めません。接続を再試行してください。" : "Google Calendarを再接続してください。";
        updateConnectionUI();
      });
      updateConnectionUI();
    });
    root.document.getElementById("google-calendar-disconnect").addEventListener("click", () => {adapter.disconnect(); message.textContent = "このブラウザーの接続情報を破棄しました。";});
    root.document.getElementById("google-calendar-refresh").addEventListener("click", () => adapter.refresh());
    updateConnectionUI();
  }
  root.GoogleCalendar = {...adapter, setupUI, updateConnectionUI, eventRange};
  if (typeof module !== "undefined" && module.exports) module.exports = {createAdapter, eventRange, appointmentRange, SCOPES};
})(globalThis);
