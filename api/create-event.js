import { google } from 'googleapis';

export default async function handler(req, res) {
  // 1. Gestione CORS (per permettere al sito di chiamare il server)
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

  const { booking, serviceAccountJson } = req.body;

  if (!serviceAccountJson) {
    return res.status(400).json({ error: 'Mancano le credenziali del Service Account (Robot)' });
  }

  try {
    // 2. Autenticazione del Robot Google
    // Usiamo le credenziali JSON passate dal frontend (che le ha prese da Supabase)
    const jwtClient = new google.auth.JWT(
      serviceAccountJson.client_email,
      null,
      serviceAccountJson.private_key,
      ['https://www.googleapis.com/auth/calendar']
    );

    await jwtClient.authorize();

    const calendar = google.calendar({ version: 'v3', auth: jwtClient });

    // 3. Preparazione Evento
    // Convertiamo data e ora in formato Google ISO
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
      // 4. INVITIAMO IL CLIENTE (Business Owner)
      // Così l'evento appare anche sul SUO calendario personale
      attendees: [
        // { email: booking.clientEmail }, // Opzionale: invita anche l'utente finale
        // Qui invitiamo il proprietario del calendario (quello che abbiamo configurato come "owner")
        // Nota: Il frontend deve passarci l'email del proprietario se vogliamo invitarlo esplicitamente,
        // ma se scriviamo sul calendario condiviso, apparirà comunque.
      ],
    };

    // 5. Scrittura sul Calendario "Ponte" (o quello del Robot)
    // 'primary' usa il calendario principale del Robot.
    // Se il Robot ha accesso al calendario 'open2agency@gmail.com', possiamo usare quell'email come calendarId.
    // Per ora usiamo 'primary' del Robot e invitiamo gli altri, è più sicuro.
    const calendarId = 'primary'; 

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    console.log('Evento creato:', response.data.htmlLink);
    res.status(200).json({ success: true, link: response.data.htmlLink });

  } catch (error) {
    console.error('Errore Google Calendar:', error);
    res.status(500).json({ error: error.message, details: error });
  }
}
