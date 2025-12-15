// src/types.ts

// --- GESTIONE AUTH & CONFIG ---
export interface ClientConfig {
    id: string;
    business_name: string;
    subdomain: string;
    email_owner: string;
    password?: string; 

    // Google Config (robot)
    google_api_key?: string;
    email_bridge?: string; // Usato come targetCalendarId
    service_account_json?: string;

    // EmailJS Config
    emailjs_service_id?: string;
    emailjs_template_id?: string;
    emailjs_public_key?: string;
}

// --- GESTIONE SERVIZI ---
export type AvailabilityMode = 'always' | 'weekly' | 'range';

export interface ServiceAvailability {
    mode: AvailabilityMode;
    daysOfWeek?: number[]; // 0=Dom, 1=Lun, ..., 6=Sab
    timeStart?: string;    // es: "09:00"
    timeEnd?: string;      // es: "17:00"
    startDate?: string;    // es: "2025-01-01"
    endDate?: string;      // es: "2025-12-31"
}

export interface Service {
    id: string;
    title: string;
    description: string;
    durationMinutes: number;
    price: number;
    imageUrl?: string;
    availability: ServiceAvailability;
}

// --- GESTIONE PRENOTAZIONI ---

// Dati necessari per le prenotazioni nel frontend
export interface TimeSlot {
    id: string; 
    startTime: string; // es: "10:00"
    endTime: string;   // es: "11:00"
}

export interface ClientData {
    clientPhone: string;
    notes?: string;
}

export enum BookingStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
}

export interface Booking {
    id: string;
    clientId: string;
    createdAt: string;
    status: BookingStatus;
    date: string; 
    timeSlot: TimeSlot;
    
    // Dati Cliente
    clientName: string;
    clientSurname: string;
    clientEmail: string;
    clientPhone: string; 
    notes?: string;

    // Servizio prenotato
    service: Service;
}
