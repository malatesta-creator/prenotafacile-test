export const getCurrentSubdomain = () => {
    if (typeof window === 'undefined') return '';
    
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    if (hostname.includes('vercel.app') && parts.length >= 3) {
        return parts[0];
    }

    return parts.length > 2 ? parts[0] : 'badhead1973';
};
