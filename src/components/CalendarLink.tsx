import React from 'react';
import { BookingDetails } from '../types';

interface CalendarLinkProps {
  booking: BookingDetails;
}

const CalendarLink: React.FC<CalendarLinkProps> = ({ booking }) => {
  const formatGoogleDate = (dateStr: string, timeStr: string, durationMinutes: number) => {
    const start = new Date(`${dateStr}T${timeStr}:00`);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const toISOStripped = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return `${toISOStripped(start)}/${toISOStripped(end)}`;
  };

  const handleAddToGoogleCalendar = () => {
    const { service, date, timeSlot, notes, clientName } = booking;
    const dates = formatGoogleDate(date, timeSlot.startTime, service.durationMinutes);
    const details = `Prenotazione per ${clientName}.\n\nServizio: ${service.description}\nNote: ${notes || 'Nessuna'}`;
    const text = `Appuntamento: ${service.title}`;
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', text);
    url.searchParams.append('dates', dates);
    url.searchParams.append('details', details);
    url.searchParams.append('location', 'Online / Studio');
    window.open(url.toString(), '_blank');
  };

  const handleDownloadICS = () => {
    const { service, date, timeSlot, notes, clientName } = booking;
    const start = new Date(`${date}T${timeSlot.startTime}:00`);
    const end = new Date(start.getTime() + service.durationMinutes * 60000);
    const formatICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const now = formatICSDate(new Date());
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//PrenotaFacile//IT\nBEGIN:VEVENT\nUID:${Date.now()}@prenotafacile.app\nDTSTAMP:${now}\nDTSTART:${formatICSDate(start)}\nDTEND:${formatICSDate(end)}\nSUMMARY:Appuntamento: ${service.title}\nDESCRIPTION:Cliente: ${clientName}. Note: ${notes || 'Nessuna'}\nLOCATION:Online / Studio\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `prenotazione-${date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      <button onClick={handleAddToGoogleCalendar} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm">
        Google Calendar
      </button>
      <button onClick={handleDownloadICS} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-3 rounded-xl font-semibold hover:bg-gray-900 transition-colors shadow-sm">
        Apple Calendar
      </button>
    </div>
  );
};
export default CalendarLink;
