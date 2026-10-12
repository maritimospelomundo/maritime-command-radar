// Public browser token supplied for the portal maps; no server credentials.
export function mapboxTiles(token:string){return 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}?access_token='+encodeURIComponent(token);}
export const mapboxOptions={tileSize:256,maxZoom:18,attribution:'© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noreferrer">Improve this map</a>',referrerPolicy:'strict-origin-when-cross-origin' as const};
