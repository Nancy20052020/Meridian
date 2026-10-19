import { chain, type LatLon } from "./geo";

export type Port = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  currency: string;
  timeZone: string;
};

export type CashBook = {
  cashOnHand: number;
  supplierBill: number;
  customerInvoice: number;
  invoiceDaysAfterLanding: number;
  payroll: number;
  payrollDaysAfterScheduledArrival: number;
};

export type Route = {
  id: string;
  origin: Port;
  home: Port;
  waypoints: LatLon[];
  speedKnots: number;
  /** Share of the scheduled passage already elapsed when the page opens. */
  elapsedShare: number;
  cash: CashBook;
};

const P = {
  shanghai: port("shanghai", "Shanghai", 30.62, 122.06, "CNY", "Asia/Shanghai"),
  ningbo: port("ningbo", "Ningbo", 29.93, 121.85, "CNY", "Asia/Shanghai"),
  shenzhen: port("shenzhen", "Shenzhen", 22.57, 114.27, "CNY", "Asia/Shanghai"),
  busan: port("busan", "Busan", 35.08, 129.06, "KRW", "Asia/Seoul"),
  singapore: port("singapore", "Singapore", 1.26, 103.82, "SGD", "Asia/Singapore"),
  vungTau: port("vung-tau", "Vung Tau", 10.39, 107.08, "VND", "Asia/Ho_Chi_Minh"),
  nhava: port("nhava-sheva", "Nhava Sheva", 18.95, 72.95, "INR", "Asia/Kolkata"),
  losAngeles: port("los-angeles", "Los Angeles", 33.74, -118.27, "USD", "America/Los_Angeles"),
  seattle: port("seattle", "Seattle", 48.25, -125.35, "USD", "America/Los_Angeles"),
  newYork: port("new-york", "New York", 40.67, -74.04, "USD", "America/New_York"),
  rotterdam: port("rotterdam", "Rotterdam", 51.9, 4.25, "EUR", "Europe/Amsterdam"),
  hamburg: port("hamburg", "Hamburg", 54.02, 8.35, "EUR", "Europe/Berlin"),
  felixstowe: port("felixstowe", "Felixstowe", 51.96, 1.35, "GBP", "Europe/London"),
} satisfies Record<string, Port>;

function port(
  id: string,
  name: string,
  lat: number,
  lon: number,
  currency: string,
  timeZone: string,
): Port {
  return { id, name, lat, lon, currency, timeZone };
}

const at = (lat: number, lon: number): LatLon => ({ lat, lon });
const here = (place: Port): LatLon => ({ lat: place.lat, lon: place.lon });

const toLosAngeles = [
  at(38.5, 160),
  at(43, 180),
  at(46.5, -165),
  at(48, -150),
  at(45, -138),
  at(40.5, -128),
  at(36.8, -123.4),
  at(34.6, -121.2),
  at(33.85, -119.6),
  here(P.losAngeles),
];

const toSeattle = [
  at(42, 165),
  at(47, 180),
  at(51, -160),
  at(51.2, -145),
  at(49.5, -132),
  at(48.6, -128),
  here(P.seattle),
];

const shanghaiExit = [here(P.shanghai), at(30.2, 126.2), at(30.6, 132), at(33.5, 145)];
const ningboExit = [here(P.ningbo), at(29.4, 126.8), at(30.4, 134), at(33.2, 146)];
const shenzhenExit = [here(P.shenzhen), at(21.2, 121.2), at(23, 132), at(28, 148), at(34, 162)];
const busanExit = [here(P.busan), at(34.2, 128.6), at(32.2, 127.6), at(30.4, 129.8), at(30.6, 134), at(33.5, 148)];

const toPanama = [
  at(28, 160),
  at(20, 180),
  at(14, -160),
  at(11, -140),
  at(9.2, -116),
  at(8.2, -100),
  at(7.4, -90),
  at(7.2, -83),
  at(7.0, -80.2),
  at(8.15, -79.6),
  at(9.75, -79.95),
];

const caribbeanToNewYork = [
  at(12.5, -78),
  at(15.5, -72),
  at(17.0, -66.8),
  at(17.4, -63.2),
  at(20.8, -62),
  at(26, -67),
  at(33, -73),
  here(P.newYork),
];

const shanghaiSouth = [
  here(P.shanghai),
  at(27, 125.5),
  at(21.5, 122.5),
  at(15, 116),
  at(8, 111),
  at(3.5, 107.5),
  at(1.4, 104.8),
  here(P.singapore),
];

const shenzhenSouth = [
  here(P.shenzhen),
  at(18.5, 113.5),
  at(12, 111),
  at(6, 108),
  here(P.singapore),
];

const vungTauSouth = [here(P.vungTau), at(6.5, 105.8), at(2.2, 104.6), here(P.singapore)];

const malaccaToAden = [
  here(P.singapore),
  at(2.2, 102),
  at(3.0, 100.8),
  at(4.0, 100.2),
  at(5.2, 98.6),
  at(6.0, 96.2),
  at(6.4, 92),
  at(5.8, 86),
  at(5.15, 80.4),
  at(6.2, 76),
  at(8.4, 70),
  at(10.2, 62),
  at(12.0, 54),
  at(12.3, 49),
  at(12.45, 45.5),
  at(12.55, 43.5),
  at(14.2, 42.2),
];

const nhavaToAden = [
  here(P.nhava),
  at(15.0, 70.5),
  at(12.4, 63),
  at(11.2, 56),
  at(12.0, 50.5),
  at(12.45, 45.8),
  at(12.55, 43.5),
  at(14.2, 42.2),
];

const suezToChannel = [
  at(14.2, 42.2),
  at(17.5, 40.6),
  at(21.5, 38.0),
  at(25.2, 35.8),
  at(27.4, 34.4),
  at(29.4, 32.6),
  at(31.5, 32.35),
  at(33.2, 28.2),
  at(33.4, 24.2),
  at(35.2, 18.2),
  at(36.7, 13.0),
  at(37.7, 8.2),
  at(38.0, 4.2),
  at(37.2, 0.2),
  at(36.3, -2.3),
  at(35.95, -5.6),
  at(36.15, -8.8),
  at(39.2, -11.2),
  at(44.2, -10.0),
  at(48.0, -7.2),
  at(49.5, -4.2),
];

const toRotterdam = [at(50.6, 0.8), at(51.4, 2.6), here(P.rotterdam)];
const toHamburg = [at(50.8, 1.2), at(52.6, 3.2), at(54.1, 5.2), here(P.hamburg)];
const toFelixstowe = [at(49.5, -3.2), at(49.9, -1.2), at(50.5, 0.5), at(51.55, 1.5), here(P.felixstowe)];

type Book = {
  cash: number;
  payroll: number;
  invoice: number;
  bills: Record<string, number>;
};

const BOOKS: Record<string, Book> = {
  USD: {
    cash: 80000,
    payroll: 44000,
    invoice: 112000,
    bills: { CNY: 420000, KRW: 86000000, SGD: 82000 },
  },
  EUR: {
    cash: 74000,
    payroll: 42000,
    invoice: 108000,
    bills: { CNY: 450000, SGD: 88000, VND: 1750000000, INR: 6400000 },
  },
  GBP: {
    cash: 64000,
    payroll: 36000,
    invoice: 96000,
    bills: { CNY: 460000, SGD: 90000, INR: 6500000 },
  },
};

function make(origin: Port, home: Port, waypoints: LatLon[]): Route {
  const book = BOOKS[home.currency];
  const bill = book.bills[origin.currency];
  if (!bill) {
    throw new Error(`No sample bill for ${origin.currency} into ${home.currency}`);
  }
  return {
    id: `${origin.id}-${home.id}`,
    origin,
    home,
    waypoints,
    speedKnots: 14,
    elapsedShare: 0.4,
    cash: {
      cashOnHand: book.cash,
      supplierBill: bill,
      customerInvoice: book.invoice,
      invoiceDaysAfterLanding: 5,
      payroll: book.payroll,
      payrollDaysAfterScheduledArrival: 7,
    },
  };
}

export const ROUTES: Route[] = [
  make(P.shanghai, P.losAngeles, chain(shanghaiExit, toLosAngeles)),
  make(P.shanghai, P.seattle, chain(shanghaiExit, toSeattle)),
  make(P.shanghai, P.newYork, chain(shanghaiExit, toPanama, caribbeanToNewYork)),
  make(P.shanghai, P.rotterdam, chain(shanghaiSouth, malaccaToAden, suezToChannel, toRotterdam)),
  make(P.shanghai, P.hamburg, chain(shanghaiSouth, malaccaToAden, suezToChannel, toHamburg)),
  make(P.ningbo, P.losAngeles, chain(ningboExit, toLosAngeles)),
  make(P.ningbo, P.seattle, chain(ningboExit, toSeattle)),
  make(P.shenzhen, P.losAngeles, chain(shenzhenExit, toLosAngeles)),
  make(P.shenzhen, P.rotterdam, chain(shenzhenSouth, malaccaToAden, suezToChannel, toRotterdam)),
  make(P.shenzhen, P.felixstowe, chain(shenzhenSouth, malaccaToAden, suezToChannel, toFelixstowe)),
  make(P.busan, P.losAngeles, chain(busanExit, toLosAngeles)),
  make(P.busan, P.seattle, chain(busanExit, toSeattle)),
  make(P.singapore, P.rotterdam, chain(malaccaToAden, suezToChannel, toRotterdam)),
  make(P.singapore, P.hamburg, chain(malaccaToAden, suezToChannel, toHamburg)),
  make(P.singapore, P.felixstowe, chain(malaccaToAden, suezToChannel, toFelixstowe)),
  make(P.vungTau, P.rotterdam, chain(vungTauSouth, malaccaToAden, suezToChannel, toRotterdam)),
  make(P.vungTau, P.hamburg, chain(vungTauSouth, malaccaToAden, suezToChannel, toHamburg)),
  make(P.nhava, P.rotterdam, chain(nhavaToAden, suezToChannel, toRotterdam)),
  make(P.nhava, P.felixstowe, chain(nhavaToAden, suezToChannel, toFelixstowe)),
];

export const DEFAULT_ORIGIN = "shanghai";
export const DEFAULT_HOME = "los-angeles";

const byPair = new Map(ROUTES.map((route) => [`${route.origin.id}:${route.home.id}`, route]));

export function origins(): Port[] {
  const seen = new Map<string, Port>();
  for (const route of ROUTES) seen.set(route.origin.id, route.origin);
  return [...seen.values()];
}

export function homesFor(originId: string): Port[] {
  const seen = new Map<string, Port>();
  for (const route of ROUTES) {
    if (route.origin.id === originId) seen.set(route.home.id, route.home);
  }
  return [...seen.values()];
}

export function findRoute(originId: string, homeId: string): Route {
  const route = byPair.get(`${originId}:${homeId}`);
  if (!route) {
    throw new Error(`No lane from ${originId} to ${homeId}`);
  }
  return route;
}
