# OphthalConf calendar display

FullCalendar Standard 6.1.21 (MIT) is vendored under `vendor/fullcalendar-6.1.21`.
The existing script-tag setup loads its bundle and Japanese locale locally.
No build framework, Premium plugin, external calendar feed or Google embed is used.

`renderEvents()` passes its existing `getFilteredEvents()` result to
`OphthalCalendarView.sync()`. The view never reimplements filters or writes to
localStorage. `view=list|calendar` and optional `month=YYYY-MM` use the URL;
other query parameters and the hash are preserved, including on browser back/forward.

PC uses `dayGridMonth`; screens up to 600px use `listMonth`. Both use the same
adapter and event source. Conferences retain date-only local start/end dates;
the adapter adds one UTC calendar day to the inclusive end for FullCalendar's
exclusive-end convention. Seminars are date entries in this first version;
their times (including existing Japan/local-time display) remain in the detail card.
Timed instances can later be added in the same adapter without shifting conference dates.

Selecting an event opens the existing card renderer in a dialog, with the same
attendance, PDF and calendar-add handlers. Filter/attendance changes refresh both
views and the open detail card, or close it if the event becomes hidden.

`japan-holidays.js` contains the Cabinet Office CSV's published 2025–2027 holidays
and statutory holidays (including substitute holidays), fetched on 2026-10-10:
https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv

Dates outside this snapshot are not guessed; the calendar states when a year's
holiday data is not available. To update, download the official Shift-JIS CSV,
convert published dates to `YYYY-MM-DD`, update the map and snapshot comment,
and run calendar tests. No external holiday API is called at runtime.

Checks: `node scratch/test_calendar_view.js`, browser checks with
`node scratch/test_calendar_view_browser.js`, and the existing dual-site/regression tests.
