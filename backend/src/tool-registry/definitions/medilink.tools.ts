import { ToolSchema } from '../interfaces/tool-schema.interface';
import { DENTALINK_TOOLS } from './dentalink.tools';

/**
 * MediLink comparte la misma API de HealthAtom que Dentalink, usando
 * los mismos endpoints y el mismo shape de datos. Por eso reusamos
 * las definiciones de Dentalink directamente.
 */
export const MEDILINK_TOOLS: ToolSchema[] = DENTALINK_TOOLS;

/**
 * Modo dual: intenta Dentalink primero, si falla usa MediLink.
 * Mismas tools que Dentalink/MediLink.
 */
export const DENTALINK_MEDILINK_TOOLS: ToolSchema[] = DENTALINK_TOOLS;
