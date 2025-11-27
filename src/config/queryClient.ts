import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // Los datos son frescos por 5 segundos
      gcTime: 10 * 60 * 1000, // Caché por 10 minutos (antes cacheTime)
      retry: 2,
      refetchOnWindowFocus: false, // No refetch al cambiar de ventana
      refetchOnReconnect: true, // Sí refetch al reconectar
    },
    mutations: {
      retry: 1,
    },
  },
});
