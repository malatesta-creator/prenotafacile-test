import React, { useState, useEffect } from 'react';
import { Service, AppStep, BookingDetails, TimeSlot, CalendarEvent, Booking, BookingStatus, ClientConfig } from './types';
import { AVAILABLE_TIMES, getNextDays } from './constants';
import ServiceCard from './components/ServiceCard';
import CalendarLink from './components/CalendarLink';
import AdminPanel from './components/AdminPanel';
import LoginPanel from './components/LoginPanel';
import { 
  generateBookingConfirmation, 
  validateBookingAvailability, 
  fetchRealGoogleCalendarEvents, 
  createCalendarBooking, 
  sendConfirmationEmails, 
  sendBookingStatusEmail 
} from './services/geminiService';
import { getClientBySubdomain, getServices, createBooking, getBookings, updateBookingStatus } from './services/supabaseService';

const App: React.FC = () => {
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [errorClient, setErrorClient] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'CLIENT' | 'MASTER' | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.SERVICE_SELECTION);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  const [dailyEvents, setDailyEvents] = useState<CalendarEvent[]>([]);
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const [formData, setFormData] = useState({ name: '', surname: '', email: '', phone: '', notes: '' });
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  useEffect(() => {
    const initApp = async () => {
      setIsLoadingClient(true);
      try {
        let subdomain = 'badhead1973'; 
        const host = window.location.hostname;
        if (!host.includes('localhost') && !host.includes('vercel.app')) {
           const parts = host.split('.');
           if (parts.length > 2) subdomain = parts[0];
        }
        
        console.log("Loading client for subdomain:", subdomain);

        const config = await getClientBySubdomain(subdomain);
        
        if (!config) {
          setErrorClient("Cliente non trovato o servizio non attivo.");
          setIsLoadingClient(false);
          return;
        }
        
        setClientConfig(config);
        const fetchedServices = await getServices(config.id);
        setServices(fetchedServices);

      } catch (err) {
        console.error(err);
        setErrorClient("Errore di connessione al server.");
      } finally {
        setIsLoadingClient(false);
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    if (selectedDate && clientConfig) {
      setIsFetchingAvailability(true);
      fetchRealGoogleCalendarEvents(selectedDate, clientConfig)
        .then(events => setDailyEvents(events))
        .catch(err => console.error(err))
        .finally(() => setIsFetchingAvailability(false));
    } else {
      setDailyEvents([]);
    }
  }, [selectedDate, clientConfig]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !clientConfig) return;

    setIsLoading(true);
    setValidationError(null);
    
    const bookingDetails: BookingDetails = {
      service: selectedService, date: selectedDate, timeSlot: selectedTime,
      clientName: formData.name, clientSurname: formData.surname, clientEmail: formData.email, clientPhone: formData.phone, notes: formData.notes
    };

    try {
      setLoadingStatus('Verifica disponibilità...');
      const validation = await validateBookingAvailability(bookingDetails, clientConfig);
      if (!validation.isValid) { setIsLoading(false); setValidationError(validation.message); return; }

      setLoadingStatus('Salvataggio prenotazione...');
      await createBooking(clientConfig.id, bookingDetails);
      
      setLoadingStatus('Invio email...');
      await sendConfirmationEmails(bookingDetails, clientConfig);

      if (clientConfig.service_account_json) {
          setLoadingStatus('Sincronizzazione Calendario...');
          try {
              const saJson = JSON.parse(clientConfig.service_account_json);
              
              // LOGICA DI TARGETING OTTIMIZZATA:
              // Dato che il robot ha i permessi di scrittura sul calendario del proprietario (confermato dagli screenshot),
              // Scriviamo DIRETTAMENTE lì. È più sicuro e immediato per l'utente.
              // Usiamo l'email ponte solo come fallback se l'owner manca (improbabile).
              const targetCal = clientConfig.email_owner || clientConfig.email_bridge;

              await createCalendarBooking(bookingDetails, saJson, clientConfig.email_owner, targetCal);
          } catch(e) {
              console.error("Errore Calendario", e);
              // Non blocchiamo il flusso se il calendario fallisce, la prenotazione è salvata su DB
          }
      }

      const aiMessage = await generateBookingConfirmation(bookingDetails, clientConfig);
      setConfirmationMessage(aiMessage);
      
      setIsLoading(false);
      setStep(AppStep.CONFIRMATION);
      window.scrollTo(0, 0);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setValidationError("Si è verificato un errore tecnico. Riprova.");
    }
  };

  const handleLoginSuccess = async (role: 'CLIENT' | 'MASTER') => {
    if (!clientConfig) return;
    setIsAuthenticated(true);
    setIsAdminMode(true);
    setCurrentUserRole(role);
    setIsLoginVisible(false);
    const dbBookings = await getBookings(clientConfig.id);
    setBookings(dbBookings);
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    if (!clientConfig) return;
    await updateBookingStatus(bookingId, status);
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
        await sendBookingStatusEmail(booking, status, clientConfig);
    }
    const dbBookings = await getBookings(clientConfig.id);
    setBookings(dbBookings);
  };

  if (isLoadingClient) return <div className="min-h-screen flex items-center justify-center text-gray-500">Caricamento {window.location.hostname}...</div>;
  if (errorClient) return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold text-xl">{errorClient}</div>;

  const isDateBookable = (date: Date): boolean => {
    if (!selectedService) return false;
    const { mode, startDate, endDate, daysOfWeek } = selectedService.availability;
    const dateStr = date.toISOString().split('T')[0];
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    if (mode === 'weekly') {
        const day = date.getDay();
        if (daysOfWeek && !daysOfWeek.includes(day)) return false;
    }
    return true;
  };

  const isSlotAvailable = (slot: TimeSlot): boolean => {
    if (!selectedService || isFetchingAvailability) return false;
    const { mode, timeStart, timeEnd } = selectedService.availability;
    if (mode === 'weekly') {
        if (timeStart && slot.startTime < timeStart) return false;
        if (timeEnd && slot.startTime >= timeEnd) return false;
    }
    const [slotHour, slotMinute] = slot.startTime.split(':').map(Number);
    const slotStartMinutes = slotHour * 60 + slotMinute;
    const slotEndMinutes = slotStartMinutes + selectedService.durationMinutes;
    return !dailyEvents.some(event => {
      const [evtHour, evtMinute] = event.startTime.split(':').map(Number);
      const evtStartMinutes = evtHour * 60 + evtMinute;
      const evtEndMinutes = evtStartMinutes + event.durationMinutes;
      return (slotStartMinutes < evtEndMinutes && slotEndMinutes > evtStartMinutes);
    });
  };

  const resetApp = () => { setStep(AppStep.SERVICE_SELECTION); setSelectedService(null); setSelectedDate(''); setSelectedTime(null); setFormData({ name: '', surname: '', email: '', phone: '', notes: '' }); };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      {isLoginVisible && <LoginPanel onLoginSuccess={handleLoginSuccess} onCancel={() => setIsLoginVisible(false)} />}
      
      {isAdminMode && isAuthenticated && clientConfig ? (
        <AdminPanel 
          services={services} 
          bookings={bookings} 
          userRole={currentUserRole} 
          onUpdateServices={setServices} 
          onUpdateBookingStatus={handleUpdateBookingStatus} 
          onClose={() => { setIsAuthenticated(false); setIsAdminMode(false); }} 
          clientConfig={clientConfig} 
        />
      ) : (
        <>
          <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-white/80">
            <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">O</div>
                <span className="font-bold text-xl text-gray-800 tracking-tight">Open2Agenda</span>
              </div>
              {step !== AppStep.SERVICE_SELECTION && step !== AppStep.CONFIRMATION && <button onClick={() => setStep(prev => prev - 1)} className="text-sm text-gray-500 hover:text-indigo-600">← Indietro</button>}
            </div>
          </header>
          <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
             <div className="text-center mb-4">
                <h3 className="text-sm uppercase tracking-wider text-indigo-600 font-bold">{clientConfig?.business_name}</h3>
             </div>
             {step === AppStep.SERVICE_SELECTION && (
                <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                    {services.map(service => <ServiceCard key={service.id} service={service} onSelect={(s) => { setSelectedService(s); setStep(AppStep.DATE_SELECTION); }} />)}
                </div>
             )}
             {step === AppStep.DATE_SELECTION && (
                 <div className="max-w-2xl mx-auto animate-fade-in">
                    <div className="mb-8"><h2 className="text-2xl font-bold text-gray-800">Quando?</h2><p className="text-gray-500">Scegli per {selectedService?.title}</p></div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 overflow-x-auto flex gap-3 scrollbar-hide">
                        {getNextDays(21).map(date => {
                            const isBookable = isDateBookable(date);
                            const isSelected = selectedDate === date.toISOString().split('T')[0];
                            return <button key={date.toISOString()} disabled={!isBookable} onClick={() => {setSelectedDate(date.toISOString().split('T')[0]); setSelectedTime(null);}} className={`flex-shrink-0 w-20 h-24 rounded-xl border-2 flex flex-col items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100'} ${!isBookable && 'opacity-30 cursor-not-allowed'}`}><span className="font-bold text-xl">{date.getDate()}</span><span className="text-xs uppercase">{date.toLocaleDateString('it-IT',{month:'short'})}</span></button>
                        })}
                    </div>
                    {selectedDate && <div className="grid grid-cols-3 gap-3">{AVAILABLE_TIMES.map(time => {
                        const avail = isSlotAvailable(time);
                        if(!avail) return null;
                        return <button key={time.id} onClick={() => {setSelectedTime(time); setStep(AppStep.DETAILS_FORM);}} className="py-2 border rounded-lg hover:bg-indigo-600 hover:text-white">{time.startTime}</button>
                    })}</div>}
                 </div>
             )}
             {step === AppStep.DETAILS_FORM && (
                 <div className="max-w-xl mx-auto animate-fade-in bg-white p-8 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-6">I tuoi dati</h2>
                    {validationError && <div className="text-red-500 mb-4 text-sm">{validationError}</div>}
                    <div className="space-y-4">
                        <input placeholder="Nome" className="w-full p-3 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        <input placeholder="Cognome" className="w-full p-3 border rounded" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} />
                        <input placeholder="Email" className="w-full p-3 border rounded" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        <input placeholder="Telefono" className="w-full p-3 border rounded" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        <textarea placeholder="Note" className="w-full p-3 border rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                        <button onClick={handleFormSubmit} disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded font-bold">{isLoading ? loadingStatus : 'Conferma'}</button>
                    </div>
                 </div>
             )}
             {step === AppStep.CONFIRMATION && (
                 <div className="max-w-xl mx-auto text-center animate-fade-in">
                    <h2 className="text-3xl font-bold text-green-600 mb-4">Prenotazione Confermata!</h2>
                    <p className="text-gray-600 mb-8">{confirmationMessage}</p>
                    <CalendarLink booking={{service: selectedService!, date: selectedDate, timeSlot: selectedTime!, clientName: formData.name, clientSurname: formData.surname, clientEmail: formData.email, clientPhone: formData.phone}} />
                    <button onClick={resetApp} className="mt-8 text-gray-500 underline">Torna alla Home</button>
                 </div>
             )}
          </main>
          <footer className="border-t border-gray-200 py-8 mt-auto"><div className="max-w-4xl mx-auto px-4 flex justify-between items-center text-sm"><div className="text-gray-400">&copy; {new Date().getFullYear()} Open2Agenda.</div><button onClick={() => setIsLoginVisible(true)} className="text-gray-500 hover:text-indigo-600 flex items-center gap-2 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-gray-100">Area Riservata</button></div></footer>
        </>
      )}
    </div>
  );
};
export default App;
