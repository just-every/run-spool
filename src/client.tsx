import { RouterProvider } from '@tanstack/react-router';
import { StartClient } from '@tanstack/react-start/client';
import { StrictMode, startTransition } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { getRouter } from './router';
import { workbenchMountId } from './ui/workbench/shell-document';

const workbench = document.getElementById(workbenchMountId);
if (workbench) {
  const router = getRouter();
  // Keep the opening screen visible while the browser loads the current route.
  void router.load().then(() => {
    createRoot(workbench).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
  });
} else {
  startTransition(() => { hydrateRoot(document, <StrictMode><StartClient /></StrictMode>); });
}
