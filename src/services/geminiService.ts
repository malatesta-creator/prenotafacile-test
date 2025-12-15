import { Booking, BookingStatus, ClientConfig } from '../types';

export const sendBookingStatusEmail = async (booking: Booking, status: BookingStatus, config: ClientConfig) => {
    
    if (!config.emailjs_service_id || !config.emailjs_template_id || !config.emailjs_public_key) {
        console.warn("Mancano le chiavi EmailJS. Impossibile inviare la notifica.");
        return;
    }

    const templateParams = {
        to_name: booking.clientName,
        to_email: booking.clientEmail,
        client_cc_email: config.email_owner,
        service_name: booking.service.title,
        date_time: `${booking.date} alle ${booking.timeSlot.startTime}`,
        status: status,
        business_name: config.business_name || 'Servizio Prenotazioni',
    };

    console.log(`[EMAIL ROBOT] Simulazione invio email a ${booking.clientEmail} (Status: ${status}) utilizzando EmailJS.`);
};
