import { supabase } from '../lib/supabase';
import { Service, Booking, ClientConfig, BookingStatus } from '../types';

export const getClientBySubdomain = async (subdomain: string): Promise<ClientConfig | null> => {
  const { data, error } = await supabase.from('clients').select('*').eq('subdomain', subdomain).single();
  if (error) return null;
  return data;
};

export const authenticateUser = async (email: string, passwordAttempt: string): Promise<{ success: boolean; role?: 'MASTER' | 'CLIENT'; config?: ClientConfig }> => {
  const { data: users, error } = await supabase.from('clients').select('*').eq('email_owner', email);
  if (error || !users || users.length === 0) return { success: false };
  const user = users.find(u => u.password === passwordAttempt);
  if (!user) return { success: false };
  const role = user.subdomain === 'master' ? 'MASTER' : 'CLIENT';
  return { success: true, role, config: user };
};

export const updateClientConfig = async (clientId: string, config: Partial<ClientConfig>) => {
  await supabase.from('clients').update(config).eq('id', clientId);
};

export const getAllClients = async (): Promise<ClientConfig[]> => {
  const { data } = await supabase.from('clients').select('*').neq('subdomain', 'master');
  return data || [];
};

export const getServices = async (clientId: string): Promise<Service[]> => {
  const { data } = await supabase.from('services').select('*').eq('client_id', clientId);
  return (data || []).map((s: any) => ({
    ...s, durationMinutes: s.duration,
    availability: typeof s.availability === 'string' ? JSON.parse(s.availability) : s.availability
  }));
};

export const saveServices = async (clientId: string, services: Service[]) => {
  await supabase.from('services').delete().eq('client_id', clientId);
  const dbServices = services.map(s => ({
    client_id: clientId, title: s.title, description: s.description, duration: s.durationMinutes,
    price: s.price, image_url: s.imageUrl, availability: s.availability
  }));
  await supabase.from('services').insert(dbServices);
};

export const getBookings = async (clientId: string): Promise<Booking[]> => {
  const { data } = await supabase.from('bookings').select('*').eq('client_id', clientId);
  return (data || []).map((b: any) => ({
    id: b.id, createdAt: b.created_at, status: b.status, date: b.date,
    timeSlot: { id: 'ts', startTime: b.time_slot },
    clientName: b.client_name, clientSurname: b.client_surname, clientEmail: b.client_email,
    clientPhone: b.client_phone, notes: b.notes, service: { title: b.service_title } as any
  }));
};

export const createBooking = async (clientId: string, booking: any) => {
  await supabase.from('bookings').insert({
    client_id: clientId, service_title: booking.service.title, date: booking.date,
    time_slot: booking.timeSlot.startTime, client_name: booking.clientName,
    client_surname: booking.clientSurname, client_email: booking.clientEmail,
    client_phone: booking.clientPhone, notes: booking.notes, status: 'PENDING'
  });
};

export const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
  await supabase.from('bookings').update({ status }).eq('id', bookingId);
};
