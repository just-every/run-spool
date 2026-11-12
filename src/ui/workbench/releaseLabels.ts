import { absentDist } from '../../domain/releases/build';

export const releaseLabel = (value?: string | null) => value?.trim() ? value : 'No release';
export const buildLabel = (value?: string | null) => value?.trim() && value !== absentDist ? value : 'No build supplied';
