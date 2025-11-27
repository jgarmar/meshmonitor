import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../contexts/DataContext';
import { useNodes, useChannels, queryKeys } from './useApi';
import api from '../services/api';

/**
 * Hook que sincroniza TanStack Query con DataContext
 * Esto permite una migración gradual sin romper componentes existentes
 * 
 * IMPORTANTE: Este hook debe usarse solo una vez en App.tsx
 */
export function useDataSync(options: {
  enabled: boolean;
  connectionStatus: string;
}) {
  const queryClient = useQueryClient();
  const { enabled, connectionStatus } = options;
  
  const {
    setNodes,
    setChannels,
    setNodesWithTelemetry,
    setNodesWithWeatherTelemetry,
    setNodesWithEstimatedPosition,
    setNodesWithPKC,
  } = useData();

  // Query para nodes con polling automático
  const nodesQuery = useNodes({
    enabled: enabled && connectionStatus === 'connected',
    refetchInterval: connectionStatus === 'connected' ? 5000 : undefined,
  });

  // Query para channels
  const channelsQuery = useChannels({
    enabled: enabled && connectionStatus === 'connected',
  });

  // Sincronizar nodes con el contexto
  useEffect(() => {
    if (nodesQuery.data) {
      setNodes(nodesQuery.data);
    }
  }, [nodesQuery.data, setNodes]);

  // Sincronizar channels con el contexto
  useEffect(() => {
    if (channelsQuery.data) {
      setChannels(channelsQuery.data);
    }
  }, [channelsQuery.data, setChannels]);

  // Fetch telemetry availability
  useEffect(() => {
    if (!enabled || connectionStatus !== 'connected') return;

    const fetchTelemetryAvailable = async () => {
      try {
        const data = await api.getNodesWithTelemetry();
        if (data) {
          setNodesWithTelemetry(new Set(data.nodes || []));
          setNodesWithWeatherTelemetry(new Set(data.weather || []));
          setNodesWithEstimatedPosition(new Set(data.estimatedPosition || []));
          setNodesWithPKC(new Set(data.pkc || []));
        }
      } catch (error) {
        console.error('Failed to fetch telemetry availability:', error);
      }
    };

    fetchTelemetryAvailable();
    const interval = setInterval(fetchTelemetryAvailable, 60000);
    return () => clearInterval(interval);
  }, [enabled, connectionStatus, setNodesWithTelemetry, setNodesWithWeatherTelemetry, setNodesWithEstimatedPosition, setNodesWithPKC]);

  return {
    nodesQuery,
    channelsQuery,
    // Helpers para invalidar manualmente
    invalidateNodes: () => queryClient.invalidateQueries({ queryKey: queryKeys.nodes }),
    invalidateChannels: () => queryClient.invalidateQueries({ queryKey: queryKeys.channels }),
    // Estados agregados
    isLoading: nodesQuery.isLoading || channelsQuery.isLoading,
    isFetching: nodesQuery.isFetching || channelsQuery.isFetching,
  };
}
