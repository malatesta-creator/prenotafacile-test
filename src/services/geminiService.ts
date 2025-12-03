import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
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

export const fetchRealGoogleCalendarEvents = async (dateStr: string, config?: ClientConfig): Promise<CalendarEvent[]> => {
  const apiKey = config?.google_api_key;
  const calendarId = config?.email_bridge;

  if (!apiKey || !calendarId || apiKey.includes('INCOLLA_QUI')) {
    console.warn("⚠️ Dati Google Calendar mancanti nella configurazione del cliente.");
    return getMockCalendarEvents(dateStr);
  }

  try {
    const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Google API Error: ${response.statusText}`);
      return getMockCalendarEvents(dateStr);
    }

    const data = await response.json();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: CalendarEvent[] = (data.items || []).map((item: any) => {
      const start = item.start.dateTime || item.start.date;
      const end = item.end.dateTime || item.end.date;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
      const startTime = startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const title = item.summary || 'Non Disponibile (Privato)';
      return { id: item.id, title: title, startTime: startTime, durationMinutes: durationMinutes };
    });
    return events;
  } catch (error) {
    console.error("Failed to fetch real calendar events:", error);
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
    try {
        if (!serviceAccountJson) {
            console.warn("⚠️ Nessun JSON Service Account fornito. Salto scrittura calendario automatica.");
            return false;
        }

        console.log(`🔄 Chiamata al Server Backend per scrivere su ${targetCalendarId}...`);
        
        const response = await fetch('/api/create-event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                booking: booking,
                serviceAccountJson: serviceAccountJson,
                ownerEmail: ownerEmail,
                targetCalendarId: targetCalendarId // Passiamo l'email ponte
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Errore Server');
        }

        const data = await response.json();
        console.log("✅ Evento creato su Calendar!", data.link);
        return true;

    } catch (error) {
        console.error("❌ Errore scrittura calendario:", error);
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
            console.log("✅ EMAIL INVIATA CON SUCCESSO");
            return true;
        } catch (error) {
            console.error("❌ ERRORE INVIO EMAIL:", error);
            return false;
        }
    } else {
        console.warn("⚠️ Credenziali EmailJS mancanti nel database per questo cliente.");
        return true;
    }
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
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    return true;
}
