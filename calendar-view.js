/* OphthalConf calendar presentation. FullCalendar Standard 6.1.21 (MIT). */
(function(root) {
  'use strict';
  function nextDate(date) {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1);
    return day.toISOString().slice(0, 10);
  }
  function initialMode(view, smallScreen) {
    return ['list', 'calendar', 'compact'].includes(view) ? view : smallScreen ? 'compact' : 'calendar';
  }
  function padZero(n) {
    return String(n).padStart(2, '0');
  }
  function toDateString(date) {
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
  }
  function parseDateParts(dateStr, holidaySource) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const holidayName = holidaySource?.[dateStr] || '';
    const isHoliday = Boolean(holidayName);
    const weekday = date.getDay();
    let colorClass = '';
    if (isHoliday) colorClass = 'compact-date-holiday';
    else if (weekday === 0) colorClass = 'compact-date-sunday';
    else if (weekday === 6) colorClass = 'compact-date-saturday';
    return { date, year: y, month: m, day: d, weekday, isHoliday, holidayName, colorClass };
  }
  function formatCompactHeading(startDate, endDate, holidaySource = (root.OPHTHAL_JAPAN_HOLIDAYS || {}), currentYear = null) {
    const sStr = typeof startDate === 'string' ? startDate : toDateString(startDate);
    const start = parseDateParts(sStr, holidaySource);
    const eStr = endDate ? (typeof endDate === 'string' ? endDate : toDateString(endDate)) : null;
    const isRange = Boolean(eStr && eStr !== sStr);
    const end = isRange ? parseDateParts(eStr, holidaySource) : null;
    const startYearPart = start.year === currentYear && (!end || end.year === start.year) ? '' : `${start.year}年`;
    const startLabel = `${startYearPart}${start.month}月${start.day}日（${'日月火水木金土'[start.weekday]}${start.isHoliday ? '・祝' : ''}）`;
    if (!isRange) {
      return {
        isRange: false,
        start,
        end: null,
        startLabel,
        fullText: startLabel,
        holidays: start.isHoliday ? [{ name: start.holidayName, position: 'start' }] : []
      };
    }
    const endYearPart = end.year !== start.year ? `${end.year}年` : '';
    const endMonthPart = end.year !== start.year || end.month !== start.month ? `${end.month}月` : '';
    const endLabel = `${endYearPart}${endMonthPart}${end.day}日（${'日月火水木金土'[end.weekday]}${end.isHoliday ? '・祝' : ''}）`;
    const holidayList = [];
    if (start.isHoliday) holidayList.push({ name: start.holidayName, position: 'start' });
    if (end.isHoliday && (!start.isHoliday || start.holidayName !== end.holidayName)) {
      holidayList.push({ name: end.holidayName, position: 'end' });
    }
    return {
      isRange: true,
      start,
      end,
      startLabel,
      endLabel,
      fullText: `${startLabel}〜${endLabel}`,
      holidays: holidayList
    };
  }
  function formatCompactDate(date, isHoliday = false) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${'日月火水木金土'[date.getDay()]}${isHoliday ? '・祝' : ''}）`;
  }
  function createHeadingNodes(headingInfo, textId, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc) return [];
    const nodes = [];
    if (headingInfo.isRange) {
      const startSpan = doc.createElement('span');
      startSpan.className = 'compact-date compact-date-start';
      if (headingInfo.start.colorClass) startSpan.classList.add(headingInfo.start.colorClass);
      startSpan.textContent = headingInfo.startLabel;
      if (textId) startSpan.id = textId;
      nodes.push(startSpan);

      const sepSpan = doc.createElement('span');
      sepSpan.className = 'compact-date-separator';
      sepSpan.textContent = '〜';
      nodes.push(sepSpan);

      const endSpan = doc.createElement('span');
      endSpan.className = 'compact-date compact-date-end';
      if (headingInfo.end.colorClass) endSpan.classList.add(headingInfo.end.colorClass);
      endSpan.textContent = headingInfo.endLabel;
      nodes.push(endSpan);
    } else {
      const dateSpan = doc.createElement('span');
      dateSpan.className = 'compact-date';
      if (headingInfo.start.colorClass) dateSpan.classList.add(headingInfo.start.colorClass);
      dateSpan.textContent = headingInfo.startLabel;
      if (textId) dateSpan.id = textId;
      nodes.push(dateSpan);
    }
    for (const h of headingInfo.holidays) {
      const holiday = doc.createElement('small');
      holiday.className = 'calendar-holiday-name';
      holiday.textContent = h.name;
      nodes.push(holiday);
    }
    return nodes;
  }
  function eventDurationDays(event) {
    const start = Date.parse(event.date);
    const end = Date.parse(event.endDate || event.date);
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }
  function compareCompactEvents(a, b, originalOrderMap) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const durA = eventDurationDays(a);
    const durB = eventDurationDays(b);
    if (durA !== durB) return durA - durB;
    if (originalOrderMap) {
      const idxA = originalOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
      const idxB = originalOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
      return idxA - idxB;
    }
    return 0;
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
  function toCompactCalendarEvent(event) {
    // In compact/list view, consolidate multi-day conferences onto their start date.
    return {
      id: event.id, title: event.title, start: event.date,
      end: nextDate(event.date), allDay: true,
      interactive: true,
      classNames: [event.conferenceRegion === 'international' ? 'calendar-international' : 'calendar-domestic'],
      extendedProps: { originalEvent: event, isCompactSingleDay: true }
    };
  }
  function createView(document, window, dependencies) {
    const panel = document.getElementById('calendar-panel');
    const list = document.getElementById('event-list');
    const sort = document.querySelector('.sort-selector-wrapper');
    const listButton = document.getElementById('view-list');
    const calendarButton = document.getElementById('view-calendar');
    const compactButton = document.getElementById('view-compact');
    const dialog = document.getElementById('calendar-event-dialog');
    const detail = document.getElementById('calendar-event-detail');
    const holidays = window.OPHTHAL_JAPAN_HOLIDAYS || {};
    const compactHeading = (start, end) => formatCompactHeading(start, end, holidays, Number(dependencies.getToday().slice(0, 4)));
    const smallScreen = window.matchMedia('(max-width: 600px)');
    const desktopGrid = window.matchMedia('(min-width: 769px)');
    const calendarElement = document.getElementById('event-calendar');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let monthTransition = null;
    function finishMonthTransition() {
      if (!monthTransition) return;
      const { incoming, snapshot, animations } = monthTransition;
      monthTransition = null;
      animations.forEach(animation => animation.cancel());
      snapshot.remove();
      incoming.replaceWith(...incoming.childNodes);
      calendarElement.classList.remove('calendar-sliding');
      calendarElement.removeAttribute('aria-busy');
    }
    function slideMonth(forward) {
      if (monthTransition) return;
      if (reducedMotion.matches || typeof calendarElement.animate !== 'function') {
        if (forward) calendar.next(); else calendar.prev();
        return;
      }
      // Keep the old month visible while FullCalendar immediately renders the new one.
      // Both layers remain inside #event-calendar so date/holiday styling is preserved.
      const snapshot = calendarElement.cloneNode(true);
      snapshot.removeAttribute('id');
      snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      snapshot.classList.add('calendar-slide-snapshot');
      snapshot.setAttribute('aria-hidden', 'true');
      snapshot.inert = true;
      if (forward) calendar.next(); else calendar.prev();
      const incoming = document.createElement('div');
      incoming.className = 'calendar-slide-incoming';
      incoming.append(...calendarElement.childNodes);
      calendarElement.append(incoming, snapshot);
      calendarElement.classList.add('calendar-sliding');
      calendarElement.setAttribute('aria-busy', 'true');
      const direction = forward ? -1 : 1;
      const options = { duration: 200, easing: 'ease-out', fill: 'both' };
      const animations = [
        snapshot.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${direction * 100}%)` }], options),
        incoming.animate([{ transform: `translateX(${-direction * 100}%)` }, { transform: 'translateX(0)' }], options)
      ];
      const transition = { incoming, snapshot, animations };
      monthTransition = transition;
      Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (monthTransition === transition) finishMonthTransition();
      }).catch(() => {
        if (monthTransition === transition) finishMonthTransition();
      });
    }
    window.addEventListener('resize', finishMonthTransition);
    reducedMotion.addEventListener('change', finishMonthTransition);
    desktopGrid.addEventListener('change', () => {
      finishMonthTransition();
      if (calendar) calendar.setOption('dayMaxEvents', desktopGrid.matches ? false : 3);
    });
    let swipe = null, suppressClickUntil = 0;
    calendarElement.addEventListener('pointerdown', event => {
      if (monthTransition) { swipe = null; return; }
      // A new deliberate tap/click must never be swallowed after a swipe.
      suppressClickUntil = 0;
      if (event.pointerType !== 'touch' || !event.isPrimary || mode === 'list') {
        swipe = null;
        return;
      }
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }, { passive: true });
    calendarElement.addEventListener('pointermove', event => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = Math.abs(event.clientX - swipe.x), dy = Math.abs(event.clientY - swipe.y);
      // Lock out vertical gestures early; the browser keeps native scrolling.
      if (dy > 12 && dy > dx) swipe = null;
    }, { passive: true });
    calendarElement.addEventListener('pointercancel', () => { swipe = null; }, { passive: true });
    calendarElement.addEventListener('pointerleave', event => {
      if (swipe?.id === event.pointerId) swipe = null;
    }, { passive: true });
    calendarElement.addEventListener('pointerup', event => {
      const gesture = swipe;
      swipe = null;
      if (monthTransition || !gesture || gesture.id !== event.pointerId || !calendar || mode === 'list') return;
      const dx = event.clientX - gesture.x, dy = Math.abs(event.clientY - gesture.y);
      if (Math.abs(dx) < 60 || Math.abs(dx) < dy * 1.5) return;
      suppressClickUntil = window.performance.now() + 400;
      // Navigate once at release, using datesSet's existing URL synchronization.
      slideMonth(dx < 0);
    }, { passive: true });
    calendarElement.addEventListener('click', event => {
      if (monthTransition) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.detail !== 0 && window.performance.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    let mode = initialMode(new URL(window.location.href).searchParams.get('view'), smallScreen.matches), calendar = null, filtered = [], selectedId = null;
    let firstSync = true;
    let yearSelection = '', initialized = false, switchingMode = false;
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
    function setGridHoliday(cell, name) {
      const top = cell.querySelector('.fc-daygrid-day-top');
      const number = cell.querySelector('.fc-daygrid-day-number');
      cell.classList.toggle('calendar-holiday', Boolean(name));
      top?.querySelectorAll('.calendar-holiday-name').forEach(label => label.remove());
      if (name) {
        cell.dataset.holidayName = name;
        number?.setAttribute('aria-label', `${cell.dataset.date} ${name}`);
      } else {
        delete cell.dataset.holidayName;
      }
    }
    function syncGridHolidays() {
      if (mode !== 'calendar') return;
      calendarElement.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateStr = cell.getAttribute('data-date');
        const name = dateStr ? holidays[dateStr] : null;
        setGridHoliday(cell, name);
      });
    }
    let headerSyncFrame = null;
    function scheduleSyncCompactHeaders() {
      if (headerSyncFrame) window.cancelAnimationFrame(headerSyncFrame);
      headerSyncFrame = window.requestAnimationFrame(() => {
        headerSyncFrame = null;
        syncCompactHeaders();
      });
    }
    function getSortedCompactEvents() {
      const originalOrderMap = new Map(filtered.map((e, idx) => [e, idx]));
      return filtered.slice().sort((a, b) => compareCompactEvents(a, b, originalOrderMap));
    }
    function syncCompactHeaders() {
      if (mode !== 'compact' || !calendarElement) return;
      const tbody = calendarElement.querySelector('.fc-list-table tbody');
      if (!tbody) return;

      tbody.querySelectorAll('tr[data-compact-injected="true"]').forEach(el => el.remove());

      const eventMap = new Map(filtered.map(e => [e.id, e]));
      let currentNativeDay = null;
      let lastEventEndDate = null;

      const rows = Array.from(tbody.children);
      for (const row of rows) {
        if (row.classList.contains('fc-list-day')) {
          currentNativeDay = row;
          lastEventEndDate = null;
          continue;
        }
        if (row.classList.contains('fc-list-event')) {
          const event = eventMap.get(row.dataset.eventId);
          if (!event) continue;
          const eventEndDate = event.endDate || event.date;

          if (lastEventEndDate === null) {
            lastEventEndDate = eventEndDate;
            if (currentNativeDay) {
              const cushion = currentNativeDay.querySelector('.fc-list-day-cushion');
              if (cushion) {
                const headingInfo = compactHeading(event.date, event.endDate);
                cushion.innerHTML = '';
                cushion.append(...createHeadingNodes(headingInfo, null, document));
                if (headingInfo.holidays.length > 0) {
                  currentNativeDay.classList.add('calendar-holiday');
                } else {
                  currentNativeDay.classList.remove('calendar-holiday');
                }
              }
            }
          } else if (eventEndDate !== lastEventEndDate) {
            const injectedTr = document.createElement('tr');
            injectedTr.className = 'fc-list-day';
            injectedTr.dataset.date = event.date;
            injectedTr.dataset.compactInjected = 'true';

            const headingInfo = compactHeading(event.date, event.endDate);
            if (headingInfo.holidays.length > 0) {
              injectedTr.classList.add('calendar-holiday');
            }

            const th = document.createElement('th');
            th.colSpan = 3;
            th.scope = 'colgroup';

            const cushion = document.createElement('div');
            cushion.className = 'fc-list-day-cushion fc-cell-shaded';
            cushion.append(...createHeadingNodes(headingInfo, null, document));

            th.appendChild(cushion);
            injectedTr.appendChild(th);

            row.before(injectedTr);
            lastEventEndDate = eventEndDate;
          }
        }
      }
    }
    function ensureCalendar() {
      if (calendar) return true;
      if (!window.FullCalendar) {
        panel.hidden = true; list.hidden = false;
        mode = 'list';
        listButton.setAttribute('aria-pressed', 'true'); calendarButton.setAttribute('aria-pressed', 'false');
        compactButton.setAttribute('aria-pressed', 'false');
        if (sort) sort.hidden = false;
        return false;
      }
      const selectedYears = dependencies.getSelectedYears();
      const initialDate = urlMonth() || (selectedYears.length === 1 ? filtered.find(e => e.date.startsWith(selectedYears[0]))?.date || `${selectedYears[0]}-01-01` : dependencies.getToday());
      calendar = new window.FullCalendar.Calendar(document.getElementById('event-calendar'), {
        locale: 'ja', firstDay: 1, initialView: mode === 'compact' ? 'listMonth' : 'dayGridMonth',
        initialDate, now: dependencies.getToday(), height: 'auto', fixedWeekCount: false,
        headerToolbar: { left: 'prev,today,next', center: 'title', right: '' },
        buttonIcons: false, buttonText: { today: '今月', prev: '前月', next: '翌月' },
        titleFormat: { year: 'numeric', month: 'long' },
        eventOrder: 'compactOrder,start,-duration,allDay,title',
        views: {
          dayGridMonth: {
            dayCellContent: info => String(info.date.getDate())
          },
          listMonth: {
            listDaySideFormat: false,
            dayHeaderContent: info => {
              const dayStr = toDateString(info.date);
              const dayEvents = getSortedCompactEvents().filter(e => e.date === dayStr);
              const firstEvent = dayEvents[0];
              const headingInfo = compactHeading(info.date, firstEvent ? firstEvent.endDate : null);
              return { domNodes: createHeadingNodes(headingInfo, info.textId, document) };
            },
            dayHeaderDidMount: info => {
              const dayStr = toDateString(info.date);
              const dayEvents = getSortedCompactEvents().filter(e => e.date === dayStr);
              const firstEvent = dayEvents[0];
              const headingInfo = compactHeading(info.date, firstEvent ? firstEvent.endDate : null);
              if (headingInfo.holidays.length > 0) info.el.classList.add('calendar-holiday');
            }
          }
        },
        noEventsText: 'この月には条件に合うイベントがありません',
        editable: false, dayMaxEvents: desktopGrid.matches ? false : 3, displayEventTime: false,
        events: (_info, success) => {
          const isCompact = mode === 'compact';
          if (isCompact) {
            const sorted = getSortedCompactEvents();
            const fcEvents = sorted.map((event, index) => {
              const fcEvent = toCompactCalendarEvent(event);
              fcEvent.extendedProps.compactOrder = index;
              return fcEvent;
            });
            success(fcEvents);
          } else {
            success(filtered.map(toCalendarEvent));
          }
        },
        eventClick: info => { info.jsEvent.preventDefault(); openDetail(info.event.id); },
        eventContent: info => {
          if (info.view.type !== 'dayGridMonth') return true;
          const full = document.createElement('span');
          full.className = 'fc-event-title calendar-event-title-full';
          full.textContent = info.event.title;
          const short = document.createElement('span');
          short.className = 'fc-event-title calendar-event-title-mobile';
          short.textContent = info.event.title.replace(/^第\s*[0-9０-９]+\s*回[\s　]*/, '');
          return { domNodes: [full, short] };
        },
        eventDidMount: info => {
          info.el.title = info.event.title;
          info.el.dataset.eventId = info.event.id;
          if (mode === 'compact') scheduleSyncCompactHeaders();
        },
        dayCellClassNames: info => (holidayName(info.date) ? ['calendar-holiday'] : []),
        dayCellDidMount: info => setGridHoliday(info.el, holidayName(info.date)),
        datesSet: () => {
          syncGridHolidays();
          if (mode === 'compact') scheduleSyncCompactHeaders();
          if (initialized && mode !== 'list' && !switchingMode) updateUrl();
        },
        windowResize: () => {
          if (mode === 'compact') scheduleSyncCompactHeaders();
        }
      });
      calendar.render();
      initialized = true;
      return true;
    }
    function setMode(nextMode, push = true) {
      finishMonthTransition();
      switchingMode = true;
      const prevMode = mode;
      mode = initialMode(nextMode, smallScreen.matches);
      panel.hidden = mode === 'list'; list.hidden = mode !== 'list';
      panel.dataset.view = mode;
      if (sort) sort.hidden = mode !== 'list';
      listButton.setAttribute('aria-pressed', String(mode === 'list'));
      calendarButton.setAttribute('aria-pressed', String(mode === 'calendar'));
      compactButton.setAttribute('aria-pressed', String(mode === 'compact'));
      if (mode !== 'list' && ensureCalendar()) {
        const targetMonth = urlMonth();
        const viewType = mode === 'compact' ? 'listMonth' : 'dayGridMonth';
        const viewChanged = calendar.view.type !== viewType;
        if (viewChanged) {
          calendar.changeView(viewType);
        }
        if (prevMode !== mode) {
          calendar.refetchEvents();
        }
        if (!push && targetMonth) calendar.gotoDate(targetMonth);
        calendar.updateSize();
        if (mode === 'compact') scheduleSyncCompactHeaders();
      }
      switchingMode = false;
      if (push) updateUrl(true);
    }
    listButton.addEventListener('click', () => setMode('list'));
    calendarButton.addEventListener('click', () => setMode('calendar'));
    compactButton.addEventListener('click', () => setMode('compact'));
    document.getElementById('calendar-event-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { detail.innerHTML = ''; selectedId = null; });
    window.addEventListener('popstate', () => setMode(fromUrl().searchParams.get('view'), false));
    return {
      sync(events) {
        finishMonthTransition();
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
        if (firstSync) {
          firstSync = false;
          setMode(mode, false);
          updateUrl();
        }
      },
      getCalendar: () => calendar,
      getMode: () => mode
    };
  }
  const api = {
    toCalendarEvent,
    toCompactCalendarEvent,
    nextDate,
    initialMode,
    formatCompactDate,
    formatCompactHeading,
    eventDurationDays,
    compareCompactEvents
  };
  let view;
  api.init = dependencies => { view = createView(root.document, root, dependencies); };
  api.sync = events => view?.sync(events);
  api.getCalendar = () => view?.getCalendar();
  api.getMode = () => view?.getMode();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OphthalCalendarView = api;
})(typeof window !== 'undefined' ? window : globalThis);
