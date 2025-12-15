export interface ClientConfig {
    id: string;
    business_name: string;
    subdomain: string;
    email_owner: string;
    password?: string; 
    google_api_key?: string;
    email_bridge?: string;
    service_account_json?: string;
    emailjs_service_id?: string;
    emailjs_template_id?: string;
    emailjs_public_key?: string;
}

export type AvailabilityMode = 'always' | 'weekly' | 'range';

export interface ServiceAvailability {
    mode: AvailabilityMode;
    daysOfWeek?: number[];
    timeStart?: string;
    timeEnd?: string;
    startDate?: string;
    endDate?: string;
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

export interface TimeSlot {
    id: string; 
    startTime: string;
    endTime: string;
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
    clientName: string;
    clientSurname: string;
    clientEmail: string;
    clientPhone: string; 
    notes?: string;
    service: Service;
}
