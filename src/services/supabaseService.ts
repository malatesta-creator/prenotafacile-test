import { supabase } from '../lib/supabase';
import { Service, Booking, ClientConfig, BookingStatus } from '../types';

// ----------------------------------------------------
// AUTENTICAZIONE E CONFIGURAZIONE CLIENTE
// ----------------------------------------------------

export const getClientBySubdomain = async (subdomain: string): Promise<ClientConfig | null> => {
  const { data, error } = await supabase.from('clients').select('*').eq('subdomain', subdomain).single();
  if (error) return null;
  return data as ClientConfig;
};

export const authenticateUser = async (email: string, passwordAttempt: string): Promise<{ success: boolean; role?: 'MASTER' | 'CLIENT'; config?: ClientConfig }> => {
  const { data: users, error } = await supabase.from('clients').select('*').eq('email_owner', email);
  
  if (error || !users || users.length === 0) return { success: false };
  
  const user = users.find(u => u.password === passwordAttempt);
  
  if (!user) return { success: false };
  
  const role = user.subdomain === 'master' ? 'MASTER' : 'CLIENT';
  
  return { success: true, role, config: user as ClientConfig };
};

/**
 * Aggiorna la configurazione di un cliente specifico.
 * Il campo "targetCalendarId" del frontend viene mappato su "email_bridge" nel DB.
 */
export const updateClientConfig = async (clientId: string, config: Partial<ClientConfig>) => {
    // Mappatura necessaria per salvare i dati corretti nel DB
    const dbConfig: Record<string, any> = { ...config };
    
    // Assumendo che il campo DB sia ancora 'email_bridge' e che il frontend passi 'targetCalendarId'
    if (dbConfig.targetCalendarId !== undefined) {
        dbConfig['email_bridge'] = dbConfig['targetCalendarId'];
        delete dbConfig['targetCalendarId'];
    }
    
    // Assicuriamoci che tutte le chiavi siano mappate correttamente prima dell'update (es: google_api_key, service_account_json)
    // Se ClientConfig nel tuo 'types.ts' usa nomi camelCase (es. imageUrl), qui dovresti mappare a snake_case (es. image_url)
    
    await supabase.from('clients').update(dbConfig).eq('id', clientId);
};


// ----------------------------------------------------
// MASTER DASHBOARD (Recupera tutti i clienti, escluso il Master)
// ----------------------------------------------------

export const getAllClients = async (): Promise<ClientConfig[]> => {
  const { data } = await supabase.from('clients').select('*').neq('subdomain', 'master');
  return (data as ClientConfig[]) || [];
};


// ----------------------------------------------------
// SERVIZI
// ----------------------------------------------------

export const getServices = async (clientId: string): Promise<Service[]> => {
  const { data } = await supabase.from('services').select('*').eq('client_id', clientId);
  return (data || []).map((s: any) => ({
    id: s.id, 
    title: s.title, 
    description: s.description, 
    durationMinutes: s.duration, // Mappa DB 'duration' a 'durationMinutes' nel Frontend
    price: s.price, 
    imageUrl: s.image_url, 
    availability: typeof s.availability === 'string' ? JSON.parse(s.availability) : s.availability
  })) as Service[];
};

export const saveServices = async (clientId: string, services: Service[]) => {
  await supabase.from('services').delete().eq('client_id', clientId);
  const dbServices = services.map(s => ({
    client_id: clientId, 
    title: s.title, 
    description: s.description, 
    duration: s.durationMinutes, // Mappa 'durationMinutes' a DB 'duration'
    price: s.price, 
    image_url: s.imageUrl, 
    availability: s.availability
  }));
  await supabase.from('services').insert(dbServices);
};


// ----------------------------------------------------
// PRENOTAZIONI
// ----------------------------------------------------

export const getBookings = async (clientId: string): Promise<Booking[]> => {
  const { data } = await supabase.from('bookings').select('*').eq('client_id', clientId);
  
  return (data || []).map((b: any) => ({
    id: b.id, 
    createdAt: b.created_at, 
    status: b.status, 
    date: b.date,
    timeSlot: { id: b.id, startTime: b.time_slot }, 
    clientName: b.client_name, 
    clientSurname: b.client_surname, 
    clientEmail: b.client_email,
    clientPhone: b.client_phone, 
    notes: b.notes, 
    service: { title: b.service_title } as Service
  })) as Booking[];
};

export const createBooking = async (clientId: string, booking: any) => {
  await supabase.from('bookings').insert({
    client_id: clientId, 
    service_title: booking.service.title, 
    date: booking.date,
    time_slot: booking.timeSlot.startTime, 
    client_name: booking.clientName,
    client_surname: booking.clientSurname, 
    client_email: booking.clientEmail,
    client_phone: booking.clientPhone, 
    notes: booking.notes, 
    status: 'PENDING'
  });
};

export const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
  await supabase.from('bookings').update({ status }).eq('id', bookingId);
};
