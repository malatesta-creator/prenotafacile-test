import React, { useState, useEffect } from 'react';
import { Service, Booking, BookingStatus, ClientConfig } from '../types';
import { saveServices, updateClientConfig, getAllClients, getServices, getBookings, updateBookingStatus } from '../services/supabaseService';
import { sendBookingStatusEmail } from '../services/geminiService';

interface AdminPanelProps {
  services: Service[];
  bookings: Booking[];
  userRole: 'CLIENT' | 'MASTER' | null;
  onUpdateServices: (services: Service[]) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  onClose: () => void;
  clientConfig: ClientConfig;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    services: initialServices, 
    bookings: initialBookings, 
    userRole, 
    onUpdateServices, 
    onUpdateBookingStatus, 
    onClose, 
    clientConfig: initialConfig 
}) => {
  // -- STATE GESTIONE MASTER --
  const [allClients, setAllClients] = useState<ClientConfig[]>([]);
  const [managedClient, setManagedClient] = useState<ClientConfig | null>(null);
  const [managedServices, setManagedServices] = useState<Service[]>([]);
  const [managedBookings, setManagedBookings] = useState<Booking[]>([]);
  
  // -- STATE UI --
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'setup' | 'dashboard'>('bookings');
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // -- STATE EDITING --
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Service>({ 
    id: '', title: '', description: '', durationMinutes: 30, price: 0, imageUrl: '', availability: { mode: 'always' } 
  });
  
  // -- STATE SETUP FORM --
  const [configData, setConfigData] = useState({
      apiKey: '', targetCalendarId: '', emailServiceId: '', emailTemplateId: '', emailPublicKey: '', serviceAccountJson: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState<{id: string, status: BookingStatus} | null>(null);

  // -- COMPUTED PROPERTIES --
  // Se sono Master e ho selezionato un cliente, uso i dati "managed". Altrimenti uso i props iniziali.
  const currentConfig = (userRole === 'MASTER' && managedClient) ? managedClient : initialConfig;
  const currentServices = (userRole === 'MASTER' && managedClient) ? managedServices : initialServices;
  const currentBookings = (userRole === 'MASTER' && managedClient) ? managedBookings : initialBookings;
  
  // Se sono Master ma NON ho selezionato un cliente, forzo la dashboard
  const showDashboardOnly = userRole === 'MASTER' && !managedClient;

  // -- INIT --
  useEffect(() => {
    if (userRole === 'MASTER') {
        loadClientsList();
        setActiveTab('dashboard');
    } else {
        // Se sono un cliente normale, vado alle prenotazioni
        setActiveTab('bookings');
    }
  }, [userRole]);

  // Aggiorna il form di setup quando cambia il cliente visualizzato
  useEffect(() => {
      if (currentConfig) {
        setConfigData({
            apiKey: currentConfig.google_api_key || '',
            targetCalendarId: currentConfig.email_bridge || '', 
            emailServiceId: currentConfig.emailjs_service_id || '',
            emailTemplateId: currentConfig.emailjs_template_id || '',
            emailPublicKey: currentConfig.emailjs_public_key || '',
            serviceAccountJson: currentConfig.service_account_json || ''
        });
      }
  }, [currentConfig]);

  // Popola il form servizi quando si clicca modifica
  useEffect(() => {
    if (editingId === 'new') {
      setFormData({ 
        id: Date.now().toString(), title: 'Nuovo Servizio', description: '', durationMinutes: 60, price: 100, 
        imageUrl: `https://picsum.photos/800/600?random=${Date.now()}`, availability: { mode: 'always' } 
      });
    } else if (editingId) {
      const s = currentServices.find(s => s.id === editingId);
      if (s) setFormData(s);
    }
  }, [editingId, currentServices]);

  // -- MASTER ACTIONS --

  const loadClientsList = async () => {
      const clients = await getAllClients();
      setAllClients(clients);
      console.log("--- DEBUG MASTER DASHBOARD ---");
      console.log("Numero di clienti caricati:", clients.length);
      console.log("Dati dei clienti:", clients);
      console.log("------------------------------");
  };

  const handleManageClient = async (client: ClientConfig) => {
      setIsLoadingData(true);
      try {
          // 1. Scarica i dati freschi del cliente selezionato
          const [srvs, bks] = await Promise.all([
              getServices(client.id),
              getBookings(client.id)
          ]);
          
          setManagedClient(client);
          setManagedServices(srvs);
          setManagedBookings(bks);
          setActiveTab('bookings'); // Porta subito alle prenotazioni
      } catch (error) {
          console.error("Errore caricamento dati cliente", error);
          alert("Errore nel caricamento dei dati del cliente.");
      } finally {
          setIsLoadingData(false);
      }
  };

  const handleBackToDashboard = () => {
      setManagedClient(null);
      setManagedServices([]);
      setManagedBookings([]);
      setActiveTab('dashboard');
      loadClientsList(); // Refresh lista
  };

  // -- GENERIC ACTIONS --

  const handleSaveService = async () => {
    setIsSaving(true);
    let updatedServices = [...currentServices];
    const cleanData: Service = { ...formData, durationMinutes: Number(formData.durationMinutes), price: Number(formData.price) };
    
    if (editingId === 'new') updatedServices.push(cleanData);
    else updatedServices = updatedServices.map(s => s.id === editingId ? cleanData : s);

    try {
        await saveServices(currentConfig.id, updatedServices);
        
        if (userRole === 'MASTER' && managedClient) {
            setManagedServices(updatedServices);
        } else {
            onUpdateServices(updatedServices);
        }
        setEditingId(null);
    } catch (e) { alert("Errore salvataggio servizi"); console.error(e); } 
    finally { setIsSaving(false); }
  };

  const handleSaveConfig = async () => {
      setIsSaving(true);
      try {
          const newConfigPayload = {
              google_api_key: configData.apiKey,
              email_bridge: configData.targetCalendarId, // Usa ancora 'email_bridge' nel DB
              emailjs_service_id: configData.emailServiceId,
              emailjs_template_id: configData.emailTemplateId,
              emailjs_public_key: configData.emailPublicKey,
              service_account_json: configData.serviceAccountJson
          };

          await updateClientConfig(currentConfig.id, newConfigPayload);
          
          if (managedClient) {
              setManagedClient({ ...managedClient, ...newConfigPayload });
          } else {
              alert("Configurazione salvata. Ricarica la pagina per applicare le modifiche.");
          }
          
          alert(`✅ Configurazione salvata per ${currentConfig.business_name}!`);
      } catch (e) { alert("Errore salvataggio config"); console.error(e); } 
      finally { setIsSaving(false); }
  };

  const handleBookingAction = async (id: string, status: BookingStatus) => {
    if (!window.confirm(status === BookingStatus.CONFIRMED ? "Confermare appuntamento?" : "Cancellare appuntamento?")) return;
    setProcessingAction({ id, status });
    try {
        await updateBookingStatus(id, status);
        
        const booking = currentBookings.find(b => b.id === id);
        if (booking) await sendBookingStatusEmail(booking, status, currentConfig);

        if (userRole === 'MASTER' && managedClient) {
            const updated = currentBookings.map(b => b.id === id ? { ...b, status } : b);
            setManagedBookings(updated);
        } else {
            await onUpdateBookingStatus(id, status);
        }
    } catch (e) { console.error(e); alert("Errore aggiornamento."); } 
    finally { setProcessingAction(null); }
  };

  const toggleDay = (dayIndex: number) => {
    const currentDays = formData.availability.daysOfWeek || [];
    const newDays = currentDays.includes(dayIndex) ? currentDays.filter(d => d !== dayIndex) : [...currentDays, dayIndex].sort();
    setFormData({ ...formData, availability: { ...formData.availability, daysOfWeek: newDays } });
  };

  // -- RENDER --

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
                {userRole === 'MASTER' && managedClient && (
                    <button onClick={handleBackToDashboard} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm mr-2 transition-colors flex items-center gap-1 border border-gray-600">
                        <span>←</span> Clienti
                    </button>
                )}
                {userRole === 'MASTER' 
                    ? (managedClient ? `Gestione: ${managedClient.business_name}` : "Master Dashboard") 
                    : `Admin: ${currentConfig?.business_name || 'Caricamento...'}`}
            </h1>
        </div>
        <div className="flex gap-4">
            {!showDashboardOnly && (
                <nav className="flex bg-gray-800 rounded-lg p-1">
                    <button onClick={() => setActiveTab('bookings')} className={`px-4 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'bookings' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Prenotazioni</button>
                    <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'services' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Servizi</button>
                    <button onClick={() => setActiveTab('setup')} className={`px-4 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'setup' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>⚙️ Setup</button>
                </nav>
            )}
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700 transition-colors">Esci</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 w-full flex-grow">
        
        {/* VIEW 1: DASHBOARD LISTA CLIENTI (SOLO MASTER) */}
        {showDashboardOnly && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-end border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Tutti i Clienti</h2>
                        <p className="text-gray-500">Seleziona un'attività per gestirla.</p>
                    </div>
                </div>
                
                {isLoadingData && <div className="text-center py-10 text-indigo-600">Caricamento dati...</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allClients.map(client => (
                        <div key={client.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all relative group">
                            <h3 className="font-bold text-lg text-gray-800 mb-1">{client.business_name}</h3>
                            <p className="text-sm text-indigo-600 font-medium mb-4">{client.subdomain}.prenotafacile.it</p>
                            
                            <div className="space-y-1 text-xs text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg">
                                <div className="flex justify-between"><span>Owner:</span> <span className="text-gray-900 font-mono truncate w-32 text-right">{client.email_owner}</span></div>
                            </div>

                            <button 
                                onClick={() => handleManageClient(client)}
                                className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-600 transition-colors flex justify-center items-center gap-2"
                            >
                                Gestisci Attività ⚙️
                            </button>
                        </div>
                    ))}
                    {!isLoadingData && allClients.length === 0 && <p className="text-gray-500 col-span-3 text-center">Nessun cliente trovato.</p>}
                </div>
            </div>
        )}

        {/* VIEW 2: PRENOTAZIONI */}
        {activeTab === 'bookings' && !showDashboardOnly && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Prenotazioni: {currentConfig?.business_name}</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{currentBookings.length} Totali</span>
                </div>
                
                {currentBookings.length === 0 && <p className="text-gray-500 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">Nessuna prenotazione presente.</p>}
                
                {currentBookings.map(booking => {
                    const isProcessing = processingAction?.id === booking.id;
                    return (
                        <div key={booking.id} className="bg-white p-5 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center border border-gray-100 hover:border-indigo-200 transition-colors gap-4">
                            <div>
                                <div className="font-bold text-lg text-gray-900">{booking.clientName} {booking.clientSurname}</div>
                                <div className="text-sm text-gray-600 flex flex-wrap gap-2 items-center mt-1">
                                    <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{booking.service.title}</span>
                                    <span className="text-gray-400">•</span>
                                    <span>{new Date(booking.date).toLocaleDateString()} ore {booking.timeSlot.startTime}</span>
                                </div>
                                <div className="mt-2">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${
                                        booking.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                        booking.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200' : 
                                        'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                        {booking.status}
                                    </span>
                                </div>
                            </div>
                            
                            {booking.status === 'PENDING' && (
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CANCELLED)} 
                                        className="flex-1 md:flex-none px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                                    >
                                        Rifiuta
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CONFIRMED)} 
                                        className="flex-1 md:flex-none px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        {isProcessing ? '...' : 'Conferma'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}

        {/* VIEW 3: SERVIZI */}
        {activeTab === 'services' && !showDashboardOnly && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800">Catalogo Servizi</h3>
                        <button onClick={() => setEditingId('new')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors">+ Nuovo</button>
                    </div>
                    <div className="space-y-3">
                        {currentServices.map(s => (
                            <div key={s.id} onClick={() => setEditingId(s.id)} className={`p-4 rounded-xl border cursor-pointer transition-all ${editingId === s.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
                                <div className="font-bold text-gray-800">{s.title}</div>
                                <div className="text-xs text-gray-500 mt-1">{s.durationMinutes} min • €{s.price}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {editingId && (
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-fit sticky top-24">
                        <h3 className="font-bold text-xl mb-6 text-indigo-900 border-b pb-2">{editingId === 'new' ? 'Crea Nuovo Servizio' : 'Modifica Servizio'}</h3>
                        
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Titolo</label><input className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Prezzo (€)</label><input className="w-full border p-2.5 rounded-lg" type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} /></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase">Durata (min)</label><input className="w-full border p-2.5 rounded-lg" type="number" value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value)})} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Descrizione</label><textarea className="w-full border p-2.5 rounded-lg h-24 resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                            
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-3">Disponibilità</label>
                                <div className="flex gap-4 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'always'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'always' }})} /><span className="text-sm">Sempre</span></label>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'range'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'range' }})} /><span className="text-sm">Date</span></label>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'weekly'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'weekly' }})} /><span className="text-sm">Settimana</span></label>
                                </div>

                                {(formData.availability.mode === 'range' || formData.availability.mode === 'weekly') && (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><label className="text-xs text-gray-500">Inizio</label><input type="date" value={formData.availability.startDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                          <div><label className="text-xs text-gray-500">Fine</label><input type="date" value={formData.availability.endDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                    </div>
                                )}

                                {formData.availability.mode === 'weekly' && (
                                    <div className="space-y-3">
                                        <div className="flex gap-1 justify-between">
                                            {['D', 'L', 'M', 'M', 'G', 'V', 'S'].map((d, i) => (
                                                <button key={i} onClick={() => toggleDay(i)} className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${formData.availability.daysOfWeek?.includes(i) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-400 hover:border-indigo-400'}`}>{d}</button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs text-gray-500">Ora Start</label><input type="time" value={formData.availability.timeStart || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeStart: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                            <div><label className="text-xs text-gray-500">Ora End</label><input type="time" value={formData.availability.timeEnd || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeEnd: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingId(null)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Annulla</button>
                                <button onClick={handleSaveService} disabled={isSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-md transition-all">{isSaving ? '...' : 'Salva'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* VIEW 4: SETUP TECNICO */}
        {activeTab === 'setup' && !showDashboardOnly && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
                    <div className="border-b border-gray-100 pb-6 mb-6">
                        <h3 className="font-bold text-2xl text-gray-900">Setup Tecnico: {currentConfig?.business_name}</h3>
                        <p className="text-sm text-gray-500 mt-1">Configura le integrazioni esterne per questo cliente.</p>
                    </div>
                    
                    <div className="space-y-8">
                        {/* SEZIONE 1: GOOGLE CALENDAR (ROBOT/SERVICE ACCOUNT) */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shadow-sm">1</span> 
                                Integrazione Google Calendar (Robot Service Account)
                            </h4>
                            
                            <div className="grid gap-5 relative z-10">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ID Calendario Target Cliente (Email)</label>
                                    <input 
                                        className="w-full border border-gray-300 p-3 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder={currentConfig?.email_owner}
                                        value={configData.targetCalendarId} 
                                        onChange={e => setConfigData({...configData, targetCalendarId: e.target.value})} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">L'ID del calendario del cliente (es. badhead1973@gmail.com). **Il Service Account Robot deve avere i permessi.**</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Service Account JSON (Robot)</label>
                                    <textarea 
                                        className="w-full border border-gray-300 p-3 rounded-lg h-32 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder='{ "type": "service_account", ... }' 
                                        value={configData.serviceAccountJson} 
                                        onChange={e => setConfigData({...configData, serviceAccountJson: e.target.value})} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Il file JSON scaricato da Google Cloud Console per il Service Account.</p>
                                </div>
                            </div>
                        </div>

                        {/* SEZIONE 2: ALTRE API (Gemini e EmailJS) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Gemini API (API Key) */}
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs shadow-sm">2</span> 
                                    Google Gemini AI
                                </h4>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                                    <input className="w-full border border-gray-300 p-3 rounded-lg font-mono text-sm" placeholder="AIza..." value={configData.apiKey} onChange={e => setConfigData({...configData, apiKey: e.target.value})} />
                                </div>
                            </div>

                            {/* EmailJS (Notifiche) */}
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs shadow-sm">3</span> 
                                    EmailJS (Notifiche Automatiche)
                                </h4>
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Service ID</label>
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Service ID" value={configData.emailServiceId} onChange={e => setConfigData({...configData, emailServiceId: e.target.value})} />
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Template ID</label>
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Template ID" value={configData.emailTemplateId} onChange={e => setConfigData({...configData, emailTemplateId: e.target.value})} />
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Public Key</label>
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Public Key" value={configData.emailPublicKey} onChange={e => setConfigData({...configData, emailPublicKey: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={handleSaveConfig} disabled={isSaving} className="bg-gray-900 hover:bg-black text-white w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                            {isSaving ? 'Salvataggio in corso...' : 'Salva Configurazione'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default AdminPanel;
