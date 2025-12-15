import React, { Dispatch, SetStateAction } from 'react';
import { Service } from '../types';

interface ServiceListProps {
    services: Service[];
    onSelectService: Dispatch<SetStateAction<Service | null>>;
    onNextStep: () => void;
}

const ServiceList: React.FC<ServiceListProps> = ({ services, onSelectService, onNextStep }) => {
    
    const handleSelect = (service: Service) => {
        onSelectService(service);
        onNextStep(); 
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Seleziona un Servizio</h2>
            {services.map(service => (
                <div 
                    key={service.id} 
                    className="p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-indigo-50 transition-colors"
                    onClick={() => handleSelect(service)}
                >
                    <div className="font-bold text-gray-800">{service.title}</div>
                    <div className="text-sm text-gray-500">{service.durationMinutes} min - €{service.price}</div>
                </div>
            ))}
            {services.length === 0 && <p className="text-center text-gray-500">Nessun servizio configurato.</p>}
        </div>
    );
};

export default ServiceList;
