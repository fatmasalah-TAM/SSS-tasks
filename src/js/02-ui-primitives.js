/* ═════════════ ui primitives ═════════════ */
/* null, false or a list never show up as text: replaceChildren(a, cond ? b : null) is common across the app */
{ const rc = Element.prototype.replaceChildren; Element.prototype.replaceChildren = function (...a) { return rc.apply(this, a.flat(Infinity).filter(x => x != null && x !== false)); }; }
const ICONS = {
  mark: '<svg viewBox="0 0 1000 1000" fill="none"><g transform="translate(-779.1 725.4) scale(0.6829)"><g><path fill="currentColor" transform="translate(1501.0 0) scale(1.00000 -1.00000)" d="M42 401H151L89 108C79 63 79 60 79 43C79 4 98 -17 133 -17C170 -17 210 1 266 42L343 99L330 125L274 85C252 69 239 64 220 64C202 64 196 71 196 92C196 113 199 135 205 164L256 401H303C343 401 363 400 395 396L409 452L403 457L269 452L282 508L313 624L303 636L237 612C218 605 202 601 180 598V582C180 556 178 538 164 460L49 428Z"/></g><rect fill="var(--accent)" x="1539.0" y="-465.0" width="490.4" height="74.0"/><path fill="var(--accent)" stroke="var(--accent)" stroke-width="18.5" stroke-linejoin="round" d="M2014.6 -568.6L2207.0 -428.0L2014.6 -287.4Z"/></g></svg>',
  wordmarkAnim: '<svg class="wm-anim" viewBox="-80 -760 2977 820" fill="none" role="img" aria-label="Ovrto"><g class="wm-l wm-l1"><path fill="currentColor" transform="translate(0.0 0) scale(1.00000 -1.00000)" d="M48 135C48 34 98 -17 196 -17C242 -17 281 -9 321 10C377 36 434 86 456 126C483 174 502 256 502 319C502 414 446 469 350 469C297 469 241 452 189 419C127 380 93 337 72 272C56 223 48 176 48 135ZM162 130C162 220 188 324 223 374C247 408 275 425 308 425C356 425 388 385 388 323C388 233 362 128 327 78C303 44 275 27 243 27C193 27 162 67 162 130Z"/></g><g class="wm-l wm-l2"><path fill="currentColor" transform="translate(556.0 0) scale(1.00000 -1.00000)" d="M19 324H47L75 384C77 390 89 392 117 392C184 392 220 395 254 403L213 362C119 268 87 207 87 123C87 35 131 -17 205 -17C260 -17 319 12 368 63C452 149 513 279 513 370C513 423 480 469 443 469C435 469 429 468 417 465C385 428 370 412 351 398L361 377C370 385 383 389 397 389C420 389 436 366 436 334C436 278 412 195 378 135C344 76 306 46 263 46C220 46 197 82 197 147C197 187 203 227 217 269C239 338 265 380 324 450L310 469C298 461 270 455 246 455C203 455 135 460 111 461C95 462 82 460 60 456Z"/></g><g class="wm-l wm-l3"><path fill="currentColor" transform="translate(1112.0 0) scale(1.00000 -1.00000)" d="M20 352 33 326 67 350C85 362 100 370 109 370C116 370 121 364 121 354C121 328 125 327 95 194L71 87C65 62 58 38 44 -5L55 -17C82 -8 105 -4 163 2C177 93 188 143 204 188C242 291 281 339 327 339C344 339 358 334 379 320L391 326C392 368 396 397 411 463C401 467 394 469 384 469C356 469 331 457 307 432C280 404 264 375 187 219C206 303 200 277 219 359C229 401 234 423 234 437C234 458 225 469 209 469C182 469 146 451 101 416Z"/></g><g class="wm-l wm-l4"><path fill="currentColor" transform="translate(1501.0 0) scale(1.00000 -1.00000)" d="M42 401H151L89 108C79 63 79 60 79 43C79 4 98 -17 133 -17C170 -17 210 1 266 42L343 99L330 125L274 85C252 69 239 64 220 64C202 64 196 71 196 92C196 113 199 135 205 164L256 401H303C343 401 363 400 395 396L409 452L403 457L269 452L282 508L313 624L303 636L237 612C218 605 202 601 180 598V582C180 556 178 538 164 460L49 428Z"/></g><rect class="wm-x" fill="var(--accent)" x="1539.0" y="-465.0" width="490.4" height="74.0"/><path class="wm-chev" fill="var(--accent)" stroke="var(--accent)" stroke-width="18.5" stroke-linejoin="round" d="M2014.6 -568.6L2207.0 -428.0L2014.6 -287.4Z"/><circle class="wm-ring" cx="2592.0" cy="-226.0" r="249.7"/><g class="wm-o"><path fill="var(--accent)" transform="translate(2317.0 0) scale(1.00000 -1.00000)" d="M48 135C48 34 98 -17 196 -17C242 -17 281 -9 321 10C377 36 434 86 456 126C483 174 502 256 502 319C502 414 446 469 350 469C297 469 241 452 189 419C127 380 93 337 72 272C56 223 48 176 48 135ZM162 130C162 220 188 324 223 374C247 408 275 425 308 425C356 425 388 385 388 323C388 233 362 128 327 78C303 44 275 27 243 27C193 27 162 67 162 130Z"/></g><circle class="wm-dot" fill="var(--accent)" cx="2592.0" cy="-226.0" r="38.6"/></svg>',
  markAnim: '<svg class="mark-anim" viewBox="0 0 1000 1000" fill="none" aria-hidden="true"><g transform="translate(-779.1 725.4) scale(0.6829)"><g class="mk-t"><path fill="currentColor" transform="translate(1501.0 0) scale(1.00000 -1.00000)" d="M42 401H151L89 108C79 63 79 60 79 43C79 4 98 -17 133 -17C170 -17 210 1 266 42L343 99L330 125L274 85C252 69 239 64 220 64C202 64 196 71 196 92C196 113 199 135 205 164L256 401H303C343 401 363 400 395 396L409 452L403 457L269 452L282 508L313 624L303 636L237 612C218 605 202 601 180 598V582C180 556 178 538 164 460L49 428Z"/></g><rect class="mk-x" fill="var(--accent)" x="1539.0" y="-465.0" width="490.4" height="74.0"/><path class="mk-chev" fill="var(--accent)" stroke="var(--accent)" stroke-width="18.5" stroke-linejoin="round" d="M2014.6 -568.6L2207.0 -428.0L2014.6 -287.4Z"/></g></svg>',
  wordmark: '<svg viewBox="-80 -760 2977 820" fill="none" role="img" aria-label="Ovrto"><g><path fill="currentColor" transform="translate(0.0 0) scale(1.00000 -1.00000)" d="M48 135C48 34 98 -17 196 -17C242 -17 281 -9 321 10C377 36 434 86 456 126C483 174 502 256 502 319C502 414 446 469 350 469C297 469 241 452 189 419C127 380 93 337 72 272C56 223 48 176 48 135ZM162 130C162 220 188 324 223 374C247 408 275 425 308 425C356 425 388 385 388 323C388 233 362 128 327 78C303 44 275 27 243 27C193 27 162 67 162 130Z"/></g><g><path fill="currentColor" transform="translate(556.0 0) scale(1.00000 -1.00000)" d="M19 324H47L75 384C77 390 89 392 117 392C184 392 220 395 254 403L213 362C119 268 87 207 87 123C87 35 131 -17 205 -17C260 -17 319 12 368 63C452 149 513 279 513 370C513 423 480 469 443 469C435 469 429 468 417 465C385 428 370 412 351 398L361 377C370 385 383 389 397 389C420 389 436 366 436 334C436 278 412 195 378 135C344 76 306 46 263 46C220 46 197 82 197 147C197 187 203 227 217 269C239 338 265 380 324 450L310 469C298 461 270 455 246 455C203 455 135 460 111 461C95 462 82 460 60 456Z"/></g><g><path fill="currentColor" transform="translate(1112.0 0) scale(1.00000 -1.00000)" d="M20 352 33 326 67 350C85 362 100 370 109 370C116 370 121 364 121 354C121 328 125 327 95 194L71 87C65 62 58 38 44 -5L55 -17C82 -8 105 -4 163 2C177 93 188 143 204 188C242 291 281 339 327 339C344 339 358 334 379 320L391 326C392 368 396 397 411 463C401 467 394 469 384 469C356 469 331 457 307 432C280 404 264 375 187 219C206 303 200 277 219 359C229 401 234 423 234 437C234 458 225 469 209 469C182 469 146 451 101 416Z"/></g><g><path fill="currentColor" transform="translate(1501.0 0) scale(1.00000 -1.00000)" d="M42 401H151L89 108C79 63 79 60 79 43C79 4 98 -17 133 -17C170 -17 210 1 266 42L343 99L330 125L274 85C252 69 239 64 220 64C202 64 196 71 196 92C196 113 199 135 205 164L256 401H303C343 401 363 400 395 396L409 452L403 457L269 452L282 508L313 624L303 636L237 612C218 605 202 601 180 598V582C180 556 178 538 164 460L49 428Z"/></g><rect fill="var(--accent)" x="1539.0" y="-465.0" width="490.4" height="74.0"/><path fill="var(--accent)" stroke="var(--accent)" stroke-width="18.5" stroke-linejoin="round" d="M2014.6 -568.6L2207.0 -428.0L2014.6 -287.4Z"/><g><path fill="var(--accent)" transform="translate(2317.0 0) scale(1.00000 -1.00000)" d="M48 135C48 34 98 -17 196 -17C242 -17 281 -9 321 10C377 36 434 86 456 126C483 174 502 256 502 319C502 414 446 469 350 469C297 469 241 452 189 419C127 380 93 337 72 272C56 223 48 176 48 135ZM162 130C162 220 188 324 223 374C247 408 275 425 308 425C356 425 388 385 388 323C388 233 362 128 327 78C303 44 275 27 243 27C193 27 162 67 162 130Z"/></g><circle fill="var(--accent)" cx="2592.0" cy="-226.0" r="38.6"/></svg>',
  turn: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M10 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 4.4a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z"/></svg>',
  inbox: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 11.5 5.1 5.1A1.6 1.6 0 0 1 6.6 4h6.8a1.6 1.6 0 0 1 1.5 1.1L17 11.5V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.7"/><path d="M3 11.5h3.8l1.3 2h3.8l1.3-2H17" stroke="currentColor" stroke-width="1.7"/></svg>',
  review: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M1.8 10S4.8 4.3 10 4.3s8.2 5.7 8.2 5.7-3 5.7-8.2 5.7S1.8 10 1.8 10zM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
  board: '<svg viewBox="0 0 20 20" fill="none"><rect x="2.8" y="3" width="3.8" height="14" rx="1.9" stroke="currentColor" stroke-width="1.7"/><rect x="8.1" y="3" width="3.8" height="9.5" rx="1.9" stroke="currentColor" stroke-width="1.7"/><rect x="13.4" y="3" width="3.8" height="6" rx="1.9" stroke="currentColor" stroke-width="1.7"/></svg>',
  list: '<svg viewBox="0 0 20 20" fill="none"><path d="M7.5 5.5H17M7.5 10H17M7.5 14.5H17" stroke="currentColor" stroke-width="1.7"/><circle cx="3.8" cy="5.5" r="1.1" fill="currentColor"/><circle cx="3.8" cy="10" r="1.1" fill="currentColor"/><circle cx="3.8" cy="14.5" r="1.1" fill="currentColor"/></svg>',
  work: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M4 3.5h4.5v13H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zm6 0h6a1 1 0 0 1 1 1V10h-7z"/></svg>',
  bug: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 5a3.6 3.6 0 0 1 3.6 3.6v4.2a3.6 3.6 0 0 1-7.2 0V8.6A3.6 3.6 0 0 1 10 5z" fill="currentColor"/><path d="M7.6 3.2 8.8 5M12.4 3.2 11.2 5M3.5 9.5h2.9M13.6 9.5h2.9M3.8 14.5l2.7-1.2M16.2 14.5l-2.7-1.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  sprint: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M7.5 4.5h5a5.5 5.5 0 0 1 0 11h-5a5.5 5.5 0 0 1 0-11zM8.6 7.2v5.6L13 10z"/></svg>',
  company: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M7.5 3h5A1.5 1.5 0 0 1 14 4.5V6h2.5A1.5 1.5 0 0 1 18 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5v-8A1.5 1.5 0 0 1 3.5 6H6V4.5A1.5 1.5 0 0 1 7.5 3zm.3 1.8V6h4.4V4.8zM2 10.2h16v1.4h-6.6v1h-2.8v-1H2z"/></svg>',
  deal: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M10.6 2.5h5.6a1.3 1.3 0 0 1 1.3 1.3v5.6a1.3 1.3 0 0 1-.4.9l-7 7a1.3 1.3 0 0 1-1.8 0l-5.5-5.5a1.3 1.3 0 0 1 0-1.8l7-7a1.3 1.3 0 0 1 .8-.5zM14 4.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>',
  client: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M3 8.3 10 3.6l7 4.7V17h-5v-4.2H8V17H3z"/></svg>',
  all: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><rect x="3" y="3" width="6" height="6" rx="1.8"/><rect x="11" y="3" width="6" height="6" rx="1.8"/><rect x="3" y="11" width="6" height="6" rx="1.8"/><rect x="11" y="11" width="6" height="6" rx="1.8"/></svg>',
  view: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M3.2 4h13.6a.7.7 0 0 1 .5 1.2L12 11v5.2a.6.6 0 0 1-.4.6l-2.8 1a.6.6 0 0 1-.8-.6V11L2.7 5.2A.7.7 0 0 1 3.2 4z"/></svg>',
  folder: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H8l2 2h5.5A1.5 1.5 0 0 1 17 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5z"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2"/></svg>',
  x: '<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8"/></svg>',
  chev: '<svg viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5 8 14l7.5-8" stroke="currentColor" stroke-width="2"/></svg>',
  search: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M8.8 2.5a6.3 6.3 0 0 1 5.1 10l3.6 3.6-1.4 1.4-3.6-3.6A6.3 6.3 0 1 1 8.8 2.5zm0 2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z"/></svg>',
  gear: '<svg viewBox="0 0 20 20" fill="none"><path d="M8.6 2.5h2.8l.4 2.1 1.3.7 2-.8 1.4 2.4-1.6 1.4v1.4l1.6 1.4-1.4 2.4-2-.8-1.3.7-.4 2.1H8.6l-.4-2.1-1.3-.7-2 .8-1.4-2.4 1.6-1.4V9.3L3.5 7.9l1.4-2.4 2 .8 1.3-.7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>',
  person: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M3.8 17c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" stroke-width="1.6"/><path d="M4 11v6h12v-6" stroke="currentColor" stroke-width="1.6"/></svg>',
  export: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 9l4 4 4-4" stroke="currentColor" stroke-width="1.6"/><path d="M4 15v2h12v-2" stroke="currentColor" stroke-width="1.6"/></svg>',
  more: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="15.5" cy="10" r="1.6"/></svg>',
  grip: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.3"/><circle cx="13" cy="5" r="1.3"/><circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/><circle cx="7" cy="15" r="1.3"/><circle cx="13" cy="15" r="1.3"/></svg>',
  help: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M10 14v.2" stroke="currentColor" stroke-width="1.6"/></svg>',
  back: '<svg viewBox="0 0 20 20" fill="none"><path d="M12 4 6 10l6 6" stroke="currentColor" stroke-width="1.8"/></svg>',
  pass: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5 8 14.5l8-9" stroke="currentColor" stroke-width="2.2"/></svg>',
  undo: '<svg viewBox="0 0 20 20" fill="none"><path d="M7 5 3 9l4 4" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h9a5 5 0 0 1 0 10h-2" stroke="currentColor" stroke-width="1.8"/></svg>',
  whatsapp: '<svg viewBox="0 0 20 20" fill="none"><path d="M3.5 16.5 4.6 13A7 7 0 1 1 7 15.4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 7.5c0 2.5 2.5 5 5 5l1-1.4-1.6-.8-.8.8c-.9-.4-1.8-1.3-2.2-2.2l.8-.8-.8-1.6z" fill="currentColor"/></svg>',
  calendar: '<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4.5" width="14" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M3 8.5h14M7 2.5v3M13 2.5v3" stroke="currentColor" stroke-width="1.5"/></svg>',
  ret: '<svg viewBox="0 0 20 20" fill="none"><path d="M15 6a6 6 0 1 0 1 6" stroke="currentColor" stroke-width="1.8"/><path d="M15 2v4h-4" stroke="currentColor" stroke-width="1.8"/></svg>',
  chart: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><rect x="3.5" y="9.5" width="3.4" height="7" rx="1.2"/><rect x="8.3" y="4" width="3.4" height="12.5" rx="1.2"/><rect x="13.1" y="7" width="3.4" height="9.5" rx="1.2"/></svg>',
  mic: '<svg viewBox="0 0 20 20" fill="none"><rect x="7.2" y="2.8" width="5.6" height="9.4" rx="2.8" stroke="currentColor" stroke-width="1.6"/><path d="M4.6 9.6a5.4 5.4 0 0 0 10.8 0M10 15v2.6" stroke="currentColor" stroke-width="1.6"/></svg>',
  chat: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M6 3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9.6L5 17.6V14a3 3 0 0 1-2-2.8V6a3 3 0 0 1 3-3z"/></svg>',
  headset: '<svg viewBox="0 0 20 20" fill="none"><path d="M3.5 12.5v-2a6.5 6.5 0 0 1 13 0v2" stroke="currentColor" stroke-width="1.6"/><rect x="2.8" y="11.2" width="3.4" height="5.4" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="13.8" y="11.2" width="3.4" height="5.4" rx="1.4" stroke="currentColor" stroke-width="1.6"/></svg>',
  reply: '<svg viewBox="0 0 20 20" fill="none"><path d="M8 5 3.5 9.5 8 14" stroke="currentColor" stroke-width="1.6"/><path d="M4 9.5h7a5 5 0 0 1 5 5v1" stroke="currentColor" stroke-width="1.6"/></svg>',
  send: '<svg viewBox="0 0 20 20" fill="none"><path d="M3.5 10 16.5 4l-4.6 12.5-2.5-5.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9.4 11.3 7.1-7.3" stroke="currentColor" stroke-width="1.6"/></svg>',
  copy: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>',
  clip: '<svg viewBox="0 0 20 20" fill="none"><path d="m15.5 9.2-5.8 5.9a3.4 3.4 0 0 1-4.8-4.8l6-6a2.3 2.3 0 0 1 3.2 3.2l-5.9 5.9a1.1 1.1 0 0 1-1.6-1.6l5.4-5.4" stroke="currentColor" stroke-width="1.6"/></svg>',
  key: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M7 5.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4zm0 2.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/><path d="M10.9 9h6.1a.9.9 0 0 1 .9.9v.2a.9.9 0 0 1-.9.9h-.8v2.2a.9.9 0 0 1-.9.9h-.4a.9.9 0 0 1-.9-.9V11h-3.1z"/></svg>',
  eye: '<svg viewBox="0 0 20 20" fill="none"><path d="M2.5 10S5.3 4.8 10 4.8 17.5 10 17.5 10 14.7 15.2 10 15.2 2.5 10 2.5 10Z" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.3" stroke="currentColor" stroke-width="1.6"/></svg>',
  leave: '<svg viewBox="0 0 20 20" fill="none"><path d="M4.4 15.6a5.6 5.6 0 0 1 11.2 0z" fill="currentColor"/><path d="M2.8 17h14.4M10 8V2.8m0 0L12.4 5M10 2.8 7.6 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 20 20" fill="none"><rect x="4.5" y="9" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" stroke-width="1.6"/></svg>',
  play: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.5 4.2c0-.8.9-1.3 1.6-.9l8 5c.6.4.6 1.3 0 1.7l-8 5c-.7.4-1.6-.1-1.6-.9z"/></svg>',
  pause: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="4" width="3.6" height="12" rx="1"/><rect x="11.4" y="4" width="3.6" height="12" rx="1"/></svg>',
  bell: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><path d="M10 2.2a5.4 5.4 0 0 1 5.4 5.4v4.1l1.5 2.2c.4.5 0 1.1-.6 1.1H3.7c-.6 0-1-.6-.6-1.1l1.5-2.2V7.6A5.4 5.4 0 0 1 10 2.2zM8 16.3h4a2 2 0 0 1-4 0z"/></svg>',
  invite: '<svg viewBox="0 0 20 20" fill="none"><circle cx="8" cy="7" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 17c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 6v6M12.5 9h6" stroke="currentColor" stroke-width="1.6"/></svg>',
  menu: '<svg viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd"><circle cx="4.5" cy="10" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="15.5" cy="10" r="2"/></svg>',
  out: '<svg viewBox="0 0 20 20" fill="none"><path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.5 15.5 10 12 13.5M15.5 10H8" stroke="currentColor" stroke-width="1.6"/></svg>',
  upload: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 17V7M6 11l4-4 4 4" stroke="currentColor" stroke-width="1.6"/><path d="M4 3.5h12" stroke="currentColor" stroke-width="1.6"/></svg>',
  wifi: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 8a10 10 0 0 1 14 0M5.5 11a6.5 6.5 0 0 1 9 0M8 14a3 3 0 0 1 4 0" stroke="currentColor" stroke-width="1.6"/></svg>',
};
/* brand lockup: the drawn Ovrto wordmark, or the mark plus the custom name if a workspace renamed the app */
const brandLockup = name => name === CFG.brand ? [h('span', { class: 'wordmark', 'aria-label': name, html: ICONS.wordmark })] : [icon('mark', 22), h('b', { text: name })];
const icon = (k, size = 18) => h('span', { class: 'ico ico-' + k, 'aria-hidden': 'true', html: (ICONS[k] || '').replace('<svg ', `<svg width="${size}" height="${size}" stroke-linecap="round" stroke-linejoin="round" `) });

/* status glyph: survey squares */
function stGlyph(cat, color, size = 12) {
  const c = color ? `color-mix(in srgb, ${color}, #fff var(--lift))` : `var(--st-${cat})`; let inner = '';
  const S_ = `style="stroke:${c}"`, F_ = `style="fill:${c}"`, SF = `style="fill:${c};stroke:${c}"`;
  // status circles: dashed (backlog), empty (to do), half (in progress), dot (in review), filled tick (done), cross (canceled)
  const ring = (extra = '') => `<circle cx="6" cy="6" r="5.1" fill="none" ${S_} stroke-width="1.5"${extra}/>`;
  if (cat === 'backlog') inner = ring(' stroke-dasharray="2.1 1.9"');
  else if (cat === 'unstarted') inner = ring();
  else if (cat === 'started') inner = ring() + `<path d="M6 2.6A3.4 3.4 0 0 1 6 9.4Z" ${F_}/>`;
  else if (cat === 'review') inner = ring() + `<path d="M6 2.6A3.4 3.4 0 1 1 2.6 6H6Z" ${F_}/>`;
  else if (cat === 'done') inner = `<circle cx="6" cy="6" r="5.85" ${F_}/><path d="M3.6 6.2 5.2 7.8 8.5 4.4" fill="none" style="stroke:var(--surface)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  else inner = ring() + `<path d="M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8" ${S_} stroke-width="1.4" stroke-linecap="round"/>`;
  return h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12">${inner}</svg>` });
}
const stIcon = st => stGlyph(st?.category || 'unstarted', st?.color);
function prioGlyph(p) {
  let inner;
  if (p === 1) inner = '<rect x=".5" y=".5" width="13" height="13" rx="2" style="fill:var(--red)"/><path d="M7 3.5v4.5" style="stroke:var(--surface)" stroke-width="1.8"/><rect x="6.1" y="9.6" width="1.8" height="1.8" style="fill:var(--surface)"/>';
  else if (!p) inner = '<path d="M2 7h2M6 7h2M10 7h2" style="stroke:var(--mute)" stroke-width="1.5"/>';
  else { const lv = { 2: 3, 3: 2, 4: 1 }[p]; inner = [0, 1, 2].map(i => `<rect x="${1.5 + i * 4}" y="${9 - i * 3}" width="2.6" height="${3.5 + i * 3}" style="fill:${i < lv ? 'var(--fg2)' : 'var(--line-strong)'}"/>`).join(''); }
  return h('span', { class: 'ico', title: prioName(p), 'aria-label': prioName(p), html: `<svg width="14" height="14" viewBox="0 0 14 14">${inner}</svg>` });
}
function plate(t, big) { const [pre, n] = taskKey(t).split('-'); return h('span', { class: 'plate' + (big ? ' big' : ''), 'aria-label': taskKey(t) }, h('i', { text: pre }), h('b', { text: n })); }
function tag(label, color, cls = '') { return h('span', { class: 'tag ' + cls, style: { '--c': color || 'var(--fg2)' }, title: label, text: label }); }
function typeChip(ty, solid) { return ty ? tag(ty.name, ty.color, solid ? 'solid' : '') : null; }
function avatar(p, opts = {}) {
  const cls = 'av' + (opts.size ? ' ' + opts.size : '') + (opts.turn ? ' turn' : '') + (!p ? ' none' : '');
  const ring = p && !opts.turn ? hashColor(p.id) : null;
  const e = h('span', { class: cls, title: p ? dname(p) : (opts.label || 'Unassigned'), style: ring ? { '--ring': ring } : null });
  const b = h('span', { class: 'b' });
  if (p?.avatar_url && !S.prefs?.data_saver) b.append(h('img', { src: p.avatar_url, alt: '', loading: 'lazy' }));
  else b.textContent = p ? initials(p) : (opts.text || '');
  e.append(b); return e;
}
function hashColor(id) { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return OPT_COLORS[x % 6]; }
function turnAvatar(t, size) {
  const o = t.turn_owner;
  if (!o) return avatar(null, { size, label: 'Nobody' });
  if (o === 'client') return avatar(null, { size, text: 'CL', label: 'Client' });
  if (o === 'admins') return avatar(null, { size, text: 'AD', label: 'Admins' });
  return avatar(prof(o), { size, turn: true });
}
function turnLine(t) {
  if (!t.turn_owner) return null;
  const mine = turnIsMine(t);
  return h('span', { class: 'turnline' + (mine ? ' me' : ''), title: `${turnName(t.turn_owner)}’s turn for ${ago(t.turn_since)}` },
    (t.turn_owner !== t.assignee_id) ? h('span', { text: mine ? 'You' : first(prof(t.turn_owner)) || turnName(t.turn_owner) }) : null,
    h('span', { text: '· ' + ago(t.turn_since) }));
}
var ILLS = {"all-clear": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 80h92\" stroke-opacity=\".35\" stroke-dasharray=\"2 4\"/> <path d=\"M28 58v12a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V58\"/> <path d=\"M28 58h18l3 5h22l3-5h18\"/> <path d=\"M33 58l5-12h44l5 12\" stroke-opacity=\".55\"/> <circle cx=\"60\" cy=\"27\" r=\"12\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.75\"/> <path d=\"M54.5 27.5l4 4 7.5-8\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"2\"/> <path d=\"M38 18v5M35.5 20.5h5M84 12v5M81.5 14.5h5\" stroke-opacity=\".6\"/> <circle cx=\"88\" cy=\"34\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\" fill-opacity=\".6\"/></svg>", "chat": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 80h92\" stroke-opacity=\".35\" stroke-dasharray=\"2 4\"/> <path d=\"M33 16h40a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10H48l-9 7v-7h-6a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z\"/> <path d=\"M47 25l-2.5 16M56 25l-2.5 16M41.5 30.5h18M40 35.5h18\" stroke-opacity=\".6\"/> <path d=\"M68 52h26a8 8 0 0 1 8 8v2a8 8 0 0 1-8 8h-3v5l-6-5H68a8 8 0 0 1-8-8v-2a8 8 0 0 1 8-8z\" stroke=\"var(--accent,#2A44B0)\" stroke-dasharray=\"3 3\"/> <circle cx=\"73\" cy=\"61\" r=\"1.8\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/><circle cx=\"81\" cy=\"61\" r=\"1.8\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/><circle cx=\"89\" cy=\"61\" r=\"1.8\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/></svg>", "insights": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"> <path d=\"M22 14v62h84\" stroke-opacity=\".7\"/> <rect x=\"31\" y=\"50\" width=\"11\" height=\"26\" rx=\"2.5\" stroke-dasharray=\"3 3\" stroke-opacity=\".6\"/> <rect x=\"48\" y=\"36\" width=\"11\" height=\"40\" rx=\"2.5\" stroke-dasharray=\"3 3\" stroke-opacity=\".6\"/> <rect x=\"65\" y=\"56\" width=\"11\" height=\"20\" rx=\"2.5\" stroke-dasharray=\"3 3\" stroke-opacity=\".6\"/> <rect x=\"82\" y=\"66\" width=\"11\" height=\"10\" rx=\"2.5\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/> <path d=\"M87.5 60V34\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.75\" stroke-dasharray=\"2.5 3\"/> <path d=\"M82 31l5.5-7 5.5 7z\" fill=\"var(--accent,#2A44B0)\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.5\"/></svg>", "notifications": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 80h92\" stroke-opacity=\".35\" stroke-dasharray=\"2 4\"/> <path d=\"M46 60V45a14 14 0 0 1 28 0v15l5 6H41z\"/> <path d=\"M60 31v-3\"/> <path d=\"M56 70a4 4 0 0 0 8 0\"/> <path d=\"M80 26h7l-7 8h7\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.75\"/> <path d=\"M91 13h5l-5 6h5\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.5\"/></svg>", "review-empty": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 80h92\" stroke-opacity=\".35\" stroke-dasharray=\"2 4\"/> <rect x=\"18\" y=\"22\" width=\"44\" height=\"50\" rx=\"7\" stroke-dasharray=\"3.5 3.5\"/> <path d=\"M30 47l5.5 5.5 12-12\" stroke-opacity=\".45\"/> <rect x=\"67\" y=\"45.5\" width=\"17\" height=\"3.5\" rx=\"1.75\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/> <path d=\"M83 40l8 7.25-8 7.25z\" fill=\"var(--accent,#2A44B0)\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"1.5\"/> <circle cx=\"101\" cy=\"47.25\" r=\"6.5\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"2\"/> <circle cx=\"101\" cy=\"47.25\" r=\"1.7\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/></svg>", "search": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"ill\" viewBox=\"0 0 120 90\" width=\"120\" height=\"90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 80h92\" stroke-opacity=\".35\" stroke-dasharray=\"2 4\"/> <circle cx=\"50\" cy=\"40\" r=\"18\"/> <path d=\"M63 53l13 13\" stroke-width=\"5\"/> <circle cx=\"50\" cy=\"40\" r=\"6\" stroke=\"var(--accent,#2A44B0)\" stroke-width=\"2\"/> <circle cx=\"50\" cy=\"40\" r=\"1.7\" fill=\"var(--accent,#2A44B0)\" stroke=\"none\"/> <path d=\"M82 24h18M82 31h11M82 38h15\" stroke-opacity=\".35\"/></svg>"};
const ILL_FOR = l => /CHAT/.test(l) ? 'chat' : /INSIGHT/.test(l) ? 'insights' : /QUEUE/.test(l) ? 'review-empty' : /FILTER|SEARCH/.test(l) ? 'search' : /caught up/i.test(l) ? 'notifications' : /0|clear/i.test(l) ? 'all-clear' : null;
function emptyState(label, text, action, action2) {
  const ill = ILLS[ILL_FOR(label || '')];
  return h('div', { class: 'empty' }, ill ? h('div', { class: 'ill-wrap', html: ill }) : null, h('div', { class: 'frame', text: label }), h('p', { text }), action || action2 ? h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' } }, action ? h('button', { class: 'btn pri', onclick: action.fn }, action.label) : null, action2 ? h('button', { class: 'btn ghost', onclick: action2.fn }, action2.label) : null) : null);
}

/* ── toasts ── */
/* loading, everywhere: the t passes it on, again and again */
const loader = label => h('span', { class: 'ld' }, h('span', { class: 'ld-mark loop', 'aria-hidden': 'true', html: ICONS.markAnim }), label ? h('span', { class: 'ld-t', text: label }) : null);
const loadingRow = label => h('div', { class: 'ld-row', role: 'status' }, loader(label));
function busy(btn, label) {
  const kids = [...btn.childNodes], was = btn.disabled;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.replaceChildren(loader(label || btn.textContent.trim()));
  return () => { btn.replaceChildren(...kids); btn.disabled = was; btn.removeAttribute('aria-busy'); };
}
function toast(msg, action, ms = 5000, keep = false) { // keep: stay next to the toast before it (e.g. its Undo), even on a phone
  let box = $('.toasts'); if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  while (box.children.length > (isPhone() && !keep ? 0 : 1)) box.firstChild.remove();
  const t = h('div', { class: 'toast' }, !action && /…$/.test(msg) ? loader(msg) : h('span', { text: msg }), action ? h('button', { onclick: () => { t.remove(); action.fn(); } }, action.label) : null);
  t.dataset.at = Date.now(); box.append(t); setTimeout(() => t.remove(), action ? ms : 3200);
  return t;
}
function renderPill() {
  $('.pill')?.remove();
  const n = S.outbox.length + (typeof waitingFiles !== 'undefined' ? waitingFiles.size : 0); // changes and files waiting on this phone
  if (n || !navigator.onLine) {
    document.body.append(h('div', { class: 'pill', role: 'status' }, navigator.onLine ? h('span', { class: 'ld-mark loop', 'aria-hidden': 'true', html: ICONS.markAnim }) : null, navigator.onLine ? `Saving ${n} change${n > 1 ? 's' : ''}…` : `Offline${n ? ` · ${n} change${n > 1 ? 's' : ''} waiting` : ' · your work is saved on this phone'}`));
  }
}

/* ── theme ── */
function applyTheme() {
  const r = document.documentElement; const th = S.prefs?.theme || store.get('theme', 'system');
  if (th === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  const ac = S.ws?.accent || store.get('accent', 'cobalt'); r.setAttribute('data-accent', ac);
  r.setAttribute('data-density', S.prefs?.density || 'comfortable');
  store.set('theme', th); store.set('accent', ac);
  const unread = badgeCount() + chatBadge(); document.title = (unread ? `(${unread > 99 ? '99+' : unread}) ` : '') + appName();
  const meta = $('meta[name="apple-mobile-web-app-title"]'); if (meta) meta.content = appName();
}

/* ── popover picker ── */
let popClose = null;
function closePop() { if (popClose) { const f = popClose; popClose = null; f(); } }
function popover(anchor, build, opts = {}) {
  closePop();
  const pop = h('div', { class: 'pop', role: 'dialog' });
  document.body.append(pop); build(pop);
  const place = () => {
    const r = anchor.getBoundingClientRect(); const w = pop.offsetWidth; const hgt = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left), innerWidth - w - 8); let top = r.bottom + 6;
    if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  };
  place();
  const onDown = e => { if (e.target.closest?.('.wait-ov')) return; if (!pop.contains(e.target) && !anchor.contains(e.target)) closePop(); }; // a tap on the loading mark changes nothing
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus?.(); } };
  setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
  document.addEventListener('keydown', onKey, true);
  popClose = () => { pop.remove(); document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); opts.onClose?.(); };
  return { pop, place };
}
/* options: [{v, label, icon?, sub?, color?}] ; multi = checkboxes */
function picker(anchor, { options, value, multi, search = true, onPick, placeholder = 'Search…', footer, empty = 'Nothing found' }) {
  let sel = multi ? new Set(value || []) : value; let act = 0;
  popover(anchor, pop => {
    const q = search ? h('input', { class: 'q', type: 'search', placeholder, 'aria-label': placeholder }) : null;
    const box = h('div', { class: 'opts', role: 'listbox', 'aria-multiselectable': multi ? 'true' : null });
    const draw = () => {
      const s = norm(q?.value); const list = options.filter(o => o.header || !s || norm(o.label).includes(s) || norm(o.sub).includes(s));
      box.replaceChildren(); let i = 0;
      const items = list.filter(o => !o.header);
      if (!items.length) box.append(h('div', { class: 'hint', text: empty }));
      act = Math.min(act, Math.max(0, items.length - 1));
      for (const o of list) {
        if (o.header) { box.append(h('div', { class: 'ph', text: o.header })); continue; }
        const on = multi ? sel.has(o.v) : sel === o.v; const idx = i++;
        box.append(h('button', {
          class: 'opt' + (idx === act ? ' act' : '') + (o.danger ? ' danger' : ''), role: 'option', 'aria-selected': String(!!on), 'data-v': String(o.v),
          onclick: () => {
            if (multi) { on ? sel.delete(o.v) : sel.add(o.v); draw(); onPick([...sel]); }
            else { closePop(); onPick(o.v); }
          },
        }, o.icon || null, h('span', { text: o.label, style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }), o.sub ? h('span', { class: 'sub', text: o.sub }) : null, h('span', { class: 'ck' }, icon('check', 16))));
      }
    };
    if (q) {
      q.addEventListener('input', () => { act = 0; draw(); });
      q.addEventListener('keydown', e => {
        const btns = $$('.opt', box);
        if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(btns.length - 1, act + 1); draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); btns[act]?.click(); }
      });
      pop.append(q);
    }
    pop.append(box); if (footer) pop.append(footer());
    draw(); if (q && !isPhone()) setTimeout(() => q.focus(), 0);
  });
}
function menu(anchor, items) {
  popover(anchor, pop => {
    const box = h('div', { class: 'opts', role: 'menu' });
    for (const it of items.filter(Boolean)) {
      if (it === '-') { box.append(h('div', { class: 'sep' })); continue; }
      if (it.header) { box.append(h('div', { class: 'ph', text: it.header })); continue; }
      box.append(h('button', { class: 'opt' + (it.danger ? ' danger' : ''), role: 'menuitem', onclick: () => { closePop(); it.fn(); } }, it.icon ? icon(it.icon, 16) : null, h('span', { text: it.label, style: { flex: '1' } }), it.sub ? h('span', { class: 'sub', text: it.sub }) : null));
    }
    pop.append(box);
  });
}

/* ── sheets: a page-level sheet, plus small dialogs that may sit on top of it ── */
let sheetStack = [];
function openSheet({ title, kind = 'right', full, build, onClose, key, headExtra, stack }) {
  closePop();
  if (!stack) closeAllSheets(true);
  const z = 40 + sheetStack.length * 4;
  const scrim = h('div', { class: 'scrim', style: { zIndex: z }, onclick: () => closeSheet() });
  const sh = h('section', { class: `sheet ${kind}${full ? ' full' : ''}`, style: { zIndex: z + 1 }, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, 'data-key': key || '' });
  const head = h('header', { class: 'shead' }, h('h2', { text: title }), headExtra || null, h('button', { class: 'x', 'aria-label': 'Close', onclick: () => closeSheet() }, icon('x')));
  sh.append(h('span', { class: 'grab', 'aria-hidden': 'true' }), head);
  document.body.append(scrim, sh);
  const ctx = { sh, head, setTitle: t => { $('h2', head).textContent = t; }, close: () => closeSheet() };
  sheetStack.push({ scrim, sh, onClose, key });
  build(sh, ctx);
  let y0 = null; head.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  head.addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  head.addEventListener('touchend', e => { const dy = (e.changedTouches[0].clientY - (y0 ?? 0)); sh.style.transform = ''; y0 = null; if (dy > 90) closeSheet(); });
  return ctx;
}
function closeSheet(silent) {
  closePop();
  const s = sheetStack.pop(); if (!s) return;
  s.scrim.remove(); s.sh.remove(); s.onClose?.(silent);
  if (!silent) tours.kick();
}
function closeAllSheets(silent) { while (sheetStack.length) closeSheet(silent); }
const currentSheet = () => sheetStack[sheetStack.length - 1]?.sh || null;
function confirmIn(container, { text, yes = 'Confirm', danger, onYes }) {
  const box = h('div', { class: 'info', style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
    h('span', { text, style: { flex: '1 1 200px' } }),
    h('button', { class: 'btn sm' + (danger ? ' danger' : ''), onclick: () => { box.remove(); onYes(); } }, yes),
    h('button', { class: 'btn sm ghost', onclick: () => box.remove() }, 'Cancel'));
  container.prepend(box); box.scrollIntoView({ block: 'nearest' });
}
function sw(checked, onchange, label) {
  const i = h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: e => onchange(e.target.checked) });
  return h('label', { class: 'switch' }, i, h('i'));
}
async function copyText(t, msg = 'Copied') {
  try { await navigator.clipboard.writeText(t); toast(msg); return true; }
  catch { const ta = h('textarea', { value: t, style: { position: 'fixed', opacity: '0' } }); document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast(msg); } catch { toast('Select the text and copy it'); } ta.remove(); return false; }
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function download(name, text, type) {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* tiny markdown: paragraphs, lists, **bold**, *italic*, `code`, links */
function md(src) {
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const out = []; let list = null;
  for (const line of String(src || '').split('\n')) {
    const m = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (m) { const tagn = /\d/.test(m[1]) ? 'ol' : 'ul'; if (!list || list.t !== tagn) { if (list) out.push(`</${list.t}>`); list = { t: tagn }; out.push(`<${tagn}>`); } out.push(`<li>${inline(m[2])}</li>`); continue; }
    if (list) { out.push(`</${list.t}>`); list = null; }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list.t}>`);
  return out.join('');
}
/* description ⇄ sections ("## Heading" blocks) */
function parseSections(desc) {
  const secs = []; let cur = { h: '', body: [] };
  for (const line of String(desc || '').split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) { secs.push(cur); cur = { h: m[1], body: [] }; } else cur.body.push(line);
  }
  secs.push(cur);
  return secs.map(s => ({ h: s.h, body: s.body.join('\n').trim() })).filter((s, i) => i > 0 || s.body);
}
function joinSections(secs) {
  return secs.filter(s => s.h || s.body).map(s => (s.h ? `## ${s.h}\n${s.body}` : s.body)).join('\n\n').trim();
}
function autoGrow(ta) { const f = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 600) + 'px'; }; ta.addEventListener('input', f); requestAnimationFrame(f); return ta; }

