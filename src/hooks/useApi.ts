import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { DeviceInfo } from '../types/device';

// Query keys - centralizados para consistencia
export const queryKeys = {
  nodes: ['nodes'] as const,
  nodeDetail: (nodeId: string) => ['nodes', nodeId] as const,
  channels: ['channels'] as const,
  messages: (channelId?: number) => ['messages', channelId] as const,
  directMessages: (nodeId?: string) => ['directMessages', nodeId] as const,
  telemetry: (nodeId: string) => ['telemetry', nodeId] as const,
  telemetryAvailable: ['telemetry', 'available'] as const,
  traceroutes: ['traceroutes'] as const,
  neighborInfo: ['neighborInfo'] as const,
  connection: ['connection'] as const,
  unreadCounts: ['unreadCounts'] as const,
  deviceInfo: ['deviceInfo'] as const,
  deviceConfig: ['deviceConfig'] as const,
} as const;

/**
 * Hook para obtener todos los nodos
 * Con polling automático cada 5 segundos
 */
export function useNodes(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.nodes,
    queryFn: async () => {
      const response = await api.getNodes();
      return response;
    },
    refetchInterval: options?.refetchInterval ?? 5000, // Polling cada 5s por defecto
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook para obtener canales
 */
export function useChannels(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: async () => {
      const response = await api.getChannels();
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook para obtener mensajes de un canal
 */
export function useChannelMessages(channelId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: async () => {
      const response = await api.getChannelMessages(channelId);
      return response;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 5000, // Auto-refresh para nuevos mensajes
  });
}

/**
 * Hook para obtener mensajes directos con un nodo
 */
export function useDirectMessages(nodeId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.directMessages(nodeId ?? undefined),
    queryFn: async () => {
      if (!nodeId) return [];
      const response = await api.getDirectMessages(nodeId);
      return response;
    },
    enabled: (options?.enabled ?? true) && !!nodeId,
    refetchInterval: 5000, // Auto-refresh para nuevos mensajes
  });
}

/**
 * Hook para obtener contadores de mensajes no leídos
 */
export function useUnreadCounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.unreadCounts,
    queryFn: async () => {
      const response = await api.getUnreadCounts();
      return response;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 10000, // Polling cada 10s
  });
}

/**
 * Hook para obtener nodos con telemetría disponible
 */
export function useNodesWithTelemetry(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.telemetryAvailable,
    queryFn: async () => {
      const data = await api.getNodesWithTelemetry();
      return {
        nodes: new Set(data.nodes || []),
        weather: new Set(data.weather || []),
        estimatedPosition: new Set(data.estimatedPosition || []),
        pkc: new Set(data.pkc || [])
      };
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook para obtener traceroutes recientes
 */
export function useTraceroutes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.traceroutes,
    queryFn: async () => {
      return await api.getRecentTraceroutes();
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 60000, // Cada minuto
  });
}

/**
 * Hook para obtener información de vecinos
 */
export function useNeighborInfo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.neighborInfo,
    queryFn: async () => {
      const baseUrl = await api.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/neighbor-info`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch neighbor info');
      return response.json();
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 60000, // Cada minuto
  });
}

/**
 * Hook para obtener información del dispositivo
 */
export function useDeviceInfo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.deviceInfo,
    queryFn: async () => {
      const baseUrl = await api.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/device-info`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch device info');
      return response.json();
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook para obtener configuración del dispositivo
 */
export function useDeviceConfig(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.deviceConfig,
    queryFn: async () => {
      return await api.getCurrentConfig();
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook para obtener información de la conexión
 */
export function useConnectionStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.connection,
    queryFn: async () => {
      const response = await api.getConnectionStatus();
      return response;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 5000,
    retry: false, // No reintentar conexiones fallidas
  });
}

/**
 * Mutation para marcar como favorito/desfavorito
 * Con actualización optimista
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeNum, isFavorite }: { nodeNum: number; isFavorite: boolean }) => {
      return await api.toggleFavorite(nodeNum, isFavorite);
    },
    // Actualización optimista - UI se actualiza inmediatamente
    onMutate: async ({ nodeNum, isFavorite }) => {
      // Cancelar queries en vuelo
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes });

      // Snapshot del estado anterior (para rollback)
      const previousNodes = queryClient.getQueryData<DeviceInfo[]>(queryKeys.nodes);

      // Actualización optimista
      queryClient.setQueryData<DeviceInfo[]>(queryKeys.nodes, (old) => {
        if (!old) return old;
        return old.map((node) =>
          node.nodeNum === nodeNum ? { ...node, isFavorite } : node
        );
      });

      return { previousNodes };
    },
    // Si falla, revertir
    onError: (_err, _variables, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(queryKeys.nodes, context.previousNodes);
      }
    },
    // Siempre refetch después de la mutación
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes });
    },
  });
}

/**
 * Mutation para enviar mensaje
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      text,
      channelId,
      toNodeId,
      replyId,
    }: {
      text: string;
      channelId?: number;
      toNodeId?: string;
      replyId?: number;
    }) => {
      if (toNodeId) {
        return await api.sendDirectMessage(toNodeId, text, replyId);
      } else if (channelId !== undefined) {
        return await api.sendChannelMessage(channelId, text, replyId);
      }
      throw new Error('Debe especificar channelId o toNodeId');
    },
    // Invalidar queries relevantes después de enviar
    onSuccess: (_data, variables) => {
      if (variables.toNodeId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.directMessages(variables.toNodeId) });
      } else if (variables.channelId !== undefined) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(variables.channelId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts });
    },
  });
}

/**
 * Mutation para marcar mensajes como leídos
 */
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      channelId,
      nodeId,
    }: {
      messageId?: number;
      channelId?: number;
      nodeId?: string;
    }) => {
      return await api.markMessagesAsRead(messageId, channelId, nodeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts });
    },
  });
}
