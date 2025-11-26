import React from 'react';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  onSelect: (service: Service) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onSelect }) => {
  const getAvailabilityBadge = () => {
    const { mode, startDate, endDate, daysOfWeek } = service.availability;
    if (mode === 'range' && startDate && endDate) {
        const start = new Date(startDate).toLocaleDateString('it-IT', {day: 'numeric', month: 'short'});
        const end = new Date(endDate).toLocaleDateString('it-IT', {day: 'numeric', month: 'short'});
        return `Dal ${start} al ${end}`;
    }
    if (mode === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
        if (daysOfWeek.length === 5 && !daysOfWeek.includes(0) && !daysOfWeek.includes(6)) return "Lun - Ven";
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        return daysOfWeek.map(d => dayNames[d]).join(', ');
    }
    return null;
  };
  const badgeText = getAvailabilityBadge();

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer flex flex-col h-full relative" onClick={() => onSelect(service)}>
      <div className="h-48 overflow-hidden relative">
        <img src={service.imageUrl} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex justify-between items-end">
          <span className="inline-block px-3 py-1 bg-white/90 backdrop-blur-sm text-indigo-600 text-xs font-bold rounded-full shadow-sm">{service.durationMinutes} min</span>
          {badgeText && <span className="inline-block px-3 py-1 bg-amber-400/90 backdrop-blur-sm text-amber-900 text-xs font-bold rounded-full shadow-sm">{badgeText}</span>}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">{service.title}</h3>
        <p className="text-gray-600 text-sm mb-4 flex-grow leading-relaxed">{service.description}</p>
        <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-50">
          <span className="text-2xl font-bold text-gray-900">{service.price === 0 ? 'Gratis' : `€${service.price}`}</span>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">Prenota</button>
        </div>
      </div>
    </div>
  );
};
export default ServiceCard;
