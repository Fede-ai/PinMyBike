import Dexie, { Table } from 'dexie';

let map: google.maps.Map;
let isCentered = false;
//let knownPosition: GeolocationPosition|null = null;

interface BikePin {
  	id?: number;
	name: string;
  	lat: number;
  	lng: number;
}
class Database extends Dexie {
  	bikePins!: Table<BikePin, number>;

  	constructor() {
		super("PinMyBikeDB");	
		this.version(1).stores({
  			bikePins: "++id, name, lat, lng",
  		});
  	}
}
const db = new Database();
(globalThis as any).db = db.bikePins ; //for debugging

async function initMap(): Promise<void> {
  	const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
	
	const loc = await getRoughLocation();
	let lat = 48;
	let lng = 14;
	let zoom = 5;

	if (loc) {
		[lat, lng] = loc;
		zoom = 8.5;
	}

  	map = new Map(document.getElementById('map') as HTMLElement, 
		{
      	center: { lat, lng },
    	zoom,
		mapId: "dd153de96c2f9ce6d351447b",
		controlSize: 48,
		cameraControl: false,
		zoomControl: false,
		fullscreenControl: false,
		mapTypeControlOptions: {
			position: google.maps.ControlPosition.TOP_RIGHT,
		},
		colorScheme: google.maps.ColorScheme.DARK,
    });

	for (const pin of await db.bikePins.toArray())
		await addBikePin(pin.name, pin.lat, pin.lng);
	
  	if (navigator.geolocation)
		await initTracker();
  	else
		alert("Geolocation is not supported by this browser");

	map.addListener("click", async (e: google.maps.MapMouseEvent) => {
		if (!e.latLng) return;

		db.bikePins.add({
			name: "My bike",
			lat: e.latLng.lat(),
			lng: e.latLng.lng(),
		});
		await addBikePin("My bike", e.latLng.lat(), e.latLng.lng());
	});
}

//get an initial rough location via the user IP
async function getRoughLocation(): Promise<[number, number]|null> {	
  try {
    const res = await fetch("https://ipinfo.io?token=40b77027359b68");
    const data = await res.json();
    return data.loc.split(",").map(Number);
		
  } catch (err) {
    console.error("Failed to get location", err);
		return null;
  }
}

let userMarker: google.maps.marker.AdvancedMarkerElement;
let accuracyCircle: google.maps.Circle;
async function initTracker(): Promise<void> {
	const markerDiv = document.createElement("div");
	markerDiv.innerHTML = 
		`<div style="
			width: 30px;
			height: 30px;
			border: 8px solid rgb(200, 200, 200);
			background-color: rgb(60, 130, 250);
			border-radius: 50%;
			transform: translateY(23px)"
		</div>`;

	// border: 8px solid rgb(250, 250, 250);
	// background-color: rgb(50, 120, 240);
	
	const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
	userMarker = new AdvancedMarkerElement({
		map,
		title: "You are here",
		content: markerDiv,
		}
	);
	
	const { Circle } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  	accuracyCircle = new Circle({
    	map,
    	radius: 0,
    	fillColor: "#4285F4",
    	fillOpacity: 0.2,
    	strokeColor: "#4285F4",
    	strokeOpacity: 0.5,
		clickable: false,
  	});

	navigator.geolocation.watchPosition(updatePosition, 
		(err: GeolocationPositionError) => { 
			console.error("Error getting location:", err.message) 
		}, {
    	enableHighAccuracy: true,
    	maximumAge: 0,
    	timeout: 5000,
  	});
}

//update the marker when a new position is received
function updatePosition(position: GeolocationPosition): void {
  	const lat = position.coords.latitude;
  	const lng = position.coords.longitude;
  	const accuracy = position.coords.accuracy; // meters

  	const latLng = new google.maps.LatLng(lat, lng);

  	//move the marker
	userMarker.position = latLng;

  	//move accuracy circle
  	accuracyCircle.setCenter(latLng);
  	accuracyCircle.setRadius(accuracy);

	if (!isCentered) {
		isCentered = true;
  		map.panTo(latLng);
		map.setZoom(15);
	}
}

async function addBikePin(name: string, lat: number, lng: number): Promise<void> {
	const { AdvancedMarkerElement  } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

	new AdvancedMarkerElement({
		map,
		title: name,
		position: { lat, lng },
		}
	).addListener("click", () => {
		const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
		//open in a new tab
		window.open(url, '_blank')?.focus();
	});
}

//expose initMap to the global window object
(window as any).initMap = initMap;