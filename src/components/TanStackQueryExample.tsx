import { useNodes, useToggleFavorite, useSendMessage, useUnreadCounts, useConnectionStatus } from '../hooks/useApi';

/**
 * Ejemplo de componente usando TanStack Query
 * Demuestra:
 * - Polling automático
 * - Estados de carga/error
 * - Mutaciones optimistas
 * - Invalidación automática
 */
export function NodesListExample() {
  // 🎯 Query: Obtiene nodes con polling automático cada 5s
  const { 
    data: nodes = [], 
    isLoading, 
    error, 
    isFetching,
    refetch 
  } = useNodes();

  // 🎯 Mutation: Toggle favorito con actualización optimista
  const toggleFavoriteMutation = useToggleFavorite();

  // 🎯 Mutation: Enviar mensaje
  const sendMessageMutation = useSendMessage();

  // Handler para toggle favorito
  const handleToggleFavorite = (nodeNum: number, currentFavorite: boolean) => {
    // La UI se actualiza INMEDIATAMENTE (optimistic update)
    // Si falla, se revierte automáticamente
    toggleFavoriteMutation.mutate({ 
      nodeNum, 
      isFavorite: !currentFavorite 
    });
  };

  // Handler para enviar mensaje
  const handleSendMessage = (nodeId: string) => {
    sendMessageMutation.mutate({
      toNodeId: nodeId,
      text: "¡Hola desde TanStack Query!"
    }, {
      onSuccess: () => {
        alert('Mensaje enviado!');
      },
      onError: (error) => {
        alert(`Error: ${error.message}`);
      }
    });
  };

  // 📊 Estados de carga
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Cargando nodos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>❌ Error: {error.message}</p>
        <button onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="nodes-list">
      <div className="header">
        <h2>Nodos ({nodes.length})</h2>
        <div className="status-indicators">
          {isFetching && <span className="fetching-indicator">⟳ Actualizando...</span>}
          {toggleFavoriteMutation.isPending && <span>💫 Guardando favorito...</span>}
          {sendMessageMutation.isPending && <span>📤 Enviando mensaje...</span>}
        </div>
        <button onClick={() => refetch()}>🔄 Refrescar Ahora</button>
      </div>

      <div className="nodes-grid">
        {nodes.map((node) => (
          <div key={node.nodeNum} className="node-card">
            <div className="node-header">
              <h3>{node.user?.longName || 'Unknown'}</h3>
              <button
                onClick={() => handleToggleFavorite(node.nodeNum, node.isFavorite || false)}
                className={`favorite-btn ${node.isFavorite ? 'active' : ''}`}
                disabled={toggleFavoriteMutation.isPending}
              >
                {node.isFavorite ? '⭐' : '☆'}
              </button>
            </div>
            
            <div className="node-details">
              <p>NodeNum: {node.nodeNum}</p>
              <p>ID: {node.user?.id || 'N/A'}</p>
              <p>SNR: {node.snr || 'N/A'} dB</p>
              <p>Hops: {node.hopsAway ?? 'N/A'}</p>
            </div>

            {node.user?.id && (
              <button
                onClick={() => handleSendMessage(node.user!.id)}
                className="send-message-btn"
                disabled={sendMessageMutation.isPending}
              >
                📨 Enviar Mensaje
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Indicador de estado de mutations */}
      {toggleFavoriteMutation.isError && (
        <div className="mutation-error">
          ❌ Error al actualizar favorito: {toggleFavoriteMutation.error?.message}
        </div>
      )}
      
      {sendMessageMutation.isError && (
        <div className="mutation-error">
          ❌ Error al enviar mensaje: {sendMessageMutation.error?.message}
        </div>
      )}
    </div>
  );
}

/**
 * Ejemplo de uso de múltiples queries en paralelo
 */
export function DashboardExample() {
  const { data: nodes = [], isLoading: nodesLoading } = useNodes();
  const { data: unreadCounts, isLoading: unreadLoading } = useUnreadCounts();
  const { data: connectionStatus } = useConnectionStatus();

  if (nodesLoading || unreadLoading) {
    return <div>Cargando dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="stats">
        <div className="stat-card">
          <h3>Nodos Activos</h3>
          <p className="stat-value">{nodes.length}</p>
        </div>
        
        <div className="stat-card">
          <h3>Mensajes No Leídos</h3>
          <p className="stat-value">
            {(Object.values(unreadCounts?.channels || {}) as number[]).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        
        <div className="stat-card">
          <h3>Estado</h3>
          <p className={`status ${connectionStatus?.connected ? 'connected' : 'disconnected'}`}>
            {connectionStatus?.connected ? '🟢 Conectado' : '🔴 Desconectado'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Importar en App.tsx para probar:
// import { NodesListExample, DashboardExample } from './components/TanStackQueryExample';
