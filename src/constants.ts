import { Service, TimeSlot, CalendarEvent } from './types';

// CONFIGURAZIONE GOOGLE CALENDAR (TEST REALE)
export const GOOGLE_CALENDAR_CONFIG = {
  apiKey: '', 
  calendarId: 'open2agency@gmail.com',
};

// Configurazione notifiche (Simulazione invio)
export const BUSINESS_CONFIG = {
  email: 'badhead1973@gmail.com' 
};

export const DEFAULT_SERVICES: Service[] = [
  {
    id: '1',
    title: 'Consulenza Strategica',
    description: 'Analisi approfondita del tuo business. Disponibile tutti i giorni feriali.',
    durationMinutes: 60,
    price: 150,
    imageUrl: 'https://picsum.photos/800/600?random=1',
    availability: {
      mode: 'weekly',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeStart: '09:00',
      timeEnd: '18:00'
    }
  },
  {
    id: '2',
    title: 'Mentoring Martedì Mattina',
    description: 'Sessione intensiva disponibile solo il martedì mattina.',
    durationMinutes: 45,
    price: 90,
    imageUrl: 'https://picsum.photos/800/600?random=2',
    availability: {
      mode: 'weekly',
      daysOfWeek: [2],
      timeStart: '09:00',
      timeEnd: '12:00'
    }
  },
  {
    id: '3',
    title: 'Speciale Natale',
    description: 'Offerta limitata disponibile solo a Dicembre.',
    durationMinutes: 90,
    price: 180,
    imageUrl: 'https://picsum.photos/800/600?random=3',
    availability: {
      mode: 'range',
      startDate: '2024-12-01',
      endDate: '2024-12-31'
    }
  },
  {
    id: '4',
    title: 'Call Conoscitiva',
    description: 'Breve chiacchierata gratuita. Sempre disponibile.',
    durationMinutes: 15,
    price: 0,
    imageUrl: 'https://picsum.photos/800/600?random=4',
    availability: {
      mode: 'always'
    }
  },
];

export const AVAILABLE_TIMES: TimeSlot[] = [
  { id: 't1', startTime: '09:00' },
  { id: 't2', startTime: '10:00' },
  { id: 't3', startTime: '11:00' },
  { id: 't4', startTime: '12:00' },
  { id: 't5', startTime: '14:00' },
  { id: 't6', startTime: '15:00' },
  { id: 't7', startTime: '16:00' },
  { id: 't8', startTime: '17:00' },
];

export const getNextDays = (days: number = 21): Date[] => {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i + 1); 
    dates.push(nextDate);
  }
  return dates;
};

export const getMockCalendarEvents = (dateStr: string): CalendarEvent[] => {
  return [
    {
      id: 'evt_1',
      title: 'Riunione Interna',
      startTime: '10:00',
      durationMinutes: 60
    },
    {
      id: 'evt_2',
      title: 'Pranzo',
      startTime: '13:00',
      durationMinutes: 60
    }
  ];
};
