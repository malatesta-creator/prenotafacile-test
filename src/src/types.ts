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
  title: string;
  description: string;
  durationMinutes: number;
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
