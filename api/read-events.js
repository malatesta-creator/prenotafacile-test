import { google } from 'googleapis';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { date, serviceAccountJson, targetCalendarId } = req.body;

  if (!serviceAccountJson || !targetCalendarId || !date) {
    return res.status(400).json({ error: 'Dati mancanti (date, serviceAccountJson, targetCalendarId)' });
  }

  try {
    // 1. Autenticazione Robot
    const jwtClient = new google.auth.JWT(
      serviceAccountJson.client_email,
      null,
      serviceAccountJson.private_key,
      ['https://www.googleapis.com/auth/calendar.readonly']
    );

    await jwtClient.authorize();
    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // 2. Calcolo Range Temporale (Tutto il giorno in UTC)
    const timeMin = new Date(`${date}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${date}T23:59:59Z`).toISOString();

    // 3. Fetch Eventi
    const response = await calendar.events.list({
      calendarId: targetCalendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    // 4. Privacy e Pulizia Dati
    const cleanEvents = (response.data.items || []).map(event => ({
        id: event.id,
        start: event.start.dateTime || event.start.date, 
        end: event.end.dateTime || event.end.date,
    }));

    res.status(200).json({ success: true, events: cleanEvents });

  } catch (error) {
    console.error('Errore Backend Lettura:', error);
    res.status(500).json({ error: error.message, events: [] });
  }
}
