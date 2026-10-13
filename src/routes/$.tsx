import { createFileRoute, notFound } from '@tanstack/react-router';
import { Workbench } from '../ui/Workbench';
import { destination } from '../ui/workbench/location';
import { NotFound } from '../ui/workbench/NotFound';
export const Route = createFileRoute('/$')({
  beforeLoad: ({ location }) => { if (destination(location.pathname).unknown) throw notFound(); },
  notFoundComponent: NotFound,
  component: Workbench,
});
