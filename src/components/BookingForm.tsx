import React from 'react';
import { Service, TimeSlot, ClientData, Booking } from '../types';

interface BookingFormProps {
    selectedService: Service | null;
    selectedSlot: TimeSlot | null;
    onSelectSlot: React.Dispatch<React.SetStateAction<TimeSlot | null>>;
    onSubmit: (
        bookingFormDetails: Omit<Booking, 'id' | 'createdAt' | 'status' | 'timeSlot' | 'service' | 'clientId'>, 
        clientData: ClientData
    ) => Promise<void>;
    onBack: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ selectedService, selectedSlot, onSelectSlot, onSubmit, onBack }) => {
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // CORREZIONE TS2741: Aggiunti clientPhone e notes
        const dummyBookingDetails: Omit<Booking, 'id' | 'createdAt' | 'status' | 'timeSlot' | 'service' | 'clientId'> = {
            date: '2025-12-30',
            clientName: 'Mario',
            clientSurname: 'Rossi',
            clientEmail: 'mario.rossi@example.com',
            clientPhone: '1234567890', // ERA MANCANTE!
            notes: 'Nota di test',      // ERA MANCANTE!
        };
        
        // Questo oggetto non è più necessario, ma lo lasciamo per la chiamata a onSubmit
        const dummyClientData: ClientData = {
            clientPhone: '1234567890',
            notes: 'Nota di test',
        };

        if (selectedSlot) {
            onSubmit(dummyBookingDetails, dummyClientData);
        } else {
            alert("Seleziona uno slot prima di inviare.");
        }
    };

    if (!selectedService) return <p>Seleziona prima un servizio.</p>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Prenota: {selectedService.title}</h2>
            <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800">← Torna ai servizi</button>
            
            <div className="p-4 bg-gray-50 border rounded-lg">
                 <p className="font-semibold">Slot Selezionato: {selectedSlot ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : 'Nessuno'}</p>
                 <button 
                    onClick={() => onSelectSlot({ id: 'ts1', startTime: '09:00', endTime: '10:00' })}
                    className="mt-2 text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                 >Simula Selezione Slot</button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-500">Qui andrebbero i campi Nome, Cognome, Email, Telefono, Note.</p>
                <button type="submit" className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors">
                    Simula Prenotazione
                </button>
            </form>
        </div>
    );
};

export default BookingForm;
