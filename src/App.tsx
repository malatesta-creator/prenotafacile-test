import React, { useState, useEffect } from 'react';
import { Service, Booking, ClientConfig, BookingStatus, TimeSlot, ClientData } from './types'; 
import { getClientBySubdomain, getServices, getBookings, createBooking } from './services/supabaseService';
import BookingForm from './components/BookingForm';
import ServiceList from './components/ServiceList';
import AdminPanel from './components/AdminPanel';
import Header from './components/Header';
import { getCurrentSubdomain } from './utils';

type AppStep = 'select_service' | 'select_slot' | 'fill_details' | 'confirm_booking' | 'admin_panel';

const App: React.FC = () => {
    const [step, setStep] = useState<AppStep>('select_service');
    const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [userRole, setUserRole] = useState<'CLIENT' | 'MASTER' | null>(null);
    const [isClientLoaded, setIsClientLoaded] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        const subdomain = getCurrentSubdomain();
        const loadClientData = async () => {
            const config = await getClientBySubdomain(subdomain);
            if (config) {
                setClientConfig(config);
                const srvs = await getServices(config.id);
                setServices(srvs);
                const bks = await getBookings(config.id);
                setBookings(bks);
                setIsClientLoaded(true);
            } else {
                console.log("Configurazione non trovata per il sottodominio. Uso il fallback 'badhead1973'.");
                setIsClientLoaded(true); 
            }
        };
        loadClientData();
    }, []);

    const handleNextStep = () => {
        // Logica per cambiare passo (omessa)
    };

    const handleAuth = async (email: string, passwordAttempt: string) => {
        // Logica di autenticazione (omessa)
    };
    
    // Logica di prenotazione e tipi (Risolve l'errore TS2345)
    const handleBookingSubmit = async (bookingFormDetails: Omit<Booking, 'id' | 'createdAt' | 'status' | 'timeSlot' | 'service' | 'clientId'>, clientData: ClientData) => {
        if (!clientConfig || !selectedService || !selectedSlot) return;

        const newBooking: Omit<Booking, 'id' | 'createdAt'> = {
            clientId: clientConfig.id,
            status: BookingStatus.PENDING,
            date: bookingFormDetails.date,
            timeSlot: selectedSlot,
            clientName: bookingFormDetails.clientName,
            clientSurname: bookingFormDetails.clientSurname,
            clientEmail: bookingFormDetails.clientEmail,
            clientPhone: clientData.clientPhone, 
            notes: clientData.notes,
            service: selectedService,
        };

        try {
            await createBooking(newBooking, clientData); 
            setStep('confirm_booking');
        } catch (error) {
            console.error("Errore nella creazione della prenotazione:", error);
            alert("Errore durante la prenotazione. Riprova.");
        }
    };

    const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
        // Logica per l'Admin Panel (omessa)
    };

    const renderContent = () => {
        if (step === 'admin_panel') {
             return <AdminPanel 
                        services={services} 
                        bookings={bookings} 
                        userRole={userRole} 
                        onUpdateServices={() => {}} 
                        onUpdateBookingStatus={handleUpdateBookingStatus} 
                        onClose={() => setStep('select_service')} 
                        clientConfig={clientConfig!}
                    />;
        }
        
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <Header onAuthOpen={() => setIsAuthModalOpen(true)} userRole={userRole} />
                <div className="w-full max-w-2xl bg-white shadow-xl rounded-lg p-6">
                    {step === 'select_service' && (
                        <ServiceList services={services} onSelectService={setSelectedService} onNextStep={() => setStep('select_slot')} />
                    )}
                    {(step === 'select_slot' || step === 'fill_details') && (
                        <BookingForm 
                            selectedService={selectedService} 
                            selectedSlot={selectedSlot}
                            onSelectSlot={setSelectedSlot}
                            onSubmit={handleBookingSubmit} 
                            onBack={() => setStep('select_service')}
                        />
                    )}
                    {step === 'confirm_booking' && (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-green-600 mb-4">Prenotazione Confermata!</h2>
                            <p>Riceverai una mail con tutti i dettagli.</p>
                            <button onClick={() => setStep('select_service')} className="mt-6 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">
                                Nuova Prenotazione
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!isClientLoaded) return <div>Caricamento configurazione...</div>;
    if (!clientConfig) return <div>Cliente non trovato o servizio non attivo.</div>;

    return (
        <div className="App">
            {renderContent()}
        </div>
    );
};

export default App;
