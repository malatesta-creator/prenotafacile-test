import { GoogleGenAI } from "@google/genai";
import emailjs from '@emailjs/browser';
import { BookingDetails, CalendarEvent, Booking, BookingStatus, ClientConfig } from '../types';
import { getMockCalendarEvents } from '../constants';

const getAIClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export const generateBookingConfirmation = async (booking: BookingDetails, config?: ClientConfig): Promise<string> => {
  try {
    const apiKey = config?.google_api_key;
    if (!apiKey) return "Grazie! La tua prenotazione è stata confermata.";

    const client = getAIClient(apiKey);
    const model = 'gemini-2.5-flash';
    const prompt = `
      Sei un assistente virtuale professionale. Prenotazione: ${booking.service.title}, ${booking.date} ore ${booking.timeSlot.startTime}, Cliente: ${booking.clientName}. Genera messaggio conferma breve.
    `;
    const response = await client.models.generateContent({ model, contents: prompt });
    return response.text || "Grazie! La tua prenotazione è stata confermata con successo.";
  } catch (error) {
    console.error("Error generating confirmation:", error);
    return "Grazie! La tua prenotazione è stata registrata correttamente.";
  }
};

// --- LOGICA DOPPIO CONTROLLO (Ponte + Proprietario) ---
export const fetchRealGoogleCalendarEvents = async (dateStr: string, config?: ClientConfig): Promise<CalendarEvent[]> => {
  const apiKey = config?.google_api_key;
  
  // Definiamo quali calendari controllare: Ponte E Proprietario
  const calendarsToCheck = Array.from(new Set([
    config?.email_bridge, 
    config?.email_owner
  ].filter((email): email is string => !!email && email.trim() !== '')));

  if (!apiKey || calendarsToCheck.length === 0 || apiKey.includes('INCOLLA_QUI')) {
    console.warn("⚠️ Configurazione Google Calendar incompleta. Uso dati Mock.");
    return getMockCalendarEvents(dateStr);
  }

  const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();

  // Funzione Helper per scaricare un singolo calendario
  const fetchCalendar = async (calendarId: string): Promise<CalendarEvent[]> => {
    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
      const response = await fetch(url);
      
      if (!response.ok) {
        // Log specifico per debuggare i permessi
        console.warn(`Impossibile leggere calendario ${calendarId} (Status: ${response.status}). Verifica che sia 'Pubblico' o condiviso.`);
        return [];
      }

      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.items || []).map((item: any) => {
        const start = item.start.dateTime || item.start.date;
        const end = item.end.dateTime || item.end.date;
        const startDate = new Date(start);
        const endDate = new Date(end);
        const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
        const startTime = startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        return { 
          id: item.id, 
          title: 'Non Disponibile', 
          startTime: startTime, 
          durationMinutes: durationMinutes 
        };
      });
    } catch (error) {
      console.error(`Errore fetch calendario ${calendarId}:`, error);
      return [];
    }
  };

  try {
    const results = await Promise.all(calendarsToCheck.map(id => fetchCalendar(id)));
    return results.flat();
  } catch (error) {
    console.error("Errore generale fetch calendari:", error);
    return getMockCalendarEvents(dateStr);
  }
};

export interface ValidationResult { isValid: boolean; message: string; }

export const validateBookingAvailability = async (booking: BookingDetails, config?: ClientConfig): Promise<ValidationResult> => {
  try {
    const apiKey = config?.google_api_key;
    if (!apiKey) return { isValid: true, message: "Configurazione calendario mancante. Procedo." };

    const client = getAIClient(apiKey);
    const events = await fetchRealGoogleCalendarEvents(booking.date, config);
    
    const verificationPrompt = `
      Calendar Data: ${JSON.stringify(events)}. 
      Request: ${booking.timeSlot.startTime} for ${booking.service.durationMinutes} min. 
      Check overlap strictly. 
      Return JSON {"valid": boolean, "message": "string"}
    `;
    
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: verificationPrompt,
      config: { responseMimeType: 'application/json' }
    });
    
    const resultText = response.text;
    if (resultText) return JSON.parse(resultText);
    return { isValid: true, message: "Verified." };
  } catch (error) {
    console.error("Validation error:", error);
    return { isValid: true, message: "Impossibile verificare disponibilità live. Procedo." };
  }
};

// --- SCRITTURA SUL CALENDARIO (BACKEND) ---
export const createCalendarBooking = async (booking: BookingDetails, serviceAccountJson: any, ownerEmail: string, targetCalendarId: string): Promise<boolean> => {
    
    // CHECK LOCALHOST (Per evitare errori 404 in sviluppo locale)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn("⚠️ SEI IN LOCALE (LOCALHOST): Il backend Vercel '/api/create-event' non esiste qui.");
        console.warn("⚠️ SIMULO IL SUCCESSO. In produzione (su Vercel) funzionerà veramente.");
        alert("SIMULAZIONE SCRITTURA CALENDARIO\n\nSei in localhost, quindi il backend serverless non è attivo.\nIn produzione, l'evento verrebbe scritto su: " + targetCalendarId);
        return true;
    }

    try {
        if (!serviceAccountJson) {
            console.warn("⚠️ Nessun JSON Service Account fornito. Salto scrittura.");
            return false;
        }

        console.log(`🔄 Tentativo scrittura su Calendar ID: ${targetCalendarId}...`);
        
        const response = await fetch('/api/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                booking,
                serviceAccountJson,
                ownerEmail,
                targetCalendarId
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Errore Google Calendar API:", data);
            // Alert fondamentale per capire se i permessi mancano
            alert(`ATTENZIONE: Errore scrittura Calendario.\n\nGoogle risponde: "${data.error}"\n\nDettagli: L'utente robot non riesce a scrivere su ${targetCalendarId}. Controlla i permessi.`);
            return false;
        }

        console.log("✅ Evento creato su Calendar!", data.link);
        return true;

    } catch (error) {
        console.error("❌ Errore rete/server:", error);
        return false;
    }
};

export const sendConfirmationEmails = async (booking: BookingDetails, config?: ClientConfig): Promise<boolean> => {
    if (!config) return false;
    const { emailjs_service_id, emailjs_template_id, emailjs_public_key, email_owner } = config;
    
    if (emailjs_service_id && emailjs_template_id && emailjs_public_key) {
        try {
            const templateParams = {
                client_name: `${booking.clientName} ${booking.clientSurname}`,
                client_email: booking.clientEmail,
                client_phone: booking.clientPhone,
                service_name: booking.service.title,
                date: booking.date,
                time: booking.timeSlot.startTime,
                notes: booking.notes || 'Nessuna',
                owner_email: email_owner
            };
            await emailjs.send(emailjs_service_id, emailjs_template_id, templateParams, emailjs_public_key);
            console.log("✅ EMAIL INVIATA");
            return true;
        } catch (error) {
            console.error("❌ ERRORE EMAIL:", error);
            return false;
        }
    }
    return true;
};

export const sendBookingStatusEmail = async (booking: Booking, status: BookingStatus, config?: ClientConfig): Promise<boolean> => {
    if (!config) return false;
    const { emailjs_service_id, emailjs_template_id, emailjs_public_key } = config;
    if (emailjs_service_id && emailjs_template_id && emailjs_public_key) {
         try {
            const templateParams = {
                client_name: booking.clientName,
                client_email: booking.clientEmail,
                service_name: booking.service.title,
                date: booking.date,
                time: booking.timeSlot.startTime,
                notes: `AGGIORNAMENTO STATO: La tua prenotazione è ora: ${status}`,
                owner_email: config.email_owner
            };
            await emailjs.send(emailjs_service_id, emailjs_template_id, templateParams, emailjs_public_key);
            return true;
        } catch (error) { return false; }
    }
    return true;
}
