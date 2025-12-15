import React, { useState, useEffect } from 'react';
import { Service, Booking, BookingStatus, ClientConfig } from '../types';
import { saveServices, updateClientConfig, getAllClients } from '../services/supabaseService';

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
    services, 
    bookings, 
    userRole, 
    onUpdateServices, 
    onUpdateBookingStatus, 
    onClose, 
    clientConfig 
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'setup' | 'dashboard'>(userRole === 'MASTER' ? 'dashboard' : 'bookings');
  
  // -- MASTER DASHBOARD STATE --
  const [allClients, setAllClients] = useState<ClientConfig[]>([]);
  const [targetClientId, setTargetClientId] = useState<string>(clientConfig.id);
  const [targetClientName, setTargetClientName] = useState<string>(clientConfig.business_name);
  const [targetClientSubdomain, setTargetClientSubdomain] = useState<string>(clientConfig.subdomain);

  // -- EDITING STATE --
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
  
  // Config Data: Mappiamo i campi del DB sui nuovi concetti
  // email_bridge nel DB ora lo usiamo come "Target Calendar ID" generico
  const [configData, setConfigData] = useState({
      apiKey: clientConfig.google_api_key || '',
      targetCalendarId: clientConfig.email_bridge || '', 
      emailServiceId: clientConfig.emailjs_service_id || '',
      emailTemplateId: clientConfig.emailjs_template_id || '',
      emailPublicKey: clientConfig.emailjs_public_key || '',
      serviceAccountJson: clientConfig.service_account_json || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // -- BOOKING ACTION STATE --
  const [processingAction, setProcessingAction] = useState<{id: string, status: BookingStatus} | null>(null);

  useEffect(() => {
    if (userRole === 'MASTER') {
        getAllClients().then(clients => setAllClients(clients));
    }
  }, [userRole]);

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
      const s = services.find(s => s.id === editingId);
      if (s) setFormData(s);
    }
  }, [editingId, services]);

  const handleSelectClientToEdit = (client: ClientConfig) => {
      setTargetClientId(client.id);
      setTargetClientName(client.business_name);
      setTargetClientSubdomain(client.subdomain);
      
      setConfigData({
          apiKey: client.google_api_key || '',
          targetCalendarId: client.email_bridge || '', // Usiamo questo campo come ID Calendario Target
          emailServiceId: client.emailjs_service_id || '',
          emailTemplateId: client.emailjs_template_id || '',
          emailPublicKey: client.emailjs_public_key || '',
          serviceAccountJson: client.service_account_json || ''
      });

      setActiveTab('setup');
  };

  const handleSaveService = async () => {
    setIsSaving(true);
    let updatedServices = [...services];
    const cleanData: Service = { 
        ...formData, 
        durationMinutes: Number(formData.durationMinutes), 
        price: Number(formData.price) 
    };
    
    if (editingId === 'new') updatedServices.push(cleanData);
    else updatedServices = updatedServices.map(s => s.id === editingId ? cleanData : s);

    try {
        await saveServices(clientConfig.id, updatedServices);
        onUpdateServices(updatedServices);
        setEditingId(null);
    } catch (e) { 
        alert("Errore salvataggio servizi"); 
        console.error(e); 
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleSaveConfig = async () => {
      setIsSaving(true);
      try {
          // Salvataggio nel DB Supabase
          await updateClientConfig(targetClientId, {
              google_api_key: configData.apiKey,
              email_bridge: configData.targetCalendarId, // Salviamo l'ID calendario qui
              emailjs_service_id: configData.emailServiceId,
              emailjs_template_id: configData.emailTemplateId,
              emailjs_public_key: configData.emailPublicKey,
              service_account_json: configData.serviceAccountJson
          });
          
          alert(`✅ Configurazione salvata con successo per ${targetClientName}!`);
          
          // Se siamo Master, ricarichiamo la lista per avere i dati aggiornati
          if (userRole === 'MASTER') {
             const updatedClients = await getAllClients();
             setAllClients(updatedClients);
          }
      } catch (e) { 
          alert("Errore durante il salvataggio della configurazione."); 
          console.error(e); 
      } finally { 
          setIsSaving(false); 
      }
  };

  const handleBookingAction = async (id: string, status: BookingStatus) => {
    if (!window.confirm(status === BookingStatus.CONFIRMED ? "Confermare questo appuntamento?" : "Cancellare questo appuntamento?")) return;
    
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

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
                {userRole === 'MASTER' ? `Master Control` : `Admin: ${clientConfig.business_name}`}
            </h1>
            {userRole === 'MASTER' && activeTab === 'setup' && (
                <span className="bg-indigo-600 text-xs px-2 py-1 rounded text-white font-mono">Modifica: {targetClientName}</span>
            )}
        </div>
        <div className="flex gap-4">
            <nav className="flex bg-gray-800 rounded-lg p-1">
                {userRole === 'MASTER' && <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'dashboard' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Clienti</button>}
                <button onClick={() => setActiveTab('bookings')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'bookings' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Prenotazioni</button>
                <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'services' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Servizi</button>
                {userRole === 'MASTER' && <button onClick={() => setActiveTab('setup')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'setup' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>⚙️ Setup Tecnico</button>}
            </nav>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700 transition-colors">Esci</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 w-full">
        
        {/* DASHBOARD MASTER (LISTA CLIENTI) */}
        {activeTab === 'dashboard' && userRole === 'MASTER' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-end border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Gestionale Clienti</h2>
                        <p className="text-gray-500">Seleziona un cliente per configurare il suo calendario e servizi.</p>
                    </div>
                    <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-lg">Totale Clienti: <strong>{allClients.length}</strong></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allClients.map(client => (
                        <div key={client.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all group relative">
                            <div className="absolute top-4 right-4">
                                {client.service_account_json ? (
                                    <span title="Configurato" className="w-3 h-3 bg-green-500 rounded-full block"></span>
                                ) : (
                                    <span title="Manca Setup" className="w-3 h-3 bg-red-400 rounded-full block animate-pulse"></span>
                                )}
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 mb-1">{client.business_name}</h3>
                            <p className="text-sm text-indigo-600 font-medium mb-4">{client.subdomain}.prenotafacile.it</p>
                            
                            <div className="space-y-2 text-xs text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg">
                                <div className="flex justify-between"><span>Owner:</span> <span className="text-gray-900 font-mono truncate max-w-[150px]">{client.email_owner}</span></div>
                                <div className="flex justify-between"><span>Target Cal:</span> <span className="text-gray-900 font-mono truncate max-w-[150px]">{client.email_bridge || '-'}</span></div>
                            </div>

                            <button 
                                onClick={() => handleSelectClientToEdit(client)}
                                className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-600 transition-colors"
                            >
                                Configura Cliente ⚙️
                            </button>
                        </div>
                    ))}
                    {allClients.length === 0 && <p className="text-gray-500 italic col-span-3 text-center py-10">Nessun cliente nel database.</p>}
                </div>
            </div>
        )}

        {/* PRENOTAZIONI */}
        {activeTab === 'bookings' && (
            <div className="space-y-4 animate-fade-in">
                {bookings.map(booking => {
                    const isProcessing = processingAction?.id === booking.id;
                    const isCancelling = isProcessing && processingAction?.status === BookingStatus.CANCELLED;
                    const isConfirming = isProcessing && processingAction?.status === BookingStatus.CONFIRMED;

                    return (
                        <div key={booking.id} className="bg-white p-4 rounded shadow flex justify-between items-center border border-gray-100">
                            <div>
                                <div className="font-bold text-lg">{booking.clientName} {booking.clientSurname}</div>
                                <div className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="font-medium text-indigo-600">{booking.service.title}</span>
                                    <span>•</span>
                                    <span>{new Date(booking.date).toLocaleDateString()} ore {booking.timeSlot.startTime}</span>
                                </div>
                                <div className={`text-xs font-bold uppercase mt-2 inline-block px-2 py-0.5 rounded ${booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{booking.status}</div>
                            </div>
                            {booking.status === 'PENDING' && (
                                <div className="flex gap-2">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CANCELLED)} 
                                        className={`px-3 py-1.5 rounded text-sm font-bold text-white shadow-sm transition-all ${isProcessing ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
                                    >
                                        {isCancelling ? '...' : 'Rifiuta'}
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CONFIRMED)} 
                                        className={`px-3 py-1.5 rounded text-sm font-bold text-white shadow-sm transition-all ${isProcessing ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {isConfirming ? '...' : 'Conferma'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
                {bookings.length === 0 && <p className="text-center py-10 text-gray-500">Nessuna prenotazione attiva per {clientConfig.business_name}.</p>}
            </div>
        )}

        {/* SERVIZI */}
        {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800">Catalogo Servizi</h3>
                        <button onClick={() => setEditingId('new')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors">+ Nuovo</button>
                    </div>
                    <div className="space-y-3">
                        {services.map(s => (
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
                            <button onClick={handleSaveService} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg w-full font-bold shadow-md transition-all">{isSaving ? 'Salvataggio...' : 'Salva Modifiche'}</button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* SETUP TECNICO (Solo Master) */}
        {activeTab === 'setup' && userRole === 'MASTER' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
                    <div className="border-b border-gray-100 pb-6 mb-6">
                        <h3 className="font-bold text-2xl text-gray-900">Configurazione Tecnica Cliente</h3>
                        <p className="text-sm text-indigo-600 mt-1 font-medium bg-indigo-50 inline-block px-3 py-1 rounded-full">
                            Stai modificando: {targetClientName} <span className="text-gray-400 font-normal">({targetClientSubdomain})</span>
                        </p>
                    </div>
                    
                    <div className="space-y-6">
                        {/* SEZIONE 1: GOOGLE CALENDAR */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">1</span> 
                                Connessione Google Calendar
                            </h4>
                            
                            <div className="grid gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ID Calendario Google (Target)</label>
                                    <p className="text-xs text-gray-500 mb-2">L'indirizzo email o ID del calendario su cui verificare disponibilità e scrivere appuntamenti.</p>
                                    <input 
                                        className="w-full border border-gray-300 p-3 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder="es. mario.rossi@gmail.com" 
                                        value={configData.targetCalendarId} 
                                        onChange={e => setConfigData({...configData, targetCalendarId: e.target.value})} 
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Service Account JSON (Robot)</label>
                                    <p className="text-xs text-gray-500 mb-2">Le credenziali complete del Robot che accede al calendario (da Google Cloud Console).</p>
                                    <textarea 
                                        className="w-full border border-gray-300 p-3 rounded-lg h-40 text-xs font-mono bg-gray-900 text-green-400 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder='{ "type": "service_account", "project_id": ... }' 
                                        value={configData.serviceAccountJson} 
                                        onChange={e => setConfigData({...configData, serviceAccountJson: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SEZIONE 2: AI & NOTIFICHE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs">2</span> 
                                    Intelligenza Artificiale
                                </h4>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                                    <input className="w-full border border-gray-300 p-3 rounded-lg font-mono text-sm" placeholder="AIza..." value={configData.apiKey} onChange={e => setConfigData({...configData, apiKey: e.target.value})} />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs">3</span> 
                                    Notifiche Email (EmailJS)
                                </h4>
                                <div className="space-y-3">
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Service ID" value={configData.emailServiceId} onChange={e => setConfigData({...configData, emailServiceId: e.target.value})} />
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Template ID" value={configData.emailTemplateId} onChange={e => setConfigData({...configData, emailTemplateId: e.target.value})} />
                                    <input className="w-full border border-gray-300 p-2 rounded text-sm" placeholder="Public Key" value={configData.emailPublicKey} onChange={e => setConfigData({...configData, emailPublicKey: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={handleSaveConfig} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                            {isSaving ? 'Salvataggio in corso...' : 'Salva Configurazione Cliente'}
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
