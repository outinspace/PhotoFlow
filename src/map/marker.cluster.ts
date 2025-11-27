import { createPathComponent } from "@react-leaflet/core";
import L from "leaflet";
import "leaflet.markercluster";

L.MarkerClusterGroup.include({
  _flushLayerBuffer(this: any) {
    this.addLayers(this._layerBuffer);
    this._layerBuffer = [];
  },

  addLayer(this: any, layer: any) {
    if (this._layerBuffer.length === 0) {
      setTimeout(this._flushLayerBuffer.bind(this), 50);
    }
    this._layerBuffer.push(layer);
  },
});

L.MarkerClusterGroup.addInitHook(function (this: any) {
  this._layerBuffer = [];
});

// eslint-disable-next-line no-unused-vars
function createMarkerCluster({ children: _c, ...props }: any, context: any) {
  const clusterProps: Record<string, any> = {};
  const clusterEvents: Record<string, any> = {};

  // Splitting props and events to different objects
  Object.entries(props).forEach(([propName, prop]) =>
    propName.startsWith("on")
      ? (clusterEvents[propName] = prop)
      : (clusterProps[propName] = prop),
  );
  const instance = new L.MarkerClusterGroup(clusterProps);

  // Initializing event listeners
  Object.entries(clusterEvents).forEach(([eventAsProp, callback]) => {
    const clusterEvent = `cluster${eventAsProp.substring(2).toLowerCase()}`;
    instance.on(clusterEvent, callback as any);
  });
  return {
    instance,
    context: {
      ...context,
      layerContainer: instance,
    },
  };
}

const MarkerCluster = createPathComponent(createMarkerCluster);

export default MarkerCluster;
