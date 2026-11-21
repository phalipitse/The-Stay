// The Stay booking page. Rooms, prices and availability all come from the stay-payments service,
// so changing rates there updates this page with no edit here.
(() => {
  const API = String(window.STAY_CONFIG?.paymentsUrl || '').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const form = $('booking');
  let rooms = [];
  let policy = { maxMonths: 12 };
  let quoteSeq = 0;

  const money = (cents) => {
    const [r, c] = (cents / 100).toFixed(2).split('.');
    return `R ${r.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${c}`;
  };
  const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const mode = () => form.mode.value;
  const selectedRoom = () => rooms.find((r) => r.id === form.room?.value);

  function showError(msg) { $('error').textContent = msg; $('error').hidden = !msg; }

  async function api(path, body) {
    const res = await fetch(API + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  function renderRooms() {
    const m = mode();
    const list = rooms.filter((r) => (m === 'monthly' ? r.monthlyRateCents : true));
    const keep = form.room?.value;
    $('rooms').innerHTML = '';
    if (!list.length) { $('rooms').innerHTML = '<p class="muted">No rooms available for this type of stay.</p>'; return; }
    for (const r of list) {
      const label = document.createElement('label');
      label.className = 'room';
      const price = m === 'monthly' ? r.monthlyRateCents : r.nightlyRateCents;
      label.innerHTML = `<input type="radio" name="room" required><span class="name"></span><span class="price">${money(price)}<small>per ${m === 'monthly' ? 'month' : 'night'}</small></span>`;
      const input = label.querySelector('input');
      input.value = r.id;
      input.checked = r.id === keep;
      const name = label.querySelector('.name');
      name.textContent = r.name;
      const note = document.createElement('small');
      note.textContent = `Up to ${r.maxGuests} guest${r.maxGuests > 1 ? 's' : ''}${m === 'nightly' && r.minNights > 1 ? ` · min ${r.minNights} nights` : ''}`;
      name.appendChild(note);
      $('rooms').appendChild(label);
    }
    if (!form.room || ![...(form.room.length ? form.room : [form.room])].some((i) => i.checked)) {
      const first = $('rooms').querySelector('input');
      if (first) first.checked = true;
    }
  }

  function renderGuests() {
    const max = selectedRoom()?.maxGuests || 1;
    const cur = Number(form.guests.value) || 1;
    form.guests.innerHTML = Array.from({ length: max }, (_, i) => `<option>${i + 1}</option>`).join('');
    form.guests.value = String(Math.min(cur, max));
  }

  function renderMode() {
    const m = mode();
    document.querySelectorAll('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== m; });
    $('check_out').required = m === 'nightly';
    renderRooms();
    renderGuests();
    requestQuote();
  }

  function bookingInput() {
    const m = mode();
    return {
      roomId: form.room?.value,
      checkIn: form.check_in.value,
      ...(m === 'monthly' ? { months: Number(form.months.value) } : { checkOut: form.check_out.value }),
      guests: Number(form.guests.value) || 1,
    };
  }

  async function requestQuote() {
    const q = bookingInput();
    const seq = ++quoteSeq;
    showError('');
    if (!q.roomId || !q.checkIn || (mode() === 'nightly' && !q.checkOut)) { $('quote').hidden = true; return; }
    try {
      const r = await api('/api/quote', q);
      if (seq !== quoteSeq) return;
      $('quote').hidden = false;
      $('quote-label').textContent = r.pricing === 'monthly' ? `${r.months} month${r.months > 1 ? 's' : ''}` : `${r.nights} night${r.nights > 1 ? 's' : ''}`;
      $('quote-total').textContent = money(r.amountCents);
      const out = new Date(`${r.checkOut}T12:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      $('quote-detail').textContent = r.available ? `Until ${out}. Available.` : 'Sorry, this room is fully booked for those dates. Try other dates or another room.';
      $('submit').disabled = !r.available;
    } catch (e) {
      if (seq !== quoteSeq) return;
      $('quote').hidden = true;
      showError(e.message);
    }
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'mode') return renderMode();
    if (e.target.name === 'room') renderGuests();
    if (e.target.id === 'check_in' && mode() === 'nightly') {
      $('check_out').min = addDays(form.check_in.value, 1);
      if (!form.check_out.value || form.check_out.value <= form.check_in.value) form.check_out.value = addDays(form.check_in.value, Math.max(1, selectedRoom()?.minNights || 1));
    }
    if (['room', 'check_in', 'check_out', 'months', 'guests'].includes(e.target.name)) requestQuote();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    if (!form.reportValidity()) return;
    const btn = $('submit');
    btn.disabled = true;
    btn.textContent = 'Holding your room…';
    try {
      const r = await api('/api/bookings', {
        ...bookingInput(),
        guestName: $('name').value,
        guestEmail: $('email').value,
        guestPhone: $('phone').value,
      });
      location.href = r.payUrl;
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Continue to payment';
    }
  });

  async function init() {
    const today = todayIso();
    form.check_in.min = today;
    form.check_out.min = addDays(today, 1);
    try {
      const data = await api('/api/rooms');
      rooms = data.rooms || [];
      policy = { ...policy, ...(data.policy || {}) };
    } catch {
      $('rooms').innerHTML = '<p class="error">We couldn\'t load rooms right now. Please refresh, or contact us to book.</p>';
      $('submit').disabled = true;
      return;
    }
    form.months.innerHTML = Array.from({ length: policy.maxMonths }, (_, i) => `<option value="${i + 1}">${i + 1} month${i ? 's' : ''}</option>`).join('');
    if (policy.cancellationFeePercent !== undefined) {
      $('cancel-policy').textContent = `You can cancel from your booking page after paying, before your check-in date. A ${policy.cancellationFeePercent}% cancellation fee applies; the rest is refunded once your payment has cleared at our bank.`;
    }
    if (policy.holdMinutesCard && policy.holdHoursEft) {
      $('hold-text').textContent = `${policy.holdMinutesCard} minutes for card, ${policy.holdHoursEft} hours for EFT`;
    }
    // Default to the nightly view if no room rents monthly
    if (!rooms.some((r) => r.monthlyRateCents)) form.querySelector('input[name="mode"][value="nightly"]').checked = true;
    renderMode();
  }

  init();
})();
