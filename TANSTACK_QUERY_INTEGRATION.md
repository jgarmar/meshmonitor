# Integración de TanStack Query en MeshMonitor

## ✅ Completado

### 1. Instalación
```bash
pnpm add @tanstack/react-query
pnpm add -D @tanstack/react-query-devtools
```

### 2. Configuración
- ✅ `src/lib/queryClient.ts` - QueryClient configurado
- ✅ `src/main.tsx` - QueryClientProvider añadido
- ✅ `src/hooks/useApi.ts` - Hooks personalizados creados
- ✅ `src/services/api.ts` - Métodos API añadidos

### 3. Hooks Disponibles

#### Queries (lectura de datos)
- `useNodes()` - Polling automático cada 5s
- `useChannels()` - Lista de canales
- `useChannelMessages(channelId)` - Mensajes de un canal (polling 5s)
- `useDirectMessages(nodeId)` - Mensajes directos (polling 5s)
- `useUnreadCounts()` - Contadores no leídos (polling 10s)
- `useNodesWithTelemetry()` - Nodos con telemetría
- `useConnectionStatus()` - Estado de conexión (polling 5s)
- `useTraceroutes()` - Traceroutes recientes (polling 60s)
- `useNeighborInfo()` - Info de vecinos (polling 60s)
- `useDeviceInfo()` - Info del dispositivo
- `useDeviceConfig()` - Configuración del dispositivo

#### Mutations (escritura de datos)
- `useToggleFavorite()` - Marcar/desmarcar favorito (con optimistic updates)
- `useSendMessage()` - Enviar mensaje
- `useMarkMessagesAsRead()` - Marcar como leído

## 🚀 Cómo Usar

### Ejemplo 1: Obtener nodos con polling automático

**ANTES (manual):**
```typescript
const [nodes, setNodes] = useState<DeviceInfo[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchNodes = async () => {
    setLoading(true);
    try {
      const data = await api.getNodes();
      setNodes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  fetchNodes();
  const interval = setInterval(fetchNodes, 5000);
  return () => clearInterval(interval);
}, []);
```

**DESPUÉS (TanStack Query):**
```typescript
const { data: nodes = [], isLoading, error } = useNodes();

// ¡Eso es todo! Polling automático, caché, deduplicación incluidos
```

### Ejemplo 2: Toggle favorito con actualización optimista

**ANTES:**
```typescript
const [nodes, setNodes] = useState<DeviceInfo[]>([]);

const toggleFavorite = async (nodeNum: number, isFavorite: boolean) => {
  // Actualización optimista manual
  setNodes(prev => prev.map(n => 
    n.nodeNum === nodeNum ? {...n, isFavorite} : n
  ));

  try {
    await api.toggleFavorite(nodeNum, isFavorite);
  } catch (error) {
    // Revertir manualmente
    setNodes(prev => prev.map(n => 
      n.nodeNum === nodeNum ? {...n, isFavorite: !isFavorite} : n
    ));
  }
};
```

**DESPUÉS:**
```typescript
const toggleFavoriteMutation = useToggleFavorite();

const handleToggle = (nodeNum: number, isFavorite: boolean) => {
  toggleFavoriteMutation.mutate({ nodeNum, isFavorite });
  // ¡Actualización optimista y rollback automáticos!
};
```

### Ejemplo 3: Enviar mensaje

```typescript
const sendMessageMutation = useSendMessage();

const handleSendMessage = () => {
  sendMessageMutation.mutate({
    text: "Hola!",
    channelId: 0,
  }, {
    onSuccess: () => {
      showToast('Mensaje enviado', 'success');
      setNewMessage('');
    },
    onError: (error) => {
      showToast(`Error: ${error.message}`, 'error');
    }
  });
};

// Estado del envío
if (sendMessageMutation.isPending) {
  return <Spinner />;
}
```

### Ejemplo 4: Estados de carga/error

```typescript
const { data: nodes, isLoading, error, isFetching } = useNodes();

if (isLoading) {
  return <div>Cargando nodos...</div>;
}

if (error) {
  return <div>Error: {error.message}</div>;
}

// isFetching = true cuando está haciendo polling en background
// isLoading = true solo en la primera carga

return (
  <div>
    {isFetching && <span>⟳</span>}
    {nodes.map(node => <NodeCard key={node.nodeNum} node={node} />)}
  </div>
);
```

### Ejemplo 5: Control de polling condicional

```typescript
// Solo hacer polling cuando la conexión esté activa
const { data: nodes } = useNodes({ 
  enabled: connectionStatus === 'connected',
  refetchInterval: connectionStatus === 'connected' ? 5000 : false
});
```

## 📊 DevTools

Las React Query DevTools están habilitadas en desarrollo. Presiona el ícono flotante en la esquina inferior izquierda para:
- Ver todas las queries activas
- Inspeccionar el caché
- Ver el estado de cada query (loading, success, error, stale)
- Invalidar queries manualmente
- Ver el timeline de requests

## ⚡ Ventajas Inmediatas

1. **Menos código**: Elimina cientos de líneas de `useState`, `useEffect`, `setInterval`
2. **Mejor UX**: Actualizaciones optimistas instantáneas
3. **Más eficiente**: Deduplicación automática de requests
4. **Más robusto**: Manejo automático de errores y reintentos
5. **Mejor performance**: Caché inteligente, menos re-renders
6. **Debugging fácil**: DevTools integradas

## 🔄 Próximos Pasos

1. Migrar `updateDataFromBackend()` a usar los hooks individuales
2. Eliminar el polling manual del `useEffect` principal
3. Migrar el estado de `nodes` del contexto a TanStack Query
4. Migrar `messages` y `channels`
5. Eliminar `pendingMessagesRef` y usar el estado de mutations
6. Eliminar `pollingInProgressRef` (ya no necesario)

## 🎯 Ejemplo de Migración Completa en un Componente

Ver `src/components/ExampleWithTanStackQuery.tsx` (próximo commit) para un ejemplo completo.
