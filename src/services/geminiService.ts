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

// --- LETTURA CALENDARIO (SERVER-SIDE) ---
// Ora passa attraverso api/read-events per poter leggere calendari PRIVATI usando il Service Account
export const fetchRealGoogleCalendarEvents = async (dateStr: string, config?: ClientConfig): Promise<CalendarEvent[]> => {
  const targetCalendarId = config?.email_owner;
  const serviceAccountJson = config?.service_account_json;

  // Se siamo in localhost o mancano le credenziali, usiamo i mock per non bloccare lo sviluppo
  if (!targetCalendarId || !serviceAccountJson || window.location.hostname.includes('localhost')) {
    if (window.location.hostname.includes('localhost')) {
       console.warn("⚠️ LOCALHOST DETECTED: Uso dati mock per lettura calendario (le API Vercel non girano in locale senza setup specifico).");
    }
    return getMockCalendarEvents(dateStr);
  }

  try {
      console.log(`📅 Lettura calendario via Server per: ${targetCalendarId}`);
      
      const response = await fetch('/api/read-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              date: dateStr,
              serviceAccountJson: JSON.parse(serviceAccountJson),
              targetCalendarId: targetCalendarId
          }),
      });
      
      if (!response.ok) {
        console.warn(`Errore API lettura calendario: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      // Mappiamo la risposta del server nel formato dell'app
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.events || []).map((item: any) => {
         // Calcolo durata
         const start = new Date(item.start);
         const end = new Date(item.end);
         const durationMinutes = (end.getTime() - start.getTime()) / 60000;
         
         return { 
          id: item.id || 'evt', 
          title: 'Occupato', 
          startTime: start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), 
          durationMinutes: durationMinutes 
        };
      });

  } catch (error) {
    console.error("Errore fetch calendario server-side:", error);
    return getMockCalendarEvents(dateStr);
  }
};

export interface ValidationResult { isValid: boolean; message: string; }

export const validateBookingAvailability = async (booking: BookingDetails, config?: ClientConfig): Promise<ValidationResult> => {
  try {
    const apiKey = config?.google_api_key;
    if (!apiKey) return { isValid: true, message: "Configurazione calendario mancante. Procedo." };

    // Passiamo config per permettere la lettura tramite Service Account
    const events = await fetchRealGoogleCalendarEvents(booking.date, config);
    
    // Se non ci sono eventi (o array vuoto), Gemini confermerà disponibilità
    const client = getAIClient(apiKey);
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

// --- SCRITTURA SUL CALENDARIO (SERVER-SIDE) ---
export const createCalendarBooking = async (booking: BookingDetails, serviceAccountJson: any, ownerEmail: string, targetCalendarId: string): Promise<boolean> => {
    
    // CHECK LOCALHOST
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn("⚠️ SEI IN LOCALE (LOCALHOST): Scrittura simulata.");
        alert("SIMULAZIONE SCRITTURA CALENDARIO\n\nTarget: " + targetCalendarId + "\n\n(In produzione su Vercel scriverebbe davvero)");
        return true;
    }

    try {
        if (!serviceAccountJson) {
            console.warn("⚠️ Nessun JSON Service Account fornito. Salto scrittura.");
            return false;
        }

        console.log(`🔄 Scrittura diretta su Calendar ID: ${targetCalendarId}`);
        
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
            alert(`ATTENZIONE: Errore scrittura Calendario.\n\nGoogle risponde: "${data.error}"\n\nDettagli: Verifica che il Robot (client_email nel JSON) abbia il permesso "Apportare modifiche agli eventi" sul calendario di ${targetCalendarId}.`);
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
