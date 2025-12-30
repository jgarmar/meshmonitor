import React, { useMemo } from 'react';
import { Marker, Popup, Tooltip, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './NodeMarkersLayer.css';
import { DeviceInfo } from '../../types/device';

import { getRoleName, getHardwareModelName } from '../../utils/nodeHelpers';
import { createNodeIcon, getHopColor } from '../../utils/mapIcons';
import { formatDateTime } from '../../utils/datetime';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDeviceConfig } from '../../hooks/useServerData';

interface NodeMarkersLayerProps {
  nodes: DeviceInfo[];
  nodesWithEstimatedPosition: Set<string>;
  nodePositions: Map<number, [number, number]>;
  isTouchDevice: boolean;

  // Callbacks
  onNodeClick: (node: DeviceInfo) => void;
  onMarkerRef: (ref: any, nodeId: string | undefined) => void;
  onPopupDMClick: (node: DeviceInfo) => void;
}

/**
 * Component to handle the rendering of node markers on the map
 * Supports optional clustering via MarkerClusterGroup
 */
export const NodeMarkersLayer: React.FC<NodeMarkersLayerProps> = ({
  nodes,
  nodesWithEstimatedPosition,
  nodePositions,
  isTouchDevice,
  onNodeClick,
  onMarkerRef,
  onPopupDMClick,
}) => {
  const { selectedNodeId, mapZoom, showAnimations, animatedNodes, clusteringEnabled, showEstimatedPositions } =
    useMapContext();
  const { mapPinStyle, timeFormat, dateFormat } = useSettings();
  const { hasPermission } = useAuth();
  const { currentNodeId } = useDeviceConfig();

  const markers = useMemo(() => {
    return nodes.map(node => {
      // Logic from NodesTab.tsx
      const roleNum =
        typeof node.user?.role === 'string'
          ? parseInt(node.user.role, 10)
          : typeof node.user?.role === 'number'
          ? node.user.role
          : 0;
      const isRouter = roleNum === 2;
      const isSelected = selectedNodeId === node.user?.id;

      // Get hop count for this node
      // Local node always gets 0 hops (green), otherwise use hopsAway from protobuf
      const isLocalNode = node.user?.id === currentNodeId;
      const hops = isLocalNode ? 0 : node.hopsAway ?? 999;
      const showLabel = mapZoom >= 13; // Show labels when zoomed in

      const shouldAnimate = showAnimations && animatedNodes.has(node.user?.id || '');

      const markerIcon = createNodeIcon({
        hops: hops,
        isSelected,
        isRouter,
        shortName: node.user?.shortName,
        showLabel: showLabel || shouldAnimate,
        animate: shouldAnimate,
        pinStyle: mapPinStyle,
      });

      // Use memoized position to prevent React-Leaflet from resetting marker position
      const position = nodePositions.get(node.nodeNum)!;

      // Calculate estimated position radius if needed
      const isEstimated = node.user?.id && nodesWithEstimatedPosition.has(node.user.id);

      return (
        <React.Fragment key={node.nodeNum}>
          <Marker
            position={position}
            icon={markerIcon}
            zIndexOffset={shouldAnimate ? 10000 : 0}
            ref={ref => onMarkerRef(ref, node.user?.id)}
            eventHandlers={{
              click: () => onNodeClick(node),
            }}
          >
            {!isTouchDevice && (
              <Tooltip direction="top" offset={[0, -20]} opacity={0.9} interactive>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {node.user?.longName || node.user?.shortName || `!${node.nodeNum.toString(16)}`}
                  </div>
                  {node.hopsAway !== undefined && (
                    <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
                      {node.hopsAway} hop{node.hopsAway !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </Tooltip>
            )}
            <Popup autoPan={false} className="map-node-popup-container">
              <div className="map-node-popup">
                <div className="map-node-popup-header">
                  <div className="map-node-popup-title">{node.user?.longName || `Node ${node.nodeNum}`}</div>
                  {node.user?.shortName && <div className="map-node-popup-subtitle">{node.user.shortName}</div>}
                </div>

                <div className="map-node-popup-grid">
                  {node.user?.id && (
                    <div className="map-node-popup-item">
                      <span className="map-node-popup-icon">🆔</span>
                      <span className="map-node-popup-value">{node.user.id}</span>
                    </div>
                  )}

                  {node.user?.role !== undefined &&
                    (() => {
                      const rNum = typeof node.user.role === 'string' ? parseInt(node.user.role, 10) : node.user.role;
                      const rName = getRoleName(rNum);
                      return rName ? (
                        <div className="map-node-popup-item">
                          <span className="map-node-popup-icon">👤</span>
                          <span className="map-node-popup-value">{rName}</span>
                        </div>
                      ) : null;
                    })()}

                  {node.user?.hwModel !== undefined &&
                    (() => {
                      const hwModelName = getHardwareModelName(node.user.hwModel);
                      return hwModelName ? (
                        <div className="map-node-popup-item">
                          <span className="map-node-popup-icon">🖥️</span>
                          <span className="map-node-popup-value">{hwModelName}</span>
                        </div>
                      ) : null;
                    })()}

                  {node.snr != null && (
                    <div className="map-node-popup-item">
                      <span className="map-node-popup-icon">📶</span>
                      <span className="map-node-popup-value">{node.snr.toFixed(1)} dB</span>
                    </div>
                  )}

                  {node.hopsAway != null && (
                    <div className="map-node-popup-item">
                      <span className="map-node-popup-icon">🔗</span>
                      <span className="map-node-popup-value">
                        {node.hopsAway} hop{node.hopsAway !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {node.position?.altitude != null && (
                    <div className="map-node-popup-item">
                      <span className="map-node-popup-icon">⛰️</span>
                      <span className="map-node-popup-value">{node.position.altitude}m</span>
                    </div>
                  )}

                  {node.deviceMetrics?.batteryLevel !== undefined && node.deviceMetrics.batteryLevel !== null && (
                    <div className="map-node-popup-item">
                      <span className="map-node-popup-icon">
                        {node.deviceMetrics.batteryLevel === 101 ? '🔌' : '🔋'}
                      </span>
                      <span className="map-node-popup-value">
                        {node.deviceMetrics.batteryLevel === 101 ? 'Plugged In' : `${node.deviceMetrics.batteryLevel}%`}
                      </span>
                    </div>
                  )}
                </div>

                {node.lastHeard && (
                  <div className="map-node-popup-footer">
                    <span className="map-node-popup-icon">🕐</span>
                    {formatDateTime(new Date(node.lastHeard * 1000), timeFormat, dateFormat)}
                  </div>
                )}

                {node.user?.id && hasPermission('messages', 'read') && (
                  <button className="map-node-popup-btn" onClick={() => onPopupDMClick(node)}>
                    💬 Direct Message
                  </button>
                )}
              </div>
            </Popup>
          </Marker>

          {/* Estimated Position Circle */}
          {showEstimatedPositions && isEstimated && (
            <Circle
              center={[node.position!.latitude, node.position!.longitude]}
              radius={500} // Fixed radius for now as in original code
              pathOptions={{
                color: getHopColor(hops),
                fillColor: getHopColor(hops),
                fillOpacity: 0.1,
                opacity: 0.4,
                weight: 2,
                dashArray: '5, 5',
              }}
            />
          )}
        </React.Fragment>
      );
    });
  }, [
    nodes,
    nodesWithEstimatedPosition,
    selectedNodeId,
    currentNodeId,
    mapZoom,
    showAnimations,
    animatedNodes,
    mapPinStyle,
    nodePositions,
    isTouchDevice,
    timeFormat,
    dateFormat,
    showEstimatedPositions,
    onNodeClick,
    onMarkerRef,
    onPopupDMClick,
    hasPermission,
  ]);

  if (clusteringEnabled) {
    return <MarkerClusterGroup chunkedLoading>{markers}</MarkerClusterGroup>;
  }

  return <>{markers}</>;
};
