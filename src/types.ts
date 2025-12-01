
export interface ServiceAvailability {
  mode: 'always' | 'range' | 'weekly';
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  timeStart?: string;   // "09:00" limit daily hours
  timeEnd?: string;     // "18:00" limit daily hours
}

export interface Service {
  id: string;
  client_id?: string; // Collegamento al database
  title: string;
  description: string;
  durationMinutes: number; // Mapped from duration in DB
  price: number;
  imageUrl: string;
  availability: ServiceAvailability;
}

export interface TimeSlot {
  id: string;
  startTime: string; // HH:mm
}

export interface BookingDetails {
  service: Service;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  clientName: string;
  clientSurname: string;
  clientEmail: string;
  clientPhone: string;
  notes?: string;
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}

export interface Booking extends BookingDetails {
  id: string;
  createdAt: string;
  status: BookingStatus;
  client_id?: string; // Collegamento al database
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number;
}

export enum AppStep {
  SERVICE_SELECTION,
  DATE_SELECTION,
  DETAILS_FORM,
  CONFIRMATION,
}

// Interfaccia per il Cliente (Tenant)
export interface ClientConfig {
  id: string;
  subdomain: string;
  business_name: string;
  email_owner: string;
  password?: string;
  google_api_key?: string;
  email_bridge?: string;
  emailjs_service_id?: string;
  emailjs_template_id?: string;
  emailjs_public_key?: string;
  service_account_json?: string; // JSON credentials del Service Account Google
}
