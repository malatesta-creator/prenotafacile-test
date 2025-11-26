import React, { useState, useEffect } from 'react';
import { Service, AppStep, BookingDetails, TimeSlot, CalendarEvent, Booking, BookingStatus } from './types';
import { DEFAULT_SERVICES, AVAILABLE_TIMES, getNextDays } from './constants';
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

const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>(() => {
    const saved = localStorage.getItem('prenotafacile_services');
    return saved ? JSON.parse(saved) : DEFAULT_SERVICES;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('prenotafacile_bookings');
    return saved ? JSON.parse(saved) : [];
  });

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

  useEffect(() => { localStorage.setItem('prenotafacile_services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('prenotafacile_bookings', JSON.stringify(bookings)); }, [bookings]);

  useEffect(() => {
    if (selectedDate) {
      setIsFetchingAvailability(true);
      fetchRealGoogleCalendarEvents(selectedDate)
        .then(events => setDailyEvents(events))
        .catch(err => console.error(err))
        .finally(() => setIsFetchingAvailability(false));
    } else {
      setDailyEvents([]);
    }
  }, [selectedDate]);

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

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep(AppStep.DATE_SELECTION);
    window.scrollTo(0, 0);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
    setSelectedTime(null);
    setValidationError(null);
  };

  const handleTimeSelect = (time: TimeSlot) => {
    setSelectedTime(time);
    setValidationError(null);
    setStep(AppStep.DETAILS_FORM);
    window.scrollTo(0, 0);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime) return;
    setIsLoading(true);
    setValidationError(null);
    
    const bookingDetails: BookingDetails = {
      service: selectedService, date: selectedDate, timeSlot: selectedTime,
      clientName: formData.name, clientSurname: formData.surname, clientEmail: formData.email, clientPhone: formData.phone, notes: formData.notes
    };

    try {
      setLoadingStatus('Verifica disponibilità finale...');
      const validation = await validateBookingAvailability(bookingDetails);
      if (!validation.isValid) { setIsLoading(false); setValidationError(validation.message); return; }

      setLoadingStatus('Registrazione appuntamento...');
      await createCalendarBooking(bookingDetails);

      const newBooking: Booking = { ...bookingDetails, id: Date.now().toString(), createdAt: new Date().toISOString(), status: BookingStatus.PENDING };
      setBookings(prev => [...prev, newBooking]);

      setLoadingStatus('Invio email di conferma...');
      await sendConfirmationEmails(bookingDetails);

      const aiMessage = await generateBookingConfirmation(bookingDetails);
      setConfirmationMessage(aiMessage);
      
      setIsLoading(false);
      setStep(AppStep.CONFIRMATION);
      window.scrollTo(0, 0);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setValidationError("Errore durante la prenotazione. Riprova.");
    }
  };

  const resetApp = () => {
    setStep(AppStep.SERVICE_SELECTION); setSelectedService(null); setSelectedDate(''); setSelectedTime(null);
    setFormData({ name: '', surname: '', email: '', phone: '', notes: '' });
    setConfirmationMessage(''); setValidationError(null);
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    const bookingToUpdate = bookings.find(b => b.id === bookingId);
    if (!bookingToUpdate) return;
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
    try { await sendBookingStatusEmail(bookingToUpdate, status); } catch (error) { console.error(error); }
  };

  const handleLoginSuccess = (role: 'CLIENT' | 'MASTER') => {
    setIsAuthenticated(true); setIsAdminMode(true); setCurrentUserRole(role); setIsLoginVisible(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setIsAdminMode(false); setCurrentUserRole(null);
  };

  const renderDateTime = () => {
    if (!selectedService) return null;
    const availableDates = getNextDays(21);
    return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8"><h2 className="text-2xl font-bold text-gray-800 mb-2">Quando sei disponibile?</h2><p className="text-gray-500">Scegli data e orario per {selectedService?.title}.</p></div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-4 uppercase text-xs tracking-wider">Seleziona una data</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {availableDates.map((date) => {
            const dateString = date.toISOString().split('T')[0];
            const isSelected = selectedDate === dateString;
            const isBookable = isDateBookable(date);
            return (
              <button key={dateString} onClick={() => isBookable && handleDateSelect(date)} disabled={!isBookable} className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 rounded-xl border-2 transition-all duration-200 ${!isBookable ? 'border-gray-50 bg-gray-50 opacity-30 cursor-not-allowed grayscale' : isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-105' : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200 hover:bg-gray-50'}`}>
                <span className="text-xs font-medium uppercase">{date.toLocaleDateString('it-IT', { weekday: 'short' })}</span><span className="text-2xl font-bold my-1">{date.getDate()}</span><span className="text-xs">{date.toLocaleDateString('it-IT', { month: 'short' })}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selectedDate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
          <h3 className="font-semibold text-gray-700 mb-4 uppercase text-xs tracking-wider flex justify-between items-center"><span>Orari del {new Date(selectedDate).toLocaleDateString('it-IT')}</span>{isFetchingAvailability && <span className="text-indigo-600 text-xs animate-pulse">Controllo agenda...</span>}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {AVAILABLE_TIMES.map((time) => {
              const available = isSlotAvailable(time);
              const { mode, timeStart, timeEnd } = selectedService.availability;
              if (mode === 'weekly' && ((timeStart && time.startTime < timeStart) || (timeEnd && time.startTime >= timeEnd))) return null;
              return (
                <button key={time.id} onClick={() => available && handleTimeSelect(time)} disabled={!available} className={`py-2 px-4 rounded-lg border font-medium text-sm transition-all shadow-sm ${available ? 'bg-white border-gray-200 text-gray-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'}`}>{time.startTime}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  };

  const renderForm = () => (
    <div className="max-w-xl mx-auto animate-fade-in">
       <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-gray-800 mb-2">Inserisci i tuoi dati</h2><p className="text-gray-500">Prenotazione per <strong>{selectedService?.title}</strong><br/>il {new Date(selectedDate).toLocaleDateString('it-IT')} alle {selectedTime?.startTime}</p></div>
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 relative">
        {validationError && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{validationError}</div>}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900" placeholder="Mario" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label><input required type="text" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900" placeholder="Rossi" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900" placeholder="email@test.it" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label><input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900" placeholder="+39..." /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 h-24" /></div>
          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-70">{isLoading ? loadingStatus : 'Conferma e Prenota'}</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {isLoginVisible && <LoginPanel onLoginSuccess={handleLoginSuccess} onCancel={() => setIsLoginVisible(false)} />}
      {isAdminMode && isAuthenticated ? (
        <AdminPanel services={services} bookings={bookings} userRole={currentUserRole} onUpdateServices={setServices} onUpdateBookingStatus={handleUpdateBookingStatus} onClose={handleLogout} />
      ) : (
        <>
          <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-white/80">
            <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">P</div><span className="font-bold text-xl text-gray-800 tracking-tight">PrenotaFacile</span></div>
              {step !== AppStep.SERVICE_SELECTION && step !== AppStep.CONFIRMATION && <button onClick={() => setStep(prev => prev - 1)} className="text-sm text-gray-500 hover:text-indigo-600 font-medium">← Indietro</button>}
            </div>
          </header>
          <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
            {step === AppStep.SERVICE_SELECTION && (
                <div className="animate-fade-in">
                    <div className="text-center mb-10"><h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Scegli il tuo servizio</h1><p className="text-gray-500">Seleziona la tipologia di appuntamento che desideri prenotare.</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{services.map(service => (<ServiceCard key={service.id} service={service} onSelect={handleSelectService} />))}</div>
                </div>
            )}
            {step === AppStep.DATE_SELECTION && renderDateTime()}
            {step === AppStep.DETAILS_FORM && renderForm()}
            {step === AppStep.CONFIRMATION && (
                <div className="max-w-xl mx-auto animate-fade-in text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Prenotazione Inviata!</h2><p className="text-gray-500 mb-6 text-sm">Controlla la tua email ({formData.email}) per i dettagli.</p>
                    {confirmationMessage && <div className="bg-indigo-50 p-4 rounded-xl text-indigo-900 mb-8 italic border border-indigo-100 shadow-inner">"{confirmationMessage}"</div>}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 text-left"><div className="space-y-3"><div className="flex justify-between"><span className="text-gray-600">Servizio</span><span className="font-semibold text-gray-900">{selectedService?.title}</span></div><div className="flex justify-between"><span className="text-gray-600">Data</span><span className="font-semibold text-gray-900">{selectedDate}</span></div><div className="flex justify-between"><span className="text-gray-600">Ora</span><span className="font-semibold text-gray-900">{selectedTime?.startTime}</span></div></div></div>
                    <CalendarLink booking={{service: selectedService!, date: selectedDate, timeSlot: selectedTime!, clientName: formData.name, clientSurname: formData.surname, clientEmail: formData.email, clientPhone: formData.phone}} />
                    <button onClick={resetApp} className="block w-full py-3 text-gray-500 hover:text-gray-800 font-medium mt-6">Torna alla Home</button>
                </div>
            )}
          </main>
          <footer className="border-t border-gray-200 py-8 mt-auto"><div className="max-w-4xl mx-auto px-4 flex justify-between items-center text-sm"><div className="text-gray-400">&copy; {new Date().getFullYear()} PrenotaFacile.</div><button onClick={() => setIsLoginVisible(true)} className="text-gray-300 hover:text-indigo-600 flex items-center gap-1 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Area Riservata</button></div></footer>
        </>
      )}
    </div>
  );
};
export default App;
