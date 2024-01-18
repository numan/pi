import * as Popover from '@radix-ui/react-popover';
import { Cross2Icon } from '@radix-ui/react-icons';

import { useEffect, useMemo, useState } from 'react';
import pinIcon from '@assets/img/pin.png';
import { AUSTIN_DATA } from './data';

type MapPoint = (typeof AUSTIN_DATA)[0];

export interface PinProps extends React.HTMLAttributes<HTMLDivElement> {
  leftLocation: number;
  topLocation: number;
  pin: MapPoint;
}

function project(lat: number, lng: number, zoom: number) {
  const R = 6378137;
  const R_MINOR = 6356752.314245179;

  const zoomLevel = zoom;

  const d = Math.PI / 180,
    r = R,
    tmp = R_MINOR / r,
    e = Math.sqrt(1 - tmp * tmp);
  let y = lat * d;
  const con = e * Math.sin(y);

  const ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
  y = -r * Math.log(Math.max(ts, 1e-10));
  const x = lng * d * r;

  const scale = 256 * Math.pow(2, zoomLevel);
  const transformScale = 0.5 / (Math.PI * R);

  const a = transformScale;
  const b = 0.5;
  const c = -1 * transformScale;
  const q = 0.5;

  return { x: scale * (a * x + b), y: scale * (c * y + q) };
}

function Pin({ leftLocation, topLocation, pin }: PinProps) {
  return (
    <div className="absolute" style={{ left: `${leftLocation}px`, top: `${topLocation}px` }}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button>
            <img src={pinIcon} alt="Permit" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="bg-white p-2 rounded-lg shadow-lg w-80 max-h-80 overflow-auto">
            <Popover.Close aria-label="Close">
              <Cross2Icon />
            </Popover.Close>

            <dl className="-my-3 px-6 py-4 text-sm leading-6">
              <div className="">
                <dt className="text-lg semibold">{pin['Project Name']}</dt>
              </div>
              <div className="flex items-start py-1">
                <dt className="text-gray-500 w-1/3">Description</dt>
                <dd className="w-2/3">
                  <span>{pin.Description}</span>
                </dd>
              </div>
              <div className="flex items-start py-1">
                <dt className="text-gray-500 w-1/3">Category</dt>
                <dd className="w-2/3">
                  <span>{pin.Category}</span>
                </dd>
              </div>
              <div className="flex items-start py-1">
                <dt className="text-gray-500 w-1/3">Issued Date</dt>
                <dd className="w-2/3">
                  <time dateTime={pin['Issued Date']}>{pin['Issued Date']}</time>
                </dd>
              </div>
              <div className="flex items-start py-1">
                <dt className="text-gray-500 w-1/3">Total Area Added (sqft)</dt>
                <dd className="w-2/3">
                  <span>{pin['Total New Add SQFT'] ? pin['Total New Add SQFT'] : 'Not Available'}</span>
                </dd>
              </div>
              <div className="flex items-start py-1">
                <dt className="text-gray-500 w-1/3">Total Job Valuation</dt>
                <dd className="w-2/3">
                  <span>
                    {pin['Total Job Valuation']
                      ? new Intl.NumberFormat('us-EN', { style: 'currency', currency: 'USD' }).format(
                          pin['Total Job Valuation'],
                        )
                      : 'Not Available'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="semibold">
                  <a href={pin.Link} target="_blank" rel="noreferrer">
                    Permit Details
                  </a>
                </dt>
              </div>
            </dl>

            <Popover.Arrow className="PopoverArrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export default function App() {
  const [mapBounds, setMapBounds] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(null);
  const [rate, setRate] = useState(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ topic: 'content-script-ready' });
  }, []);

  useEffect(() => {
    const processMessage = (message) => {
      setMapBounds(message.mapState.searchQueryState.mapBounds);
      setZoomLevel(message.mapState.searchQueryState.mapZoom);
    };
    chrome.runtime.onMessage.addListener(processMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(processMessage);
    };
  }, []);

  useEffect(() => {
    if (!mapBounds) {
      setRate(null);
      return;
    }
    const mapContainer = document.getElementById('search-page-map');
    const { offsetWidth, offsetHeight } = mapContainer;
    const { north, south, east, west } = mapBounds;
    setRate({
      horizontalRate: offsetWidth / (east - west),
      verticalRate: offsetHeight / (north - south),
    });
  }, [mapBounds]);

  const data = useMemo(() => {
    if (!zoomLevel) return [];
    if (!mapBounds) return [];
    const { north, south, east, west } = mapBounds;
    return AUSTIN_DATA.filter(
      item => item.Latitude > west && item.Latitude < east && item.Longitude >= south && item.Longitude <= north,
    );
  }, [mapBounds, zoomLevel]);

  const pins = useMemo(() => {
    return data.map(item => {
      if (!rate || !mapBounds) return;

      const { Latitude: lat, Longitude: lng } = item;

      const mapOrigin = project(mapBounds.north, mapBounds.west, zoomLevel);
      const projection = project(lng, lat, zoomLevel);

      return (
        <Pin
          key={item['Project ID']}
          leftLocation={projection.x - mapOrigin.x - 16}
          topLocation={projection.y - mapOrigin.y - 16}
          pin={item}
        />
      );
    });
  }, [data, mapBounds, rate, zoomLevel]);

  return <>{pins}</>;
}
