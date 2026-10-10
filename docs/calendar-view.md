# OphthalConf calendar display

FullCalendar Standard 6.1.21 (MIT) is vendored under `vendor/fullcalendar-6.1.21`.
The existing script-tag setup loads its bundle and Japanese locale locally.
No build framework, Premium plugin, external calendar feed or Google embed is used.

`renderEvents()` passes its existing `getFilteredEvents()` result to
`OphthalCalendarView.sync()`. The view never reimplements filters or writes to
localStorage. `view=list|calendar|compact` and optional `month=YYYY-MM` use the URL;
other query parameters and the hash are preserved, including on browser back/forward.

Calendar mode uses `dayGridMonth`; compact mode uses `listMonth` at every width.
Without an explicit URL view, screens up to 600px start in compact mode and larger
screens start in calendar mode. This choice is made once and reflected in the URL;
resizing never changes the mode. All three modes share the same filters.
Compact headings combine the date and weekday, such as `2027年7月3日（土）`.
Holiday names follow this combined heading, with subdued red styling; only the
holiday name wraps to another line when space is limited.
Published holidays add `・祝` inside the weekday parentheses (including `日・祝`).
Compact date/weekday text uses subdued blue on Saturdays and subdued red on
Sundays and published Japanese holidays. Holidays take priority over Saturdays;
weekday text and holiday names remain visible, and backgrounds are unchanged.
Both calendar modes use the same
adapter and event source. Conferences retain date-only local start/end dates;
the adapter adds one UTC calendar day to the inclusive end for FullCalendar's
exclusive-end convention. Seminars are date entries in this first version;
their times (including existing Japan/local-time display) remain in the detail card.
Timed instances can later be added in the same adapter without shifting conference dates.

The `今月` button uses FullCalendar's existing `today` action. Touch-only horizontal
swipes move one month on release (left: next, right: previous). A 60px minimum,
1.5× horizontal/vertical ratio and early vertical cancellation preserve scrolling;
mouse gestures do not navigate. Month changes use the same URL synchronization.

Selecting an event opens the existing card renderer in a dialog, with the same
attendance, PDF and calendar-add handlers. Filter/attendance changes refresh both
views and the open detail card, or close it if the event becomes hidden.

`japan-holidays.js` contains the Cabinet Office CSV's published 2025–2027 holidays
and statutory holidays (including substitute holidays), fetched on 2026-10-10:
https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv

Dates outside this snapshot are not guessed and have no holiday annotations.
There is no automatic updater; future years are not added automatically.
Holiday names appear in day headings/cells only, without a monthly holiday list
or source-attribution footer. To update, download the official Shift-JIS CSV,
convert published dates to `YYYY-MM-DD`, update the map and snapshot comment,
and run calendar tests. No external holiday API is called at runtime.

Future proposal (not implemented): a separate GitHub Actions workflow periodically
downloads the Cabinet Office official CSV, converts Shift-JIS to UTF-8 and validates
dates, then generates `japan-holidays.js` from published entries. Create a PR only
when the generated data differs; on download or validation failure, keep existing
data unchanged. Do not estimate unpublished holidays or future years.

Checks: `node scratch/test_calendar_view.js`, browser checks with
`node scratch/test_calendar_view_browser.js`, and the existing dual-site/regression tests.
