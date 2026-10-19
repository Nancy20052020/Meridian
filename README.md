# Meridian

A live globe for one small importer. It answers a single question: if this shipment is late, do we miss payroll?

One origin port. One home city. One sea route, drawn as a single arc. The rest of the planet stays dark.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Shanghai to Los Angeles is already on the globe. Choose another port and another home city from the lists. There are no accounts and no API keys.

```bash
npm test
npm run build
```

## Deploy

Import the repository in Vercel. The framework is Next.js. The install is `npm ci`, the build is `next build`, and Node is 22. No environment variables.

From this directory, `npx vercel` does the same once the CLI is logged in.

## What the screen is saying

The left side is the route. Scheduled arrival is the passage at 14 knots along that lane. With this weather is the same arrival, plus the delay from the wind and waves on the route.

The ship is not tracked. Position is scheduled progress, plus the weather delay.

The right side is the cash book, in the home currency.

- Cash today is the balance the book starts from.
- The bill is the supplier invoice, converted at today's rate, and it leaves the day the goods land.
- The invoice is the customer payment. It arrives five days after the goods land.
- Payroll is fixed. It is seven days after the scheduled arrival, and it does not move when the ship does.
- The first zero day is the first day that balance reaches zero. Outflows are taken before the invoice if they fall on the same day.

Dates are the home city's local days.

A rough stretch of the route is a soft amber band on the arc. A thin gleam travels the gold line.

## Play the voyage

The ship is already at sea. When the weather has answered, the rest of the passage plays, about sixteen seconds from today through the last cash day. The vessel moves along the arc and leaves a short wake. The line under the track counts the days until landing, and where the amber band is, it says the water is rough.

The day on the track is the home city's day. Cash on that day is the book: the bill leaves when the goods land, payroll stays on its date, and the invoice arrives five days after landing. Drag the track to any day. The figures on the left and the right stay the answer for today.

## Where each number comes from

| On screen | Source |
| --- | --- |
| Scheduled arrival, payroll date | The sea lane, 14 knots, and the cash book |
| Weather-adjusted arrival, the delay | Open-Meteo wind and wave height at eight points on the lane |
| The bill in home currency | The supplier bill, times the live rate |
| Cash, the invoice, payroll, the five-day wait | The cash book for that corridor |

If a feed does not answer, Meridian leaves that number out. It does not invent a delay or a rate.

## Weather

Eight points sit on the lane. Each one stands for an equal share of the passage.

A point keeps its schedule below 22 knots of wind and 2.5 meters of sea. Above that, speed falls. Wind can take up to half the speed, reached at 42 knots. Waves can take a little more, and the two combine, up to a 60% loss of speed. Lost speed becomes extra time: the leg's scheduled hours times `1 / (1 − slowdown) − 1`. The delay is the sum of that extra time. The adjusted arrival is the scheduled arrival plus the delay.

Wind and waves are current conditions from [Open-Meteo](https://open-meteo.com/), including the marine API. No key.

## Exchange rate

The rate is the open feed at `open.er-api.com`, with [Frankfurter](https://www.frankfurter.app/) as a fallback. No key. The supplier bill is in the origin currency. The cash book spends the home-currency amount.

## Sample book

The loaded book is one small importer, not a live accounting system. Cash on hand, the supplier bill, the customer invoice, and payroll are the sample for that corridor. Only the timing of the bill and the invoice move, and only because the landing day moved.
