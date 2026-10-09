/* OphthalConf calendar presentation. FullCalendar Standard 6.1.21 (MIT). */
(function(root) {
  'use strict';
  function nextDate(date) {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1);
    return day.toISOString().slice(0, 10);
  }
  function toCalendarEvent(event) {
    // Date-only strings preserve official local conference dates in every timezone.
    // The same adapter can later supply timed seminar instances separately.
    return {
      id: event.id, title: event.title, start: event.date,
      end: nextDate(event.endDate || event.date), allDay: true,
      interactive: true,
      classNames: [event.conferenceRegion === 'international' ? 'calendar-international' : 'calendar-domestic'],
      extendedProps: { originalEvent: event }
    };
  }
  function createView(document, window, dependencies) {
    const panel = document.getElementById('calendar-panel');
    const list = document.getElementById('event-list');
    const sort = document.querySelector('.sort-selector-wrapper');
    const listButton = document.getElementById('view-list');
    const calendarButton = document.getElementById('view-calendar');
    const dialog = document.getElementById('calendar-event-dialog');
    const detail = document.getElementById('calendar-event-detail');
    const holidays = window.OPHTHAL_JAPAN_HOLIDAYS || {};
    const holidayYears = [...new Set(Object.keys(holidays).map(date => date.slice(0, 4)))].sort();
    const smallScreen = window.matchMedia('(max-width: 600px)');
    let mode = 'list', calendar = null, filtered = [], selectedId = null;
    let yearSelection = '', initialized = false;
    const fromUrl = () => new URL(window.location.href);
    const urlMonth = () => {
      const month = fromUrl().searchParams.get('month');
      return /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') ? `${month}-01` : null;
    };
    function updateUrl(push = false) {
      const url = fromUrl();
      url.searchParams.set('view', mode);
      if (calendar) {
        const date = calendar.getDate();
        url.searchParams.set('month', `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
      window.history[push ? 'pushState' : 'replaceState'](null, '', url);
    }
    function refreshDetail() {
      if (!dialog.open) return;
      const event = filtered.find(e => e.id === selectedId);
      if (!event) { dialog.close(); return; }
      detail.innerHTML = dependencies.renderCard(event);
      dependencies.bindActions(detail);
    }
    function openDetail(id) {
      const event = filtered.find(e => e.id === id);
      if (!event) return;
      selectedId = id;
      detail.innerHTML = dependencies.renderCard(event);
      dependencies.bindActions(detail);
      dialog.showModal();
    }
    function holidayName(date) {
      // FC local date objects: never use UTC serialization for day-cell labels.
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return holidays[key];
    }
    function mountHoliday(info, selector) {
      const name = holidayName(info.date);
      if (!name) return;
      info.el.classList.add('calendar-holiday');
      const label = document.createElement('small');
      label.className = 'calendar-holiday-name';
      label.textContent = name;
      (info.el.querySelector(selector) || info.el).append(label);
    }
    function ensureCalendar() {
      if (calendar) return true;
      if (!window.FullCalendar) {
        panel.hidden = true; list.hidden = false;
        mode = 'list';
        listButton.setAttribute('aria-pressed', 'true'); calendarButton.setAttribute('aria-pressed', 'false');
        if (sort) sort.hidden = false;
        return false;
      }
      const selectedYears = dependencies.getSelectedYears();
      const initialDate = urlMonth() || (selectedYears.length === 1 ? filtered.find(e => e.date.startsWith(selectedYears[0]))?.date || `${selectedYears[0]}-01-01` : dependencies.getToday());
      calendar = new window.FullCalendar.Calendar(document.getElementById('event-calendar'), {
        locale: 'ja', firstDay: 0, initialView: smallScreen.matches ? 'listMonth' : 'dayGridMonth',
        initialDate, now: dependencies.getToday(), height: 'auto', fixedWeekCount: false,
        headerToolbar: { left: 'prev,today,next', center: 'title', right: '' },
        buttonIcons: false, buttonText: { today: '今日', prev: '前月', next: '翌月' },
        titleFormat: { year: 'numeric', month: 'long' },
        noEventsText: 'この月には条件に合うイベントがありません',
        editable: false, dayMaxEvents: 3, displayEventTime: false,
        events: (_info, success) => success(filtered.map(toCalendarEvent)),
        eventClick: info => { info.jsEvent.preventDefault(); openDetail(info.event.id); },
        eventDidMount: info => { info.el.title = info.event.title; info.el.dataset.eventId = info.event.id; },
        dayCellDidMount: info => mountHoliday(info, '.fc-daygrid-day-top'),
        dayHeaderDidMount: info => {
          if (info.el.querySelector('.fc-list-day-cushion')) mountHoliday(info, '.fc-list-day-cushion');
        },
        datesSet: info => {
          const month = `${info.view.currentStart.getFullYear()}-${String(info.view.currentStart.getMonth() + 1).padStart(2, '0')}`;
          const holidayList = document.getElementById('calendar-month-holidays');
          holidayList.replaceChildren();
          for (const [date, name] of Object.entries(holidays).filter(([date]) => date.startsWith(month))) {
            const label = document.createElement('span');
            label.textContent = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ${name}`;
            holidayList.append(label);
          }
          holidayList.hidden = !holidayList.children.length;
          const year = String(info.view.currentStart.getFullYear());
          document.getElementById('calendar-holiday-note').textContent = holidayYears.includes(year)
            ? `祝日：内閣府の確定データ（${holidayYears[0]}〜${holidayYears.at(-1)}年）`
            : `${year}年の祝日データは未収録です。`;
          if (initialized && mode === 'calendar') updateUrl();
        }
      });
      calendar.render();
      initialized = true;
      return true;
    }
    function setMode(nextMode, push = true) {
      mode = nextMode === 'calendar' ? 'calendar' : 'list';
      panel.hidden = mode !== 'calendar'; list.hidden = mode === 'calendar';
      if (sort) sort.hidden = mode === 'calendar';
      listButton.setAttribute('aria-pressed', String(mode === 'list'));
      calendarButton.setAttribute('aria-pressed', String(mode === 'calendar'));
      if (mode === 'calendar' && ensureCalendar()) {
        const targetMonth = urlMonth();
        if (!push && targetMonth) calendar.gotoDate(targetMonth);
        calendar.updateSize();
      }
      if (push) updateUrl(true);
    }
    listButton.addEventListener('click', () => setMode('list'));
    calendarButton.addEventListener('click', () => setMode('calendar'));
    document.getElementById('calendar-event-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { detail.innerHTML = ''; selectedId = null; });
    window.addEventListener('popstate', () => setMode(fromUrl().searchParams.get('view'), false));
    smallScreen.addEventListener('change', () => {
      if (calendar) calendar.changeView(smallScreen.matches ? 'listMonth' : 'dayGridMonth');
    });
    return {
      sync(events) {
        filtered = events;
        const selection = dependencies.getSelectedYears().slice().sort().join(',');
        if (calendar) {
          calendar.refetchEvents();
          if (selection !== yearSelection && dependencies.getSelectedYears().length === 1) {
            const year = dependencies.getSelectedYears()[0];
            if (String(calendar.getDate().getFullYear()) !== year) calendar.gotoDate(filtered.find(e => e.date.startsWith(year))?.date || `${year}-01-01`);
          }
        }
        yearSelection = selection;
        refreshDetail();
        if (!initialized && fromUrl().searchParams.get('view') === 'calendar') setMode('calendar', false);
      },
      getCalendar: () => calendar,
      getMode: () => mode
    };
  }
  const api = { toCalendarEvent, nextDate };
  let view;
  api.init = dependencies => { view = createView(root.document, root, dependencies); };
  api.sync = events => view?.sync(events);
  api.getCalendar = () => view?.getCalendar();
  api.getMode = () => view?.getMode();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OphthalCalendarView = api;
})(typeof window !== 'undefined' ? window : globalThis);
