# Build spec: Saltmarsh — one-page restaurant site

A single static page for a neighbourhood seafood restaurant. One HTML file, no
build step, no framework. It is the whole web presence: someone arrives from a
search or a map pin and needs to know what this place is, whether it is open,
and how to book a table.

## The business

- **Name:** Saltmarsh
- **Kind:** Small seafood restaurant and oyster bar, 34 covers
- **Address:** 114 Harbour Road, Eastport
- **Phone:** (555) 0134
- **Email:** bookings@saltmarsh.example
- **Opening hours:**
  - Tuesday to Thursday, 5pm – 10pm
  - Friday and Saturday, noon – 11pm
  - Sunday, noon – 8pm
  - Closed Mondays
- **Positioning line:** Day boat fish, a short list, cooked over coals.

## Sections, in order

1. **Header.** Name, the positioning line, and one obvious way to book.
2. **Today's state.** Opening hours laid out so a reader can tell at a glance
   whether the place is open now. Do not fake a live "open now" indicator —
   print the hours clearly instead.
3. **Menu.** Three groups — Oysters and raw, From the coals, Sides — four to six
   items each, with prices. Short descriptions, two lines at most. Note at the
   foot of the menu that the fish changes with the catch.
4. **Reservations.** Phone and email, both as working `tel:` and `mailto:`
   links. Walk-ins welcome at the bar. Parties over six by phone only.
5. **Finding it.** Address, the nearest landmark, a line on parking, and a link
   to a map search for the address.
6. **Footer.** Name, address, phone, and a line that the kitchen closes an hour
   before the listed closing time.

## Constraints

- One file, `index.html`. CSS inline in a `<style>` block. No JavaScript.
- Readable on a phone first. No horizontal scrolling at 375px wide.
- Works with images off: no decorative image is load-bearing for meaning.
- Respect `prefers-color-scheme` for light and dark.
- Semantic headings in order, a `<main>` landmark, and link text that makes
  sense out of context.
- Contrast at least 4.5:1 for body text.
- Under 20KB total.

## Acceptance

- Every section above is present, in that order.
- The phone and email are clickable on a phone.
- Nothing on the page claims an award, a review score, a rating, or a
  certification.
- No tracking, no analytics, no third-party requests of any kind.
- Served with `content-type: text/html` and renders without errors.
