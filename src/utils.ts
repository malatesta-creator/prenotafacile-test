export const getCurrentSubdomain = () => {
    if (typeof window === 'undefined') {
        return '';
    }
    
    const hostnameParts = window.location.hostname.split('.');
    
    if (hostnameParts.length > 2) {
        if (hostnameParts[0] === 'localhost' || hostnameParts.length > 3) {
             return hostnameParts[0] === 'localhost' ? '' : hostnameParts[0];
        }
    }
    
    return '';
};
