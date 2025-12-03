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
  
  const [configData, setConfigData] = useState({
      apiKey: clientConfig.google_api_key || '',
      calendarId: clientConfig.email_bridge || '',
      emailServiceId: clientConfig.emailjs_service_id || '',
      emailTemplateId: clientConfig.emailjs_template_id || '',
      emailPublicKey: clientConfig.emailjs_public_key || '',
      serviceAccountJson: clientConfig.service_account_json || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // -- BOOKING ACTION STATE --
  const [processingAction, setProcessingAction] = useState<{id: string, status: BookingStatus} | null>(null);

  // Carica la lista clienti se sono Master
  useEffect(() => {
    if (userRole === 'MASTER') {
        getAllClients().then(clients => setAllClients(clients));
    }
  }, [userRole]);

  // Gestione modifica servizio
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
      
      setConfigData({
          apiKey: client.google_api_key || '',
          calendarId: client.email_bridge || '',
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
          await updateClientConfig(targetClientId, {
              google_api_key: configData.apiKey,
              email_bridge: configData.calendarId,
              emailjs_service_id: configData.emailServiceId,
              emailjs_template_id: configData.emailTemplateId,
              emailjs_public_key: configData.emailPublicKey,
              service_account_json: configData.serviceAccountJson
          });
          alert(`Configurazione salvata per ${targetClientName}!`);
      } catch (e) { 
          alert("Errore salvataggio config"); 
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
                {userRole === 'MASTER' ? `Master Control: ${targetClientName}` : `Admin: ${clientConfig.business_name}`}
            </h1>
        </div>
        <div className="flex gap-4">
            <nav className="flex bg-gray-800 rounded-lg p-1">
                {userRole === 'MASTER' && <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'dashboard' ? 'bg-gray-700' : 'text-gray-400'}`}>Clienti</button>}
                <button onClick={() => setActiveTab('bookings')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'bookings' ? 'bg-gray-700' : 'text-gray-400'}`}>Prenotazioni</button>
                <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'services' ? 'bg-gray-700' : 'text-gray-400'}`}>Servizi</button>
                {userRole === 'MASTER' && <button onClick={() => setActiveTab('setup')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'setup' ? 'bg-gray-700' : 'text-gray-400'}`}>⚙️ Setup</button>}
            </nav>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700">Esci</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 w-full">
        
        {/* DASHBOARD MASTER (LISTA CLIENTI) */}
        {activeTab === 'dashboard' && userRole === 'MASTER' && (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Lista Clienti (SaaS)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allClients.map(client => (
                        <div key={client.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <h3 className="font-bold text-lg text-indigo-600 mb-1">{client.business_name}</h3>
                            <p className="text-sm text-gray-500 mb-4">{client.subdomain}.prenotafacile.it</p>
                            <div className="text-xs text-gray-400 mb-4">Admin: {client.email_owner}</div>
                            <button 
                                onClick={() => handleSelectClientToEdit(client)}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold"
                            >
                                Modifica Setup ⚙️
                            </button>
                        </div>
                    ))}
                    {allClients.length === 0 && <p className="text-gray-500">Nessun cliente trovato nel database.</p>}
                </div>
            </div>
        )}

        {/* PRENOTAZIONI */}
        {activeTab === 'bookings' && (
            <div className="space-y-4">
                {bookings.map(booking => {
                    const isProcessing = processingAction?.id === booking.id;
                    const isCancelling = isProcessing && processingAction?.status === BookingStatus.CANCELLED;
                    const isConfirming = isProcessing && processingAction?.status === BookingStatus.CONFIRMED;

                    return (
                        <div key={booking.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                            <div>
                                <div className="font-bold">{booking.clientName} {booking.clientSurname}</div>
                                <div className="text-sm text-gray-600">{booking.service.title} - {booking.date} @ {booking.timeSlot.startTime}</div>
                                <div className="text-xs font-mono mt-1 px-2 py-0.5 bg-gray-100 inline-block rounded">{booking.status}</div>
                            </div>
                            {booking.status === 'PENDING' && (
                                <div className="flex gap-2">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CANCELLED)} 
                                        className={`px-3 py-1 rounded text-sm font-bold text-white ${isProcessing ? 'bg-gray-400' : 'bg-red-700 hover:bg-red-800'}`}
                                    >
                                        {isCancelling ? '...' : 'Rifiuta'}
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleBookingAction(booking.id, BookingStatus.CONFIRMED)} 
                                        className={`px-3 py-1 rounded text-sm font-bold text-white ${isProcessing ? 'bg-gray-400' : 'bg-green-700 hover:bg-green-800'}`}
                                    >
                                        {isConfirming ? '...' : 'Conferma'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
                {bookings.length === 0 && <p>Nessuna prenotazione per {clientConfig.business_name}.</p>}
            </div>
        )}

        {/* SERVIZI */}
        {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold mb-4">Servizi di {clientConfig.business_name}</h3>
                    {services.map(s => <div key={s.id} onClick={() => setEditingId(s.id)} className="bg-white p-4 mb-2 rounded shadow cursor-pointer hover:border-indigo-500 border">{s.title}</div>)}
                    <button onClick={() => setEditingId('new')} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded font-bold w-full">+ Nuovo Servizio</button>
                </div>
                {editingId && (
                    <div className="bg-white p-6 rounded shadow h-fit">
                        <h3 className="font-bold mb-4">{editingId === 'new' ? 'Nuovo' : 'Modifica'}</h3>
                        <input className="w-full border p-2 mb-2 rounded" placeholder="Titolo" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        <input className="w-full border p-2 mb-2 rounded" placeholder="Prezzo" type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} />
                        <textarea className="w-full border p-2 mb-2 rounded" placeholder="Descrizione" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-3">Regole Disponibilità</label>
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'always'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'always' }})} /><span className="text-sm">Sempre</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'range'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'range' }})} /><span className="text-sm">Periodo</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" checked={formData.availability.mode === 'weekly'} onChange={() => setFormData({...formData, availability: { ...formData.availability, mode: 'weekly' }})} /><span className="text-sm">Settimanale</span></label>
                            </div>

                            {(formData.availability.mode === 'range' || formData.availability.mode === 'weekly') && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div><label className="text-xs text-gray-500">Valido dal</label><input type="date" value={formData.availability.startDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, startDate: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                    <div><label className="text-xs text-gray-500">Valido fino al</label><input type="date" value={formData.availability.endDate || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, endDate: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                </div>
                            )}

                            {formData.availability.mode === 'weekly' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Giorni</label>
                                        <div className="flex gap-2">
                                            {['D', 'L', 'M', 'M', 'G', 'V', 'S'].map((d, i) => (
                                                <button key={i} onClick={() => toggleDay(i)} className={`w-8 h-8 rounded-full text-xs font-bold ${formData.availability.daysOfWeek?.includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>{d}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs text-gray-500">Inizio</label><input type="time" value={formData.availability.timeStart || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeStart: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                        <div><label className="text-xs text-gray-500">Fine</label><input type="time" value={formData.availability.timeEnd || ''} onChange={e => setFormData({...formData, availability: {...formData.availability, timeEnd: e.target.value}})} className="w-full p-2 border rounded text-sm" /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={handleSaveService} disabled={isSaving} className="bg-indigo-600 text-white px-4 py-2 rounded w-full font-bold">{isSaving ? 'Salvataggio...' : 'Salva Servizio'}</button>
                    </div>
                )}
            </div>
        )}

        {/* SETUP (Solo Master) */}
        {activeTab === 'setup' && userRole === 'MASTER' && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded shadow space-y-4">
                <div className="border-b pb-4 mb-4">
                    <h3 className="font-bold text-lg">Setup Tecnico</h3>
                    <p className="text-sm text-indigo-600">Stai modificando: <strong>{targetClientName}</strong></p>
                </div>
                
                <label className="block text-sm font-bold mt-4">Google Calendar API Key (Lettura)</label>
                <input className="w-full border p-2 rounded" placeholder="AIza..." value={configData.apiKey} onChange={e => setConfigData({...configData, apiKey: e.target.value})} />
                
                <label className="block text-sm font-bold mt-4">Email Ponte (Lettura)</label>
                <input className="w-full border p-2 rounded" placeholder="email@gmail.com" value={configData.calendarId} onChange={e => setConfigData({...configData, calendarId: e.target.value})} />
                
                <hr className="my-4"/>
                <h4 className="font-bold text-indigo-600">Automazione Scrittura (Service Account)</h4>
                <p className="text-xs text-gray-500 mb-2">Incolla qui l'intero contenuto del file JSON scaricato da Google Cloud.</p>
                <textarea 
                    className="w-full border p-2 rounded h-32 text-xs font-mono" 
                    placeholder='{"type": "service_account", ...}' 
                    value={configData.serviceAccountJson} 
                    onChange={e => setConfigData({...configData, serviceAccountJson: e.target.value})} 
                />

                <hr className="my-4"/>
                <h4 className="font-bold text-indigo-600">EmailJS (Notifiche)</h4>
                <input className="w-full border p-2 rounded" placeholder="Service ID" value={configData.emailServiceId} onChange={e => setConfigData({...configData, emailServiceId: e.target.value})} />
                <input className="w-full border p-2 rounded" placeholder="Template ID" value={configData.emailTemplateId} onChange={e => setConfigData({...configData, emailTemplateId: e.target.value})} />
                <input className="w-full border p-2 rounded" placeholder="Public Key" value={configData.emailPublicKey} onChange={e => setConfigData({...configData, emailPublicKey: e.target.value})} />
                
                <button onClick={handleSaveConfig} disabled={isSaving} className="bg-indigo-600 text-white w-full py-3 rounded font-bold mt-6 shadow-lg">{isSaving ? 'Salvataggio...' : 'Salva Configurazione'}</button>
            </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
