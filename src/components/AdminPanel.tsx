
import React, { useState, useEffect } from 'react';
import { Service, Booking, BookingStatus, ClientConfig } from '../types';
import { saveServices, updateClientConfig } from '../services/supabaseService';

interface AdminPanelProps {
  services: Service[];
  bookings: Booking[];
  userRole: 'CLIENT' | 'MASTER' | null;
  onUpdateServices: (services: Service[]) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  onClose: () => void;
  clientConfig: ClientConfig; // Dati del cliente (ID, API Keys...)
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    services, bookings, userRole, onUpdateServices, onUpdateBookingStatus, onClose, clientConfig 
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'setup'>('bookings');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Service>({ id: '', title: '', description: '', durationMinutes: 30, price: 0, imageUrl: '', availability: { mode: 'always' } });
  
  // Setup Config State (inizializzato dai dati del DB)
  const [configData, setConfigData] = useState({
      apiKey: clientConfig.google_api_key || '',
      calendarId: clientConfig.email_bridge || '',
      emailServiceId: clientConfig.emailjs_service_id || '',
      emailTemplateId: clientConfig.emailjs_template_id || '',
      emailPublicKey: clientConfig.emailjs_public_key || '',
      serviceAccountJson: clientConfig.service_account_json || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingId === 'new') {
      setFormData({ id: '', title: 'Nuovo Servizio', description: '', durationMinutes: 60, price: 100, imageUrl: '', availability: { mode: 'always' } });
    } else if (editingId) {
      const s = services.find(s => s.id === editingId);
      if (s) setFormData(s);
    }
  }, [editingId, services]);

  const handleSaveService = async () => {
    setIsSaving(true);
    let updatedServices = [...services];
    const cleanData: Service = { ...formData, durationMinutes: Number(formData.durationMinutes), price: Number(formData.price) };
    
    // Se è nuovo, non ha ID, lo gestirà il DB al prossimo fetch o lo mockiamo temporaneamente
    if (editingId === 'new') updatedServices.push(cleanData);
    else updatedServices = updatedServices.map(s => s.id === editingId ? cleanData : s);

    try {
        await saveServices(clientConfig.id, updatedServices);
        onUpdateServices(updatedServices); // Update UI optimistic
        setEditingId(null);
    } catch (e) { alert("Errore salvataggio servizi"); console.error(e); }
    finally { setIsSaving(false); }
  };

  const handleSaveConfig = async () => {
      setIsSaving(true);
      try {
          await updateClientConfig(clientConfig.id, {
              google_api_key: configData.apiKey,
              email_bridge: configData.calendarId,
              emailjs_service_id: configData.emailServiceId,
              emailjs_template_id: configData.emailTemplateId,
              emailjs_public_key: configData.emailPublicKey,
              service_account_json: configData.serviceAccountJson
          });
          alert("Configurazione salvata nel Cloud!");
      } catch (e) { alert("Errore salvataggio config"); console.error(e); }
      finally { setIsSaving(false); }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3"><h1 className="text-xl font-bold">Admin: {clientConfig.business_name}</h1></div>
        <div className="flex gap-4">
            <nav className="flex bg-gray-800 rounded-lg p-1">
                <button onClick={() => setActiveTab('bookings')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'bookings' ? 'bg-gray-700' : 'text-gray-400'}`}>Prenotazioni</button>
                <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'services' ? 'bg-gray-700' : 'text-gray-400'}`}>Servizi</button>
                {userRole === 'MASTER' && <button onClick={() => setActiveTab('setup')} className={`px-4 py-1.5 rounded-md text-sm ${activeTab === 'setup' ? 'bg-gray-700' : 'text-gray-400'}`}>⚙️ Setup</button>}
            </nav>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700">Esci</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 w-full">
        {activeTab === 'bookings' && (
            <div className="space-y-4">
                {bookings.map(b => (
                    <div key={b.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                        <div>
                            <div className="font-bold">{b.clientName} {b.clientSurname}</div>
                            <div className="text-sm text-gray-600">{b.service.title} - {b.date} @ {b.timeSlot.startTime}</div>
                            <div className="text-xs font-mono mt-1 px-2 py-0.5 bg-gray-100 inline-block rounded">{b.status}</div>
                        </div>
                        {b.status === 'PENDING' && (
                            <div className="flex gap-2">
                                <button onClick={() => onUpdateBookingStatus(b.id, BookingStatus.CANCELLED)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-bold">Rifiuta</button>
                                <button onClick={() => onUpdateBookingStatus(b.id, BookingStatus.CONFIRMED)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">Conferma</button>
                            </div>
                        )}
                    </div>
                ))}
                {bookings.length === 0 && <p>Nessuna prenotazione.</p>}
            </div>
        )}

        {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold mb-4">Servizi Attivi</h3>
                    {services.map(s => <div key={s.id} onClick={() => setEditingId(s.id)} className="bg-white p-4 mb-2 rounded shadow cursor-pointer hover:border-indigo-500 border">{s.title}</div>)}
                    <button onClick={() => setEditingId('new')} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded font-bold w-full">+ Nuovo Servizio</button>
                </div>
                {editingId && (
                    <div className="bg-white p-6 rounded shadow h-fit">
                        <h3 className="font-bold mb-4">{editingId === 'new' ? 'Nuovo' : 'Modifica'}</h3>
                        <input className="w-full border p-2 mb-2 rounded" placeholder="Titolo" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        <input className="w-full border p-2 mb-2 rounded" placeholder="Prezzo" type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} />
                        <textarea className="w-full border p-2 mb-2 rounded" placeholder="Descrizione" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        <button onClick={handleSaveService} disabled={isSaving} className="bg-indigo-600 text-white px-4 py-2 rounded w-full font-bold">{isSaving ? 'Salvataggio...' : 'Salva Servizio'}</button>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'setup' && userRole === 'MASTER' && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded shadow space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">Setup Tecnico (Cloud DB)</h3>
                
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
                
                <button onClick={handleSaveConfig} disabled={isSaving} className="bg-indigo-600 text-white w-full py-3 rounded font-bold mt-6 shadow-lg">{isSaving ? 'Salvataggio...' : 'Salva Configurazione Completa'}</button>
            </div>
        )}
      </main>
    </div>
  );
};
export default AdminPanel;
