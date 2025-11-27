import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import { DeviceInfo } from '../types/device';
import { MeshMessage } from '../types/message';
import api from '../services/api';

// Query key for consolidated poll
export const pollQueryKey = ['poll'] as const;

interface PollData {
  nodes: DeviceInfo[];
  messages: any[];
  config: any;
  deviceConfig: any;
  telemetryNodes: {
    nodes: string[];
    weather: string[];
    estimatedPosition: string[];
    pkc: string[];
  };
  channels: any[];
  connection: {
    connected: boolean;
    nodeResponsive: boolean;
    configuring: boolean;
    userDisconnected: boolean;
  };
}

interface UsePollOptions {
  enabled: boolean;
  baseUrl: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSuccess?: (data: PollData) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook para polling consolidado usando TanStack Query
 * Reemplaza el setInterval manual con refetchInterval automático
 */
export function usePoll(options: UsePollOptions) {
  const { enabled, baseUrl, authFetch, onSuccess, onError } = options;
  const queryClient = useQueryClient();
  
  // Track if we're currently processing to avoid duplicate processing
  const processingRef = useRef(false);
  
  const query = useQuery({
    queryKey: pollQueryKey,
    queryFn: async (): Promise<PollData> => {
      const response = await authFetch(`${baseUrl}/api/poll`);
      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }
      return response.json();
    },
    enabled,
    refetchInterval: enabled ? 5000 : false, // Polling cada 5 segundos
    refetchIntervalInBackground: false, // No polling cuando la ventana no está en foco
    staleTime: 4000, // Datos frescos por 4 segundos
    gcTime: 10000, // Mantener en caché 10 segundos
    retry: 1, // Solo 1 reintento en caso de error
  });

  // Procesar datos cuando la query tiene éxito
  useEffect(() => {
    if (query.data && !processingRef.current && onSuccess) {
      processingRef.current = true;
      try {
        onSuccess(query.data);
      } finally {
        processingRef.current = false;
      }
    }
  }, [query.data, onSuccess]);

  // Manejar errores
  useEffect(() => {
    if (query.error && onError) {
      onError(query.error as Error);
    }
  }, [query.error, onError]);

  return {
    ...query,
    // Helpers
    invalidate: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: pollQueryKey });
    }, [queryClient]),
  };
}

/**
 * Hook para usar los datos del poll de forma selectiva
 * Permite acceder a partes específicas sin re-render innecesarios
 */
export function usePollNodes() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<PollData>(pollQueryKey)?.nodes ?? [];
}

export function usePollChannels() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<PollData>(pollQueryKey)?.channels ?? [];
}

export function usePollMessages() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<PollData>(pollQueryKey)?.messages ?? [];
}

export function usePollConnection() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<PollData>(pollQueryKey)?.connection;
}
