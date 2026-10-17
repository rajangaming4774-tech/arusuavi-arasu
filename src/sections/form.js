import { SITE } from '../config.js';

/*
 * Enquiry form. With a Web3Forms key in src/config.js it emails the enquiry;
 * without one (or if sending fails) it opens WhatsApp with the details filled in,
 * so an enquiry is never lost.
 */
export default function enquiryForm(form) {
  const status = form.querySelector('[data-form-status]');

  // Pre-select the event type when arriving from a service page (?event=wedding)
  const preset = { wedding: 'Wedding', corporate: 'Corporate event', theme: 'Theme-based event', catering: 'Catering only' }[
    new URLSearchParams(location.search).get('event')
  ];
  if (preset) form.elements.event_type.value = preset;
  const submit = form.querySelector('[type="submit"]');

  const setStatus = (msg, type = '') => {
    status.textContent = msg;
    status.dataset.type = type;
  };

  function whatsappText(data) {
    const lines = [
      'Hello Arusuvai Arasu, I would like to enquire about an event.',
      `Name: ${data.name}`,
      `Phone: ${data.phone}`,
      data.email && `Email: ${data.email}`,
      `Event: ${data.event_type}`,
      data.event_date && `Date: ${data.event_date}`,
      data.guests && `Guests: ${data.guests}`,
      data.location && `Location: ${data.location}`,
      data.message && `Details: ${data.message}`,
    ];
    return lines.filter(Boolean).join('\n');
  }
  const openWhatsApp = (data) =>
    window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(whatsappText(data))}`, '_blank', 'noopener');

  form.querySelector('[data-form-whatsapp]')?.addEventListener('click', () => {
    if (!form.reportValidity()) return;
    openWhatsApp(Object.fromEntries(new FormData(form)));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.botcheck) return; // honeypot filled: bot

    if (!SITE.web3formsKey) {
      openWhatsApp(data);
      setStatus('Opening WhatsApp with your enquiry. Press send there to reach our team.', 'ok');
      return;
    }

    submit.disabled = true;
    setStatus('Sending your enquiry…');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: SITE.web3formsKey,
          subject: `New ${data.event_type} enquiry from ${data.name}`,
          from_name: 'Arusuvai Arasu website',
          ...data,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      form.reset();
      setStatus('Thank you! Our team will call you back soon.', 'ok');
    } catch {
      setStatus('We couldn’t send that. Opening WhatsApp instead so your enquiry still reaches us.', 'error');
      openWhatsApp(data);
    } finally {
      submit.disabled = false;
    }
  });
}
