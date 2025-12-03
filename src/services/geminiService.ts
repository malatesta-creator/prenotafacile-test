import { GoogleGenAI } from "@google/genai";
import emailjs from '@emailjs/browser';
import { BookingDetails, CalendarEvent, Booking, BookingStatus, ClientConfig } from '../types';
import { getMockCalendarEvents } from '../constants';

const getAIClient = (apiKey: string) => { return new GoogleGenAI({ apiKey }); };

export const generateBookingConfirmation = async (booking: BookingDetails, config?: ClientConfig): Promise<string> => {
    // ... (logica AI per il messaggio di conferma) ...
    return "Grazie! La tua prenotazione è confermata.";
};

export const fetchRealGoogleCalendarEvents = async (dateStr: string, config?: ClientConfig): Promise<CalendarEvent[]> => {
  // ... (logica lettura calendario esistente) ...
  return getMockCalendarEvents(dateStr); 
};

export const validateBookingAvailability = async (booking: BookingDetails, config?: ClientConfig) => {
  return { isValid: true, message: "Verified." };
};

// --- QUESTA È LA FUNZIONE CHIAVE ---
export const createCalendarBooking = async (booking: BookingDetails, serviceAccountJson: any, ownerEmail: string, targetCalendarId: string): Promise<boolean> => {
    try {
        if (!serviceAccountJson) return false;

        console.log(`🔄 Chiamata al Server Backend per scrivere su ${targetCalendarId}...`);
        
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

        if (!response.ok) throw new Error('Errore Server');
        console.log("✅ Evento creato!");
        return true;

    } catch (error) {
        console.error("❌ Errore scrittura:", error);
        return false;
    }
};

export const sendConfirmationEmails = async (booking: BookingDetails, config?: ClientConfig): Promise<boolean> => {
    // ... (logica EmailJS esistente) ...
    return true;
};

export const sendBookingStatusEmail = async (booking: Booking, status: BookingStatus, config?: ClientConfig): Promise<boolean> => {
    // ... (logica EmailJS esistente) ...
    return true;
}
