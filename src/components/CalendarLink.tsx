import React from 'react';
import { Booking } from '../types'; 

interface CalendarLinkProps {
    booking: Booking;
}

const CalendarLink: React.FC<CalendarLinkProps> = ({ booking }) => {
    const googleCalendarUrl = `https://calendar.google.com/calendar/r/eventedit?text=${booking.service.title}&dates=${booking.date}T${booking.timeSlot.startTime.replace(':', '')}00/${booking.date}T${booking.timeSlot.endTime.replace(':', '')}00&details=${booking.notes}&location=Virtual&sf=true&output=xml`;

    return (
        <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold">
            Aggiungi al Calendario
        </a>
    );
};

export default CalendarLink;
