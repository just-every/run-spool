import { useRouterState } from '@tanstack/react-router';
import { useEditorLeafReady } from '../modules/editor/react';

/** A retained leaf must acknowledge each committed URL and history entry. */
export function useEditorDestinationReady() {
 const destinationKey = useRouterState({select: state => {
  const destination = state.resolvedLocation ?? state.location;
  return JSON.stringify([destination.href, destination.state.__TSR_key]);
 }});
 useEditorLeafReady(destinationKey);
}
