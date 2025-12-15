import { createClient } from '@supabase/supabase-js';
import { Service, Booking, BookingStatus, ClientConfig, TimeSlot, ClientData } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Inizializzazione Supabase (sostituisci con le tue variabili d'ambiente reali)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Key not configured!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- AUTENTICAZIONE (Solo per il Master/Admin Panel) ---

export const signInWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};


// --- GESTIONE DATI CLIENTI (ADMIN) ---

export const getClientConfigById = async (clientId: string): Promise<ClientConfig | null> => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
    if (error) return null;
    return data as ClientConfig;
};

export const getClientBySubdomain = async (subdomain: string): Promise<ClientConfig | null> => {
    
    // ******************************************************************************
    // *** CORREZIONE CRITICA: FALLBACK PER URL ROOT DI VERCEL (subdomain vuoto) ***
    // Usa 'badhead1973' se il sottodominio è vuoto. 
    // Rimuovi questa riga quando passi a una configurazione con sottodomini reali.
    const subdomainToUse = subdomain || 'badhead1973'; 
    // ******************************************************************************

    const { data, error } = await supabase.from('clients').select('*').eq('subdomain', subdomainToUse).single();
    
    if (error) {
        console.error("Errore nel recupero del cliente per sottodominio:", error);
        return null;
    }
    return data as ClientConfig;
};

export const updateClientConfig = async (clientId: string, config: Partial<ClientConfig>) => {
    const { error } = await supabase.from('clients').update(config).eq('id', clientId);
    if (error) throw error;
};

export const getAllClients = async (): Promise<ClientConfig[]> => {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) {
        console.error("Errore nel recupero di tutti i clienti:", error);
        return [];
    }
    return data as ClientConfig[];
};


// --- GESTIONE SERVIZI ---

export const getServices = async (clientId: string): Promise<Service[]> => {
    const { data, error } = await supabase.from('clients').select('services_json').eq('id', clientId).single();
    if (error || !data || !data.services_json) {
        console.warn(`Nessun servizio trovato per il cliente ${clientId}`);
        return [];
    }
    return data.services_json as Service[];
};

export const saveServices = async (clientId: string, services: Service[]) => {
    const { error } = await supabase.from('clients').update({ services_json: services }).eq('id', clientId);
    if (error) throw error;
};


// --- GESTIONE PRENOTAZIONI ---

export const getBookings = async (clientId: string): Promise<Booking[]> => {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: true })
        .order('time_start', { ascending: true });

    if (error) {
        console.error("Errore nel recupero delle prenotazioni:", error);
        return [];
    }

    // Mappatura per adattare i dati del DB al tipo Booking
    return data.map(dbBooking => ({
        id: dbBooking.id,
        clientId: dbBooking.client_id,
        clientName: dbBooking.client_name,
        clientSurname: dbBooking.client_surname,
        clientEmail: dbBooking.client_email,
        date: dbBooking.date,
        timeSlot: {
            startTime: dbBooking.time_start,
            endTime: dbBooking.time_end,
        } as TimeSlot,
        service: dbBooking.service_json as Service, // Assumiamo che service_json sia Service
        status: dbBooking.status as BookingStatus,
        createdAt: dbBooking.created_at,
    })) as Booking[];
};

export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt'>, clientData: ClientData) => {
    
    // Costruisci l'oggetto da salvare nel DB (deve corrispondere alla struttura della tabella Supabase)
    const dbPayload = {
        id: uuidv4(), // Genera un ID univoco
        client_id: booking.clientId,
        client_name: booking.clientName,
        client_surname: booking.clientSurname,
        client_email: booking.clientEmail,
        date: booking.date,
        time_start: booking.timeSlot.startTime,
        time_end: booking.timeSlot.endTime,
        service_json: booking.service, // Salva l'oggetto Service come JSONB
        status: BookingStatus.PENDING,
        created_at: new Date().toISOString(),
        client_data_json: clientData, // Salva dati aggiuntivi del cliente (es. telefono, note)
    };

    const { data, error } = await supabase.from('bookings').insert(dbPayload).select().single();

    if (error) throw error;

    // Mappa i dati salvati a un oggetto Booking completo (opzionale, per coerenza)
    return {
        id: data.id,
        clientId: data.client_id,
        clientName: data.client_name,
        clientSurname: data.client_surname,
        clientEmail: data.client_email,
        date: data.date,
        timeSlot: {
            startTime: data.time_start,
            endTime: data.time_end,
        } as TimeSlot,
        service: data.service_json as Service,
        status: data.status as BookingStatus,
        createdAt: data.created_at,
    } as Booking;
};

export const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    const { error } = await supabase
        .from('bookings')
        .update({ status: status })
        .eq('id', bookingId);

    if (error) throw error;
};
