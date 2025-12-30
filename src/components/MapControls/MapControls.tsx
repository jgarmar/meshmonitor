import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapContext } from '../../contexts/MapContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPacketStats } from '../../services/packetApi';
import { ResourceType } from '../../types/permission';
import './MapControls.css';

interface MapControlsProps {
  isTouchDevice: boolean;
  showPacketMonitor: boolean;
  setShowPacketMonitor: (show: boolean) => void;
}

export const MapControls: React.FC<MapControlsProps> = ({ isTouchDevice, showPacketMonitor, setShowPacketMonitor }) => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  const {
    showPaths,
    setShowPaths,
    showNeighborInfo,
    setShowNeighborInfo,
    showRoute,
    setShowRoute,
    showMotion,
    setShowMotion,
    showMqttNodes,
    setShowMqttNodes,
    showAnimations,
    setShowAnimations,
    clusteringEnabled,
    setClusteringEnabled,
    showEstimatedPositions,
    setShowEstimatedPositions,
  } = useMapContext();

  // Packet Monitor permission check
  const hasAnyChannelPermission = () => {
    for (let i = 0; i < 8; i++) {
      if (hasPermission(`channel_${i}` as ResourceType, 'read')) {
        return true;
      }
    }
    return false;
  };
  const canViewPacketMonitor = hasAnyChannelPermission() && hasPermission('messages', 'read');

  // Track if packet logging is enabled on the server
  const [packetLogEnabled, setPacketLogEnabled] = useState<boolean>(false);

  // Fetch packet logging enabled status from server
  useEffect(() => {
    const fetchPacketLogStatus = async () => {
      if (!canViewPacketMonitor) return;

      try {
        const stats = await getPacketStats();
        setPacketLogEnabled(stats.enabled === true);
      } catch (error) {
        console.error('Failed to fetch packet log status:', error);
      }
    };

    fetchPacketLogStatus();
  }, [canViewPacketMonitor]);

  // Track if map controls are collapsed
  const [isMapControlsCollapsed, setIsMapControlsCollapsed] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('isMapControlsCollapsed');
    return saved === 'true';
  });

  // Save map controls collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('isMapControlsCollapsed', isMapControlsCollapsed.toString());
  }, [isMapControlsCollapsed]);

  // Map controls position state with localStorage persistence
  // Position is relative to the map container (absolute positioning)
  // We use a special value of -1 to indicate "use CSS default (right: 10px)"
  const MAP_CONTROLS_DEFAULT_POSITION = { x: -1, y: 10 };

  const [mapControlsPosition, setMapControlsPosition] = useState(() => {
    const saved = localStorage.getItem('mapControlsPosition');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If x or y is invalid, use defaults
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          // Sanity check: if position seems unreasonable, reset to default
          if (parsed.x > 2000 || parsed.x < -100 || parsed.y > 2000 || parsed.y < -100) {
            localStorage.removeItem('mapControlsPosition');
            return MAP_CONTROLS_DEFAULT_POSITION;
          }
          return { x: parsed.x, y: parsed.y };
        }
      } catch {
        // Ignore parse errors
      }
    }
    return MAP_CONTROLS_DEFAULT_POSITION;
  });

  // Map controls drag state
  const [isDraggingMapControls, setIsDraggingMapControls] = useState(false);
  const [mapControlsDragStart, setMapControlsDragStart] = useState({ x: 0, y: 0 });
  const mapControlsRef = useRef<HTMLDivElement>(null);

  // Save map controls position to localStorage (only if not default)
  useEffect(() => {
    if (mapControlsPosition.x !== -1) {
      localStorage.setItem('mapControlsPosition', JSON.stringify(mapControlsPosition));
    }
  }, [mapControlsPosition]);

  // Constrain map controls position to stay within the map container on mount and window resize
  useEffect(() => {
    const constrainMapControlsPosition = () => {
      // Skip constraint for default position (x = -1 means use CSS right: 10px)
      if (mapControlsPosition.x === -1) return;

      const mapContainer = document.querySelector('.map-container');
      const controls = mapControlsRef.current;
      if (!mapContainer || !controls) return;

      const containerRect = mapContainer.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const padding = 10;

      // Calculate max bounds relative to container
      const maxX = containerRect.width - controlsRect.width - padding;
      const maxY = containerRect.height - controlsRect.height - padding;

      // Check if current position is out of bounds
      const constrainedX = Math.max(padding, Math.min(mapControlsPosition.x, maxX));
      const constrainedY = Math.max(padding, Math.min(mapControlsPosition.y, maxY));

      // Update position if it was out of bounds
      if (constrainedX !== mapControlsPosition.x || constrainedY !== mapControlsPosition.y) {
        setMapControlsPosition({ x: constrainedX, y: constrainedY });
      }
    };

    // Run on mount after a short delay to ensure elements are rendered
    const timeoutId = setTimeout(constrainMapControlsPosition, 100);

    // Run on window resize
    window.addEventListener('resize', constrainMapControlsPosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', constrainMapControlsPosition);
    };
  }, [mapControlsPosition]);

  // Map controls drag handlers
  const handleMapControlsDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isMapControlsCollapsed || isTouchDevice) return; // Disable drag on mobile
      e.preventDefault();
      e.stopPropagation();

      // If position is default (-1), calculate actual position from element
      let currentX = mapControlsPosition.x;
      let currentY = mapControlsPosition.y;

      if (currentX === -1) {
        // Convert from CSS right: 10px to left-based coordinates
        const mapContainer = document.querySelector('.map-container');
        const controls = mapControlsRef.current;
        if (mapContainer && controls) {
          const containerRect = mapContainer.getBoundingClientRect();
          const controlsRect = controls.getBoundingClientRect();
          currentX = controlsRect.left - containerRect.left;
          currentY = controlsRect.top - containerRect.top;
          // Update the position to be explicit
          setMapControlsPosition({ x: currentX, y: currentY });
        }
      }

      setIsDraggingMapControls(true);
      setMapControlsDragStart({
        x: e.clientX - currentX,
        y: e.clientY - currentY,
      });
    },
    [isMapControlsCollapsed, mapControlsPosition, isTouchDevice]
  );

  const handleMapControlsDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingMapControls) return;

      const mapContainer = document.querySelector('.map-container');
      if (!mapContainer) return;

      const containerRect = mapContainer.getBoundingClientRect();
      const padding = 10;
      const controls = mapControlsRef.current;
      const controlsWidth = controls ? controls.offsetWidth : 200;
      const controlsHeight = controls ? controls.offsetHeight : 200;

      const maxX = containerRect.width - controlsWidth - padding;
      const maxY = containerRect.height - controlsHeight - padding;

      const newX = Math.max(padding, Math.min(maxX, e.clientX - mapControlsDragStart.x));
      const newY = Math.max(padding, Math.min(maxY, e.clientY - mapControlsDragStart.y));

      setMapControlsPosition({ x: newX, y: newY });
    },
    [isDraggingMapControls, mapControlsDragStart]
  );

  const handleMapControlsDragEnd = useCallback(() => {
    setIsDraggingMapControls(false);
  }, []);

  // Global mouse event listeners for dragging map controls
  useEffect(() => {
    if (isDraggingMapControls) {
      document.addEventListener('mousemove', handleMapControlsDragMove);
      document.addEventListener('mouseup', handleMapControlsDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMapControlsDragMove);
        document.removeEventListener('mouseup', handleMapControlsDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDraggingMapControls, handleMapControlsDragMove, handleMapControlsDragEnd]);

  return (
    <div
      className={`map-controls ${isMapControlsCollapsed ? 'collapsed' : ''}`}
      ref={mapControlsRef}
      style={{
        left: isMapControlsCollapsed ? 'auto' : mapControlsPosition.x === -1 ? 'auto' : mapControlsPosition.x,
        top: isMapControlsCollapsed ? '10px' : mapControlsPosition.y,
        right: isMapControlsCollapsed ? '10px' : mapControlsPosition.x === -1 ? '10px' : 'auto',
        cursor: isMapControlsCollapsed ? 'default' : 'move',
      }}
      onMouseDown={handleMapControlsDragStart}
    >
      <button
        className="map-controls-collapse-btn"
        onClick={e => {
          e.stopPropagation();
          setIsMapControlsCollapsed(!isMapControlsCollapsed);
        }}
        title={isMapControlsCollapsed ? t('map.expandControls') : t('map.collapseControls')}
      >
        {isMapControlsCollapsed ? '⚙️' : '✕'}
      </button>

      {!isMapControlsCollapsed && (
        <>
          <div className="map-controls-header">
            <span className="map-controls-title">{t('map.features', 'Features')}</span>
          </div>

          <label className="map-control-item">
            <input type="checkbox" checked={showPaths} onChange={e => setShowPaths(e.target.checked)} />
            <span>{t('map.showPaths', 'Show Route Segments')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={showNeighborInfo} onChange={e => setShowNeighborInfo(e.target.checked)} />
            <span>{t('map.showNeighborInfo', 'Show Neighbor Info')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)} />
            <span>{t('map.showTraceroute', 'Show Traceroute')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={showMqttNodes} onChange={e => setShowMqttNodes(e.target.checked)} />
            <span>{t('map.showMqtt', 'Show MQTT')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={showMotion} onChange={e => setShowMotion(e.target.checked)} />
            <span>{t('map.showPositionHistory', 'Show Position History')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={showAnimations} onChange={e => setShowAnimations(e.target.checked)} />
            <span>{t('map.showAnimations', 'Show Animations')}</span>
          </label>
          <label className="map-control-item">
            <input type="checkbox" checked={clusteringEnabled} onChange={e => setClusteringEnabled(e.target.checked)} />
            <span>{t('map.clusterNodes', 'Cluster Nodes')}</span>
          </label>
          <label className="map-control-item">
            <input
              type="checkbox"
              checked={showEstimatedPositions}
              onChange={e => setShowEstimatedPositions(e.target.checked)}
            />
            <span>{t('map.showEstimatedPositions', 'Show Estimated Positions')}</span>
          </label>
          {canViewPacketMonitor && packetLogEnabled && (
            <label className="map-control-item packet-monitor-toggle">
              <input
                type="checkbox"
                checked={showPacketMonitor}
                onChange={e => setShowPacketMonitor(e.target.checked)}
              />
              <span>Show Packet Monitor</span>
            </label>
          )}
        </>
      )}
    </div>
  );
};
