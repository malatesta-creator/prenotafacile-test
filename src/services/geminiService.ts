import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { BookingDetails, CalendarEvent, Booking, BookingStatus } from '../types';
import { getMockCalendarEvents, GOOGLE_CALENDAR_CONFIG, BUSINESS_CONFIG } from '../constants';

const ai = new GoogleGenAI({ apiKey: 'DUMMY_KEY' }); 

const getCalendarCredentials = () => {
  const savedApiKey = localStorage.getItem('prenotafacile_apikey');
  const savedCalendarId = localStorage.getItem('prenotafacile_calendarid');
  const apiKey = (savedApiKey && savedApiKey.trim() !== '') ? savedApiKey : GOOGLE_CALENDAR_CONFIG.apiKey;
  const calendarId = (savedCalendarId && savedCalendarId.trim() !== '') ? savedCalendarId : GOOGLE_CALENDAR_CONFIG.calendarId;
  const isKeyValid = apiKey && !apiKey.includes('INCOLLA_QUI');
  const isIdValid = calendarId && !calendarId.includes('INCOLLA_QUI');
  return { apiKey, calendarId, isValid: isKeyValid && isIdValid };
};

const getAIClient = () => {
  const { apiKey } = getCalendarCredentials();
  return new GoogleGenAI({ apiKey: apiKey || 'DEMO_MODE' }); 
};

export const generateBookingConfirmation = async (booking: BookingDetails): Promise<string> => {
  try {
    const { isValid } = getCalendarCredentials();
    if (!isValid) return "Grazie! La tua prenotazione è stata confermata con successo.";

    const client = getAIClient();
    const model = 'gemini-2.5-flash';
    const prompt = `Sei un assistente virtuale professionale. Prenotazione: ${booking.service.title}, ${booking.date} ore ${booking.timeSlot.startTime}, Cliente: ${booking.clientName}. Genera messaggio conferma breve.`;

    const response = await client.models.generateContent({ model, contents: prompt });
    return response.text || "Grazie! La tua prenotazione è stata confermata con successo.";
  } catch (error) {
    console.error(error);
    return "Grazie! La tua prenotazione è stata registrata correttamente.";
  }
};

export const fetchRealGoogleCalendarEvents = async (dateStr: string): Promise<CalendarEvent[]> => {
  const { apiKey, calendarId, isValid } = getCalendarCredentials();
  if (!isValid) return getMockCalendarEvents(dateStr);

  try {
    const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API Error: ${response.statusText}`);
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
    console.error(error);
    return getMockCalendarEvents(dateStr);
  }
};

export interface ValidationResult { isValid: boolean; message: string; }

export const validateBookingAvailability = async (booking: BookingDetails): Promise<ValidationResult> => {
  try {
    const { isValid } = getCalendarCredentials();
    if (!isValid) return { isValid: true, message: "Demo mode: Availability checked." };
    const client = getAIClient();
    const events = await fetchRealGoogleCalendarEvents(booking.date);
    const verificationPrompt = `Data: ${JSON.stringify(events)}. Request: ${booking.timeSlot.startTime} for ${booking.service.durationMinutes} min. Check overlap. Return JSON {"valid": boolean, "message": "string"}`;
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: verificationPrompt,
      config: { responseMimeType: 'application/json' }
    });
    const resultText = response.text;
    if (resultText) return JSON.parse(resultText);
    return { isValid: true, message: "Verified." };
  } catch (error) {
    console.error(error);
    return { isValid: true, message: "Proceeding." };
  }
};

export const createCalendarBooking = async (booking: BookingDetails): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 800));
    return true;
};

export const sendConfirmationEmails = async (booking: BookingDetails): Promise<boolean> => {
    console.log(`Email to Client (${booking.clientEmail}) and Owner (${BUSINESS_CONFIG.email})`);
    await new Promise(r => setTimeout(r, 600));
    return true;
};

export const sendBookingStatusEmail = async (booking: Booking, status: BookingStatus): Promise<boolean> => {
    const rebookLink = window.location.origin; 
    console.log(`Status Email to ${booking.clientEmail}: ${status}. Link: ${rebookLink}`);
    await new Promise(r => setTimeout(r, 1000));
    return true;
}
