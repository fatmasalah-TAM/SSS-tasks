import type { Ovrto } from './types';

/** The app's state and actions. It exists by the time any React page is drawn. */
export const ovrto = (): Ovrto => (window as unknown as { __ovrto: Ovrto }).__ovrto;
