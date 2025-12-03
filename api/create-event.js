import { google } from 'googleapis';

export default async function handler(req, res) {
  // Gestione CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

  const { booking, serviceAccountJson, targetCalendarId } = req.body;

  if (!serviceAccountJson) return res.status(400).json({ error: 'Mancano le credenziali del Service Account' });

  try {
    const jwtClient = new google.auth.JWT(
      serviceAccountJson.client_email,
      null,
      serviceAccountJson.private_key,
      ['https://www.googleapis.com/auth/calendar']
    );
    await jwtClient.authorize();

    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    const event = {
      summary: `📅 ${booking.service.title} - ${booking.clientName} ${booking.clientSurname}`,
      description: `Cliente: ${booking.clientName} ${booking.clientSurname}\nEmail: ${booking.clientEmail}\nTel: ${booking.clientPhone}\nNote: ${booking.notes || ''}`,
      start: { dateTime: new Date(`${booking.date}T${booking.timeSlot.startTime}:00`).toISOString(), timeZone: 'Europe/Rome' },
      end: { dateTime: new Date(new Date(`${booking.date}T${booking.timeSlot.startTime}:00`).getTime() + booking.service.durationMinutes * 60000).toISOString(), timeZone: 'Europe/Rome' },
    };

    // Scrittura Silenziosa su Calendario Target (Ponte)
    const calendarIdToWrite = targetCalendarId || 'primary';
    const response = await calendar.events.insert({
      calendarId: calendarIdToWrite,
      requestBody: event
    });

    res.status(200).json({ success: true, link: response.data.htmlLink });
  } catch (error) {
    console.error('Errore Google Calendar:', error);
    res.status(500).json({ error: error.message });
  }
}
