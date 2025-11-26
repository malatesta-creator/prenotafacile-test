import React, { useState, useEffect } from 'react';
import { Service, Booking, BookingStatus, ServiceAvailability } from '../types';
import { DEFAULT_SERVICES, GOOGLE_CALENDAR_CONFIG } from '../constants';

interface AdminPanelProps {
  services: Service[];
  bookings: Booking[];
  userRole: 'CLIENT' | 'MASTER' | null;
  onUpdateServices: (services: Service[]) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    services, 
    bookings, 
    userRole,
    onUpdateServices, 
    onUpdateBookingStatus,
    onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'setup'>('bookings');
  
  // -- SERVICE EDITING STATE --
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Service>({
    id: '',
    title: '',
    description: '',
    durationMinutes: 30,
    price: 0,
    imageUrl: '',
    availability: { mode: 'always' }
  });

  // -- SETUP STATE --
  const [configData, setConfigData] = useState({
      apiKey: '',
      calendarId: '',
      emailServiceId: '',
      emailTemplateId: '',
      emailPublicKey: ''
  });
  const [configSaved, setConfigSaved] = useState(false);

  // -- BOOKING MANAGEMENT STATE --
  const [processingAction, setProcessingAction] = useState<{id: string, status: BookingStatus} | null>(null);

  useEffect(() => {
    // Load config from LocalStorage
    const savedKey = localStorage.getItem('prenotafacile_apikey');
    const savedEmail = localStorage.getItem('prenotafacile_calendarid');
    const savedServiceId = localStorage.getItem('prenotafacile_email_service_id');
    const savedTemplateId = localStorage.getItem('prenotafacile_email_template_id');
    const savedPublicKey = localStorage.getItem('prenotafacile_email_public_key');
    
    setConfigData({
        apiKey: savedKey || GOOGLE_CALENDAR_CONFIG.apiKey || '',
        calendarId: savedEmail || GOOGLE_CALENDAR_CONFIG.calendarId || '',
        emailServiceId: savedServiceId || '',
        emailTemplateId: savedTemplateId || '',
        emailPublicKey: savedPublicKey || ''
    });
  }, []);

  useEffect(() => {
    if (editingId === 'new') {
      setFormData({
        id: Date.now().toString(),
        title: 'Nuovo Servizio',
        description: '',
        durationMinutes: 60,
        price: 100,
        imageUrl: `https://picsum.photos/800/600?random=${Date.now()}`,
        availability: { mode: 'always' }
      });
    } else if (editingId) {
      const service = services.find(s => s.id === editingId);
      if (service) setFormData(service);
    }
  }, [editingId, services]);

  const handleSaveService = () => {
    let updatedServices = [...services];
    
    const cleanData: Service = {
      ...formData,
      availability: {
        ...formData.availability,
        startDate: formData.availability.mode !== 'always' ? formData.availability.startDate : undefined,
        endDate: formData.availability.mode !== 'always' ? formData.availability.endDate : undefined,
        daysOfWeek: formData.availability.mode === 'weekly' ? formData.availability.daysOfWeek : undefined,
        timeStart: formData.availability.mode === 'weekly' ? formData.availability.timeStart : undefined,
        timeEnd: formData.availability.mode === 'weekly' ? formData.availability.timeEnd : undefined,
      }
    };

    if (editingId === 'new') {
      updatedServices.push(cleanData);
    } else {
      updatedServices = updatedServices.map(s => s.id === editingId ? cleanData : s);
    }

    onUpdateServices(updatedServices);
    setEditingId(null);
  };

  const handleBookingAction = async (id: string, status: BookingStatus) => {
    if (!window.confirm(status === BookingStatus.CONFIRMED ? "Confermare questo appuntamento? Verrà inviata un'email." : "Cancellare questo appuntamento? Verrà inviata un'email di avviso.")) return;
    
    setProcessingAction({ id, status });
    try {
        await onUpdateBookingStatus(id, status);
    } catch (e) {
        console.error(e);
        alert("Errore durante l'aggiornamento.");
    } finally {
        setProcessingAction(null);
    }
  };

  const handleResetData = () => {
      if (window.confirm("ATTENZIONE: Questo cancellerà tutte le prenotazioni e ripristinerà i servizi predefiniti. Vuoi procedere?")) {
          localStorage.removeItem('prenotafacile_bookings');
          onUpdateServices(DEFAULT_SERVICES);
          window.location.reload();
      }
  };

  const handleSaveConfig = () => {
      localStorage.setItem('prenotafacile_apikey', configData.apiKey);
      localStorage.setItem('prenotafacile_calendarid', configData.calendarId);
      localStorage.setItem('prenotafacile_email_service_id', configData.emailServiceId);
      localStorage.setItem('prenotafacile_email_template_id', configData.emailTemplateId);
      localStorage.setItem('prenotafacile_email_public_key', configData.emailPublicKey);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const toggleDay = (dayIndex: number) => {
    const currentDays = formData.availability.daysOfWeek || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort();
    
    setFormData({
        ...formData,
        availability: { ...formData.availability, daysOfWeek: newDays }
    });
  };

  const sortedBookings = [...bookings].sort((a, b) => {
    if (a.status === BookingStatus.PENDING && b.status !== BookingStatus.PENDING) return -1;
    if (a.status !== BookingStatus.PENDING && b.status === BookingStatus.PENDING) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="bg-gray-50 min-h-screen animate-fade-in flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Pannello Controllo {userRole === 'MASTER' && <span className="text-xs bg-indigo-600 px-2 py-1 rounded ml-2">MASTER</span>}</h1>
        </div>
        <div className="flex gap-4">
            <nav className="flex bg-gray-800 rounded-lg p-1">
                <button onClick={() => setActiveTab('bookings')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'bookings' ? 'bg-gray-700' : 'text-gray-400'}`}>Prenotazioni</button>
                <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'services' ? 'bg-gray-700' : 'text-gray-400'}`}>Servizi</button>
                {userRole === 'MASTER' && (
                    <button onClick={() => setActiveTab('setup')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'setup' ? 'bg-gray-700' : 'text-gray-400'}`}>⚙️ Setup</button>
                )}
            </nav>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium border border-gray-700">Esci</button>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto p-6 w-full">
        {activeTab === 'bookings' && (
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    <h2 className="text-2xl font-bold text-gray-800">Appuntamenti</h2>
                    <button onClick={handleResetData} className="text-xs text-red-500 hover:underline">Reset Demo</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {sortedBookings.length === 0 && <p className="text-gray-500 italic">Nessuna prenotazione ricevuta.</p>}
                    {sortedBookings.map(booking => {
                        const isProcessing = processingAction?.id === booking.id;
                        const isCancelling = isProcessing && processingAction?.status === BookingStatus.CANCELLED;
                        const isConfirming = isProcessing && processingAction?.status === BookingStatus.CONFIRMED;

                        return (
                        <div key={booking.id} className="bg-white rounded-xl border p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-gray-900">{booking.clientName} {booking.clientSurname}</h3>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{booking.status}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {new Date(booking.date).toLocaleDateString('it-IT')} ore {booking.timeSlot.startTime} • {booking.service.title}
                                </div>
                            </div>
                            {booking.status === 'PENDING' && (
                                <div className="flex gap-3">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CANCELLED)} 
                                        className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow transition-all hover:shadow-md flex items-center justify-center gap-2 min-w-[100px] ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800'}`}
                                    >
                                        {isCancelling ? (
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : 'Rifiuta'}
                                    </button>
                                    
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CONFIRMED)} 
                                        className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow transition-all hover:shadow-md flex items-center justify-center gap-2 min-w-[100px] ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700 hover:bg-green-800'}`}
                                    >
                                        {isConfirming ? (
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : 'Conferma'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                  })}
                </div>
            </div>
        )}

        {activeTab === 'services' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-gray-800">Servizi</h2>
                        <button onClick={() => setEditingId('new')} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold">+ Aggiungi</button>
                    </div>
                    {services.map(service => (
                        <div key={service.id} onClick={() => setEditingId(service.id)} className={`p-4 rounded-xl border cursor-pointer ${editingId === service.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white'}`}>
                            <h3 className="font-bold text-gray-800">{service.title}</h3>
                            <span className="text-xs text-gray-500">{service.durationMinutes} min • €{service.price}</span>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-8">
                    {editingId && (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sticky top-24">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingId === 'new' ? 'Nuovo Servizio' : 'Modifica'}</h2>
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="Titolo" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                                    <input type="number" placeholder="Prezzo" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" />
                                </div>
                                <textarea placeholder="Descrizione" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg h-24" />
                                
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Regole di Disponibilità</label>
                                    
                                    <div className="flex gap-4 mb-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="mode" checked={formData.availability.mode === 'always'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'always' }})} />
                                            <span className="text-sm">Sempre disponibile</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="mode" checked={formData.availability.mode === 'range'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'range' }})} />
                                            <span className="text-sm">Periodo fisso</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="mode" checked={formData.availability.mode === 'weekly'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'weekly' }})} />
                                            <span className="text-sm">Ricorrenza settimanale</span>
                                        </label>
                                    </div>

                                    {(formData.availability.mode === 'range' || formData.availability.mode === 'weekly') && (
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-xs text-gray-500">Valido dal</label>
                                                <input type="date" value={formData.availability.startDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Valido fino al</label>
                                                <input type="date" value={formData.availability.endDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                                            </div>
                                        </div>
                                    )}

                                    {formData.availability.mode === 'weekly' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">Giorni della settimana</label>
                                                <div className="flex gap-2">
                                                    {['D', 'L', 'M', 'M', 'G', 'V', 'S'].map((d, i) => (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => toggleDay(i)}
                                                            className={`w-8 h-8 rounded-full text-xs font-bold ${formData.availability.daysOfWeek?.includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-500">Orario Inizio</label>
                                                    <input type="time" value={formData.availability.timeStart || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeStart: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500">Orario Fine</label>
                                                    <input type="time" value={formData.availability.timeEnd || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeEnd: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-gray-600">Annulla</button>
                                    <button onClick={handleSaveService} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Salva</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'setup' && userRole === 'MASTER' && (
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Tecnico (Master)</h2>
                    <p className="text-gray-600">Configura le integrazioni esterne.</p>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <h3 className="font-bold text-indigo-600 uppercase text-xs tracking-wider border-b pb-2">Google Calendar</h3>
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">Google Cloud API Key</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                            placeholder="AIzaSy..."
                            value={configData.apiKey}
                            onChange={(e) => setConfigData({...configData, apiKey: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">Email Ponte (Google Calendar ID)</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                            placeholder="prenotazioni@gmail.com"
                            value={configData.calendarId}
                            onChange={(e) => setConfigData({...configData, calendarId: e.target.value})}
                        />
                    </div>
                    
                    <h3 className="font-bold text-indigo-600 uppercase text-xs tracking-wider border-b pb-2 pt-4">EmailJS (Invio Email Reali)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">Service ID</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                                placeholder="service_xyz"
                                value={configData.emailServiceId}
                                onChange={(e) => setConfigData({...configData, emailServiceId: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">Template ID</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                                placeholder="template_abc"
                                value={configData.emailTemplateId}
                                onChange={(e) => setConfigData({...configData, emailTemplateId: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">Public Key</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                            placeholder="W2k-Js..."
                            value={configData.emailPublicKey}
                            onChange={(e) => setConfigData({...configData, emailPublicKey: e.target.value})}
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                        <span className={`text-green-600 font-bold transition-opacity ${configSaved ? 'opacity-100' : 'opacity-0'}`}>
                            ✓ Salvato!
                        </span>
                        <button 
                            onClick={handleSaveConfig}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-md"
                        >
                            Salva Configurazione
                        </button>
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <strong>Nota:</strong> Crea un account gratuito su <a href="https://www.emailjs.com" target="_blank" className="underline font-bold">EmailJS.com</a> per ottenere le chiavi e abilitare l'invio reale delle email.
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
