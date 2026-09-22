'use client';
import {useEffect,useRef,useState} from 'react';
import type {Position} from './positions';
import {coordinate} from './positions';
import {trackDirection} from './track-view';
// Leaflet is served locally; only map tiles come from OpenStreetMap.
import tanker from './tanker.png';
function loadLeaflet(){return import('leaflet').then(m=>m.default||m)}
export default function TrackMap({position,history,allHistory,days}:{position:Position;history:Position[];allHistory:Position[];days:number}){
 const host=useRef<HTMLDivElement>(null),map=useRef<any>(null),layer=useRef<any>(null),library=useRef<any>(null),fitted=useRef<number|null>(null),bounds=useRef<any>(null);const [error,setError]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{let active=true;loadLeaflet().then(L=>{if(!active||!host.current)return;library.current=L;map.current=L.map(host.current,{worldCopyJump:true}).setView([position.latitude,position.longitude],5);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map.current);layer.current=L.layerGroup().addTo(map.current);setReady(true);}).catch(()=>setError(true));return()=>{active=false;map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{if(!ready)return;const L=library.current,group=layer.current;group.clearLayers();const unique=new Map<string,Position>();for(const p of history)unique.set(`${p.dateTime}:${p.latitude}:${p.longitude}`,p);const points=[...unique.values()].sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));const coords:number[][]=[];
 for(let i=0;i<points.length;i++){const p=points[i];let lon=p.longitude;if(i){while(lon-coords[i-1][1]>180)lon-=360;while(lon-coords[i-1][1]<-180)lon+=360;}coords.push([p.latitude,lon]);}
 function popup(p:Position){const el=document.createElement('div');el.textContent=`${p.source} · ${new Date(p.dateTime).toLocaleString('pt-BR',{timeZone:'UTC'})} UTC · ${coordinate(p.latitude,true)} / ${coordinate(p.longitude,false)}`;return el;}
 for(let i=1;i<coords.length;i++)L.polyline([coords[i-1],coords[i]],{color:'#176a9a',weight:3,opacity:.8,dashArray:Date.parse(points[i].dateTime)-Date.parse(points[i-1].dateTime)>86400000?'7 9':undefined}).addTo(group);
 for(let i=0;i<coords.length;i++)L.circleMarker(coords[i],{radius:5,color:'#fff',weight:2,fillColor:'#176a9a',fillOpacity:1}).bindPopup(popup(points[i])).addTo(group);
 let lastLon=position.longitude;if(coords.length){while(lastLon-coords[coords.length-1][1]>180)lastLon-=360;while(lastLon-coords[coords.length-1][1]<-180)lastLon+=360;}
 const direction=trackDirection(allHistory,position);
 const directionText=direction===null?'Direção indisponível: são necessários dois pontos distintos e sucessivos.':`Direção estimada: ${Math.round(direction)}° · entre os dois últimos pontos; não é rumo medido.`;
 const last=[position.latitude,lastLon];const content=popup(position);content.textContent+=' · '+directionText;
 L.marker(last,{icon:L.divIcon({html:`<img src="${tanker}" alt="" class="tanker-marker" style="width:40px;height:60px;position:absolute;left:10px;top:0;transform:rotate(${direction??0}deg)"/>`,iconSize:[60,60],iconAnchor:[30,30],popupAnchor:[0,-28],className:'tanker-holder'}),title:`Última posição · ${directionText}`,alt:'Petroleiro: última posição disponível',zIndexOffset:1000}).bindPopup(content).addTo(group);

 bounds.current=L.latLngBounds([...coords,last]);if(fitted.current!==days){map.current.fitBounds(bounds.current,{padding:[45,45],maxZoom:7});fitted.current=days;}
 },[ready,position,history,allHistory,days]);
 return <><div ref={host} className="track-map" aria-label={`Mapa interativo da rota dos últimos ${days} dias`}/>{error&&<p className="notice">Mapa indisponível. As coordenadas continuam disponíveis abaixo.</p>}{ready&&<button className="fit-route" onClick={()=>map.current.fitBounds(bounds.current,{padding:[45,45],maxZoom:7})}>Enquadrar rota</button>}</>;
}
