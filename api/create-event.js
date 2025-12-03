import { google } from 'googleapis';

export default async function handler(req, res) {
  // 1. Gestione CORS (per permettere chiamate dal sito)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

  // Ora riceviamo anche 'targetCalendarId'
  const { booking, serviceAccountJson, ownerEmail, targetCalendarId } = req.body;

  if (!serviceAccountJson) {
    return res.status(400).json({ error: 'Mancano le credenziali del Service Account (Robot)' });
  }

  try {
    // 2. Autenticazione del Robot Google
    const jwtClient = new google.auth.JWT(
      serviceAccountJson.client_email,
      null,
      serviceAccountJson.private_key,
      ['https://www.googleapis.com/auth/calendar']
    );

    await jwtClient.authorize();

    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // 3. Preparazione Evento
    const startDateTime = new Date(`${booking.date}T${booking.timeSlot.startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + booking.service.durationMinutes * 60000);

    const event = {
      summary: `📅 ${booking.service.title} - ${booking.clientName} ${booking.clientSurname}`,
      description: `Prenotazione da Open2Agenda.\nCliente: ${booking.clientName} ${booking.clientSurname}\nEmail: ${booking.clientEmail}\nTel: ${booking.clientPhone}\nNote: ${booking.notes || ''}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Europe/Rome',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Europe/Rome',
      },
      attendees: [
        { email: ownerEmail }, // Invita il proprietario (Badhead)
      ],
    };

    // 4. Scrittura sul Calendario TARGET (open2agency) invece che 'primary'
    // Se targetCalendarId non è fornito, fallback a 'primary' (calendario del robot)
    const calendarIdToWrite = targetCalendarId || 'primary';

    const response = await calendar.events.insert({
      calendarId: calendarIdToWrite,
      requestBody: event,
      sendUpdates: 'all', // Manda notifiche agli invitati
    });

    console.log('Evento creato:', response.data.htmlLink);
    res.status(200).json({ success: true, link: response.data.htmlLink });

  } catch (error) {
    console.error('Errore Google Calendar:', error);
    res.status(500).json({ error: error.message, details: error });
  }
}
